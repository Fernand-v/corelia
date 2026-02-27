import type { FastifyInstance } from "fastify";
import type { NotificationEvent } from "@prisma/client";
import { attachTraceContext } from "./tracing.js";

export const dispatchNotification = async (
  app: FastifyInstance,
  notification: {
    id: string;
    userId: string;
    event: NotificationEvent;
    channel: "EMAIL" | "IN_APP";
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
  }
) => {
  const notification = await app.prisma.notification.create({
    data: {
      userId: input.userId,
      event: input.event,
      channel: input.channel ?? "IN_APP",
      title: input.title,
      body: input.body
    }
  });

  await dispatchNotification(app, notification);

  return notification;
};
