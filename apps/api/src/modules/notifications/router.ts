import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { NotificationService } from "./service.js";
import { notificationSchemas } from "./schema.js";

export const notificationsRouter: FastifyPluginAsync = async (app) => {
  const service = new NotificationService(app);
  const resolveUserAgent = (value: string | string[] | undefined) => {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return null;
  };

  app.put(
    "/preferences",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
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
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      return service.listPreferences(request.authUser!.id);
    }
  );

  app.get(
    "/push/config",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
      }
    },
    async () => {
      return service.getBrowserPushConfig();
    }
  );

  app.post(
    "/push/subscription",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      const payload = parseWithSchema(notificationSchemas.pushSubscribeSchema, request.body);
      return service.upsertBrowserPushSubscription({
        userId: request.authUser!.id,
        subscription: payload.subscription,
        userAgent: resolveUserAgent(request.headers["user-agent"])
      });
    }
  );

  app.delete(
    "/push/subscription",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      const payload = parseWithSchema(notificationSchemas.pushUnsubscribeSchema, request.body);
      return service.removeBrowserPushSubscription({
        userId: request.authUser!.id,
        endpoint: payload.endpoint
      });
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
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
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
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
        requiredProgram: "NOTIFICACIONES",
        requiredResource: "NOTIFICACION",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      return service.unreadCount(request.authUser!.id);
    }
  );
};
