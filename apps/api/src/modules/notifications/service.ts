import type { FastifyInstance } from "fastify";

export class NotificationService {
  constructor(private readonly app: FastifyInstance) {}

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
    await this.app.prisma.notification.updateMany({
      where: {
        userId: input.userId,
        id: { in: input.ids }
      },
      data: {
        readAt: new Date()
      }
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
}
