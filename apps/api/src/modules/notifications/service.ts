import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";

const isBrowserPushConfigured =
  env.WEB_PUSH_ENABLED &&
  env.WEB_PUSH_VAPID_SUBJECT.trim().length > 0 &&
  env.WEB_PUSH_VAPID_PUBLIC_KEY.trim().length > 0 &&
  env.WEB_PUSH_VAPID_PRIVATE_KEY.trim().length > 0;

export class NotificationService {
  constructor(private readonly app: FastifyInstance) {}

  private serviceUnavailable(message: string): Error & { statusCode: number } {
    const error = new Error(message) as Error & { statusCode: number };
    error.name = "ServiceUnavailable";
    error.statusCode = 503;
    return error;
  }

  async upsertPreference(input: {
    userId: string;
    event:
      | "TAREA_ASIGNADA"
      | "TAREA_REASIGNADA"
      | "TAREA_ESTADO_CAMBIADO"
      | "MENSAJE_NUEVO_CANAL"
      | "MENCION_MENSAJE"
      | "REUNION_PROGRAMADA"
      | "ACUERDO_ASIGNADO_TAREA"
      | "TAREA_PROXIMA_VENCER"
      | "TAREA_BLOQUEADA"
      | "SOLICITUD_RESUELTA";
    channel: "EMAIL" | "IN_APP";
    frequency: "INMEDIATA" | "RESUMEN_DIARIO";
    enabled: boolean;
  }) {
    return this.app.prisma.notificationPreference.upsert({
      where: {
        userId_event_channel: {
          userId: input.userId,
          event: input.event,
          channel: input.channel
        }
      },
      update: {
        frequency: input.frequency,
        enabled: input.enabled
      },
      create: input
    });
  }

  async listPreferences(userId: string) {
    return this.app.prisma.notificationPreference.findMany({
      where: { userId }
    });
  }

  async listNotifications(userId: string, since?: string) {
    const where = since
      ? {
          userId,
          createdAt: {
            gt: new Date(since)
          }
        }
      : { userId };

    const notifications = await this.app.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const undeliveredIds = notifications
      .filter((notification) => notification.deliveredAt === null)
      .map((notification) => notification.id);

    if (undeliveredIds.length > 0) {
      await this.app.prisma.notification.updateMany({
        where: {
          id: {
            in: undeliveredIds
          }
        },
        data: {
          deliveredAt: new Date()
        }
      });
    }

    return notifications;
  }

  async markRead(input: { userId: string; ids: string[] }) {
    const now = new Date();

    await this.app.prisma.notification.updateMany({
      where: {
        userId: input.userId,
        id: { in: input.ids }
      },
      data: {
        readAt: now
      }
    });

    await this.app.realtime?.emitNotificationReadSync(input.userId, {
      notificationIds: input.ids,
      readAt: now.toISOString()
    });

    return {
      updated: input.ids.length
    };
  }

  async unreadCount(userId: string) {
    const count = await this.app.prisma.notification.count({
      where: {
        userId,
        readAt: null
      }
    });

    return {
      unread: count
    };
  }

  getBrowserPushConfig() {
    return {
      enabled: isBrowserPushConfigured,
      publicKey: isBrowserPushConfigured ? env.WEB_PUSH_VAPID_PUBLIC_KEY : null
    };
  }

  async upsertBrowserPushSubscription(input: {
    userId: string;
    subscription: {
      endpoint: string;
      expirationTime?: number | null;
      keys: {
        p256dh: string;
        auth: string;
      };
    };
    userAgent?: string | null;
  }) {
    if (!isBrowserPushConfigured) {
      throw this.serviceUnavailable("Las notificaciones push no están configuradas en el servidor");
    }

    const expirationTime =
      typeof input.subscription.expirationTime === "number"
        ? new Date(input.subscription.expirationTime)
        : null;

    const record = await this.app.prisma.browserPushSubscription.upsert({
      where: {
        endpoint: input.subscription.endpoint
      },
      update: {
        userId: input.userId,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        expirationTime,
        userAgent: input.userAgent ?? null,
        isActive: true,
        lastSeenAt: new Date()
      },
      create: {
        userId: input.userId,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        expirationTime,
        userAgent: input.userAgent ?? null,
        isActive: true,
        lastSeenAt: new Date()
      },
      select: {
        id: true,
        endpoint: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  async removeBrowserPushSubscription(input: { userId: string; endpoint: string }) {
    if (!isBrowserPushConfigured) {
      return {
        removed: 0
      };
    }

    const result = await this.app.prisma.browserPushSubscription.updateMany({
      where: {
        userId: input.userId,
        endpoint: input.endpoint,
        isActive: true
      },
      data: {
        isActive: false,
        lastSeenAt: new Date()
      }
    });

    return {
      removed: result.count
    };
  }
}
