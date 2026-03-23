import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { connection } from "../lib/queues.js";
import { sendBrowserPushNotifications } from "../lib/browser-push.js";
import { env } from "../lib/env.js";
import { runJobWithTrace } from "../lib/tracing.js";

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

export const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    return runJobWithTrace(
      "worker.notifications.send",
      (job.data as Record<string, unknown>) ?? {},
      async () => {
        const { notificationId } = job.data as { notificationId: string };

        const notification = await prisma.notification.findUnique({
          where: { id: notificationId },
          include: {
            user: true
          }
        });

        if (!notification) {
          return;
        }

        if (notification.channel === "EMAIL") {
          await transporter.sendMail({
            from: env.SMTP_FROM,
            to: notification.user.email,
            subject: notification.title,
            text: notification.body
          });
        }

        await sendBrowserPushNotifications(prisma, notification);

        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            sentAt: new Date()
          }
        });
      }
    );
  },
  {
    connection
  }
);
