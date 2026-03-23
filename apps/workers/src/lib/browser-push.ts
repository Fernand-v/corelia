import type { Notification, PrismaClient } from "@prisma/client";
import webpush from "web-push";
import { env } from "./env.js";

const pushRoutePattern = /Ruta:\s*(\/\S+)/i;

const browserPushEnabled =
  env.WEB_PUSH_ENABLED &&
  env.WEB_PUSH_VAPID_SUBJECT.trim().length > 0 &&
  env.WEB_PUSH_VAPID_PUBLIC_KEY.trim().length > 0 &&
  env.WEB_PUSH_VAPID_PRIVATE_KEY.trim().length > 0;

if (browserPushEnabled) {
  webpush.setVapidDetails(
    env.WEB_PUSH_VAPID_SUBJECT,
    env.WEB_PUSH_VAPID_PUBLIC_KEY,
    env.WEB_PUSH_VAPID_PRIVATE_KEY
  );
}

const extractNotificationPath = (body: string) => {
  const match = body.match(pushRoutePattern);
  if (!match?.[1]) {
    return "/notifications";
  }

  return match[1].replace(/[).,;!?]+$/g, "");
};

const summarizeNotificationBody = (body: string) => {
  const compact = body
    .replace(/\s*Ruta:\s*\/\S+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return compact || "Tienes una nueva notificación en Corelia.";
};

const isExpiredSubscriptionError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
};

export const sendBrowserPushNotifications = async (
  prisma: PrismaClient,
  notification: Pick<Notification, "id" | "userId" | "event" | "channel" | "title" | "body" | "createdAt">
) => {
  if (!browserPushEnabled || notification.channel !== "IN_APP") {
    return;
  }

  const subscriptions = await prisma.browserPushSubscription.findMany({
    where: {
      userId: notification.userId,
      isActive: true
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      expirationTime: true
    }
  });

  if (subscriptions.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    notificationId: notification.id,
    event: notification.event,
    title: notification.title,
    body: summarizeNotificationBody(notification.body),
    path: extractNotificationPath(notification.body),
    createdAt: notification.createdAt.toISOString()
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime
              ? subscription.expirationTime.getTime()
              : null,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          payload
        );
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await prisma.browserPushSubscription.update({
            where: {
              id: subscription.id
            },
            data: {
              isActive: false,
              lastSeenAt: new Date()
            }
          });
          return;
        }

        console.warn("Browser push delivery failed", {
          notificationId: notification.id,
          subscriptionId: subscription.id,
          error
        });
      }
    })
  );
};
