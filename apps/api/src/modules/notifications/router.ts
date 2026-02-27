import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { NotificationService } from "./service.js";
import { notificationSchemas } from "./schema.js";

export const notificationsRouter: FastifyPluginAsync = async (app) => {
  const service = new NotificationService(app);

  app.put(
    "/preferences",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "NOTIFICACION_LEER"
      }
    },
    async (request) => {
      const payload = parseWithSchema(notificationSchemas.upsertPreferenceSchema, request.body);
      return service.upsertPreference({
        ...payload,
        userId: request.authUser!.id
      });
    }
  );

  app.get(
    "/preferences",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "NOTIFICACION_LEER"
      }
    },
    async (request) => {
      return service.listPreferences(request.authUser!.id);
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "NOTIFICACION_LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(notificationSchemas.syncQuerySchema, request.query ?? {});
      return service.listNotifications(request.authUser!.id, query.since);
    }
  );

  app.post(
    "/read",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "NOTIFICACION_LEER"
      }
    },
    async (request) => {
      const payload = parseWithSchema(notificationSchemas.markReadSchema, request.body);
      return service.markRead({
        userId: request.authUser!.id,
        ids: payload.ids
      });
    }
  );

  app.get(
    "/unread-count",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "NOTIFICACION_LEER"
      }
    },
    async (request) => {
      return service.unreadCount(request.authUser!.id);
    }
  );
};
