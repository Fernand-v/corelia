import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { StatusService } from "./service.js";
import { statusSchemas } from "./schema.js";

export const statusRouter: FastifyPluginAsync = async (app) => {
  const service = new StatusService(app);

  app.get(
    "/",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async () => {
      return service.getSystemStatus();
    }
  );

  app.put(
    "/maintenance",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(statusSchemas.maintenanceToggleSchema, request.body);
        const result = await service.setMaintenance(payload);
        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: String(result.id),
          action: "ACTUALIZAR",
          newData: {
            enabled: result.enabled,
            message: result.message
          }
        };
        return reply.send(result);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );
};
