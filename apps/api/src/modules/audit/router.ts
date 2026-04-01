import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { AuditService } from "./service.js";
import { auditSchemas } from "./schema.js";

export const auditRouter: FastifyPluginAsync = async (app) => {
  const service = new AuditService(app);

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "AUDITORIA",
        requiredPermission: "AUDITORIA_LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(auditSchemas.paginationSchema, request.query ?? {});
      return service.list(query.page, query.pageSize);
    }
  );
};
