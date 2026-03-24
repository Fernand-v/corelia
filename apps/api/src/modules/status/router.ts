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
      return service.getPublicSystemStatus();
    }
  );

  app.get(
    "/frontend-settings",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async () => {
      return service.getFrontendSettings();
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
        const currentStatus = await service.getSystemStatus();
        const result = await service.setMaintenance(payload);
        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: String(result.id),
          action: "ACTUALIZAR",
          reasonCatalogId: "MAINTENANCE_TOGGLE",
          reason: payload.enabled
            ? "Activación de modo mantenimiento"
            : "Desactivación de modo mantenimiento",
          previousDataText: {
            enabled: currentStatus.maintenance.enabled,
            message: currentStatus.maintenance.message
          },
          newDataText: {
            enabled: result.enabled,
            message: result.message
          }
        };
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );
};
