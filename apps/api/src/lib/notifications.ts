import type { FastifyInstance } from "fastify";
import type { NotificationEvent, NotificationPriority } from "@prisma/client";
import { attachTraceContext } from "./tracing.js";

export const dispatchNotification = async (
  app: FastifyInstance,
  notification: {
    id: string;
    userId: string;
    event: NotificationEvent;
    channel: "EMAIL" | "IN_APP";
    priority: NotificationPriority;
    groupKey: string | null;
    title: string;
    body: string;
    createdAt: Date;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
  }
) => {
  if (app.queues) {
    await app.queues.notifications.add(
      "send-notification",
      attachTraceContext({
        notificationId: notification.id
      })
    );
  }

  if (app.realtime) {
    await app.realtime.emitNotification(notification.userId, notification);
  }
};

export const createAndDispatchNotification = async (
  app: FastifyInstance,
  input: {
    userId: string;
    event: NotificationEvent;
    channel?: "EMAIL" | "IN_APP";
    title: string;
    body: string;
    priority?: NotificationPriority;
    groupKey?: string;
  }
) => {
  const priority = input.priority ?? "NORMAL";
  const groupKey = input.groupKey ?? null;

  if (groupKey) {
    const existing = await app.prisma.notification.findFirst({
      where: { userId: input.userId, groupKey, readAt: null }
    });

    if (existing) {
      const updated = await app.prisma.notification.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          body: input.body,
          priority,
          createdAt: new Date(),
          sentAt: null
        }
      });

      await dispatchNotification(app, updated);
      return updated;
    }
  }

  const notification = await app.prisma.notification.create({
    data: {
      userId: input.userId,
      event: input.event,
      channel: input.channel ?? "IN_APP",
      title: input.title,
      body: input.body,
      priority,
      groupKey
    }
  });

  await dispatchNotification(app, notification);

  return notification;
};
