import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startTelemetry, stopTelemetry } from "./telemetry.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const execFileAsync = promisify(execFile);

const resolvePrismaSchemaPath = async () => {
  const candidates = [
    resolve(process.cwd(), "apps/api/prisma/schema.prisma"),
    resolve(process.cwd(), "prisma/schema.prisma")
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.F_OK);
      return candidate;
    } catch {
      // Continue with next candidate.
    }
  }

  throw new Error("No se encontró prisma/schema.prisma para ejecutar migraciones");
};

const runAutoMigrations = async () => {
  if (!env.AUTO_MIGRATE_ON_START || env.NODE_ENV === "test") {
    return;
  }

  const schemaPath = await resolvePrismaSchemaPath();
  const apiWorkdir = dirname(dirname(schemaPath));
  await execFileAsync("pnpm", ["prisma", "migrate", "deploy", "--schema", schemaPath], {
    cwd: apiWorkdir,
    env: process.env
  });
};

const ensureSchemaCompatibility = async (
  app: Awaited<ReturnType<typeof createApp>>
) => {
  const checks: Array<{ table: string; column: string }> = [
    { table: "Project", column: "descriptionCatalogId" },
    { table: "ProjectMember", column: "membershipSource" },
    { table: "ProjectStage", column: "code" },
    { table: "ProjectTeamLink", column: "projectId" },
    { table: "Task", column: "stageId" },
    { table: "Task", column: "startDate" },
    { table: "TaskScheduleHistory", column: "reasonCatalogId" },
    { table: "Message", column: "kind" },
    { table: "Message", column: "meetingId" },
    { table: "MessageAttachment", column: "minioPath" },
    { table: "ProjectDocumentSpace", column: "projectId" },
    { table: "CollaborativeDocument", column: "yDocName" },
    { table: "CollaborativeDocumentVersion", column: "versionNumber" },
    { table: "DocumentCollabSession", column: "revision" },
    { table: "FrontendSettings", column: "organizationName" }
  ];

  for (const check of checks) {
    const result = await app.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${check.table}
          AND column_name = ${check.column}
      ) AS "exists"
    `;

    if (!result[0]?.exists) {
      throw new Error(
        `Esquema desactualizado: falta la columna "${check.table}.${check.column}". Ejecuta "pnpm --filter @corelia/api prisma:migrate:deploy" o reinicia Docker para aplicar migraciones.`
      );
    }
  }
};

const bootstrap = async () => {
  try {
    await startTelemetry();
    await runAutoMigrations();
    const app = await createApp();

    await ensureSchemaCompatibility(app);
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
    const shutdown = async () => {
      await app.close();
      await stopTelemetry();
      process.exit(0);
    };

    process.on("SIGINT", () => {
      void shutdown();
    });

    process.on("SIGTERM", () => {
      void shutdown();
    });
  } catch (error) {
    console.error(error);
    await stopTelemetry();
    process.exit(1);
  }
};

void bootstrap();
