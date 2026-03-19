import { spawn } from "node:child_process";
import { env } from "../../../config/env.js";
import { verifyPassword } from "../../../lib/password.js";
import { AdminCommonService } from "./common.js";

type DatabaseBackupResult = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export class AdminDatabaseBackupService extends AdminCommonService {
  private unauthorized(message: string): Error {
    const error = new Error(message);
    error.name = "Unauthorized";
    return error;
  }

  private internal(message: string): Error {
    const error = new Error(message);
    error.name = "Internal";
    return error;
  }

  private async runPgDump(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let stderr = "";
      let settled = false;
      const databaseUrl = new URL(env.DATABASE_URL);
      const databaseName = databaseUrl.pathname.replace(/^\/+/, "");
      const username = decodeURIComponent(databaseUrl.username);
      const password = decodeURIComponent(databaseUrl.password);

      if (!databaseName) {
        reject(this.internal("DATABASE_URL no contiene el nombre de la base de datos."));
        return;
      }

      const args = ["--format=custom", "--no-owner", "--no-privileges", "--dbname", databaseName];
      if (databaseUrl.hostname) {
        args.push("--host", databaseUrl.hostname);
      }
      if (databaseUrl.port) {
        args.push("--port", databaseUrl.port);
      }
      if (username) {
        args.push("--username", username);
      }

      const child = spawn(
        "pg_dump",
        args,
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            ...(password ? { PGPASSWORD: password } : {}),
            ...(databaseUrl.searchParams.get("sslmode")
              ? { PGSSLMODE: databaseUrl.searchParams.get("sslmode") ?? "prefer" }
              : {})
          }
        }
      );

      child.stdout.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (settled) {
          return;
        }
        settled = true;

        if (error.code === "ENOENT") {
          reject(this.internal("No se encontró pg_dump en el servidor."));
          return;
        }

        reject(this.internal("No se pudo iniciar la generación del backup."));
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;

        if (code !== 0) {
          this.app.log.error(
            {
              code,
              stderr: stderr.trim()
            },
            "Fallo al ejecutar pg_dump para backup administrativo"
          );
          reject(this.internal("No se pudo completar la generación del backup."));
          return;
        }

        resolve(Buffer.concat(chunks));
      });
    });
  }

  async createDatabaseBackup(actorId: string, input: { password: string }): Promise<DatabaseBackupResult> {
    await this.assertAdmin(actorId);

    const actor = await this.app.prisma.user.findUnique({
      where: {
        id: actorId
      },
      select: {
        isActive: true,
        passwordHash: true
      }
    });

    if (!actor || !actor.isActive) {
      throw this.forbidden("Usuario administrador no encontrado");
    }

    const passwordValid = await verifyPassword(input.password, actor.passwordHash);
    if (!passwordValid) {
      throw this.unauthorized("La contraseña ingresada no es válida");
    }

    const now = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");

    return {
      fileName: `corelia-backup-${now}.dump`,
      contentType: "application/octet-stream",
      content: await this.runPgDump()
    };
  }
}
