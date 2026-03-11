import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { ReportsService } from "./service.js";
import { reportsSchemas } from "./schema.js";

export const reportsRouter: FastifyPluginAsync = async (app) => {
  const service = new ReportsService(app);

  app.get(
    "/executive",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(reportsSchemas.reportsExecutiveQuerySchema, request.query ?? {});
        const report = await service.getExecutiveReport({
          actorId: request.authUser!.id,
          activeRole: request.accessContext!.activeRole,
          ...query
        });
        return reply.send(report);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/executive/export.xlsx",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(reportsSchemas.reportsExecutiveQuerySchema, request.query ?? {});
        const file = await service.exportExecutiveXlsx({
          actorId: request.authUser!.id,
          activeRole: request.accessContext!.activeRole,
          ...query
        });
        reply.header("Content-Type", file.contentType);
        reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
        return reply.send(file.buffer);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/executive/export.pdf",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(reportsSchemas.reportsExecutiveQuerySchema, request.query ?? {});
        const file = await service.exportExecutivePdf({
          actorId: request.authUser!.id,
          activeRole: request.accessContext!.activeRole,
          ...query
        });
        reply.header("Content-Type", file.contentType);
        reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
        return reply.send(file.buffer);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );
};
