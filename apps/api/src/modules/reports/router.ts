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
        requiredProgram: "REPORTES",
        requiredResource: "PROYECTO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(reportsSchemas.reportsExecutiveQuerySchema, request.query ?? {});
      const report = await service.getExecutiveReport({
        actorId: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        ...query
      });
      return reply.send(report);
    }
  );

  app.get(
    "/executive/export.xlsx",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REPORTES",
        requiredResource: "PROYECTO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(reportsSchemas.reportsExecutiveQuerySchema, request.query ?? {});
      const file = await service.exportExecutiveXlsx({
        actorId: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        ...query
      });
      reply.header("Content-Type", file.contentType);
      reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
      return reply.send(file.buffer);
    }
  );

  app.get(
    "/executive/export.pdf",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REPORTES",
        requiredResource: "PROYECTO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(reportsSchemas.reportsExecutiveQuerySchema, request.query ?? {});
      const file = await service.exportExecutivePdf({
        actorId: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        ...query
      });
      reply.header("Content-Type", file.contentType);
      reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
      return reply.send(file.buffer);
    }
  );
};
