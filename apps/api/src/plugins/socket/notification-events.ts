import { notificationSyncInputSchema } from "./schemas.js";
import type { SocketBaseContext } from "./types.js";

export const registerNotificationEvents = ({
  app,
  socket,
  withSocketSpan
}: SocketBaseContext) => {
  socket.on(
    "notifications:sync",
    async (
      payload: unknown,
      ack?: (result: {
        ok: boolean;
        data?: unknown[];
        message?: string;
      }) => void
    ) => {
      await withSocketSpan(
        "socket.notifications.sync",
        {
          "corelia.user.id": socket.data.user.id
        },
        async () => {
          const parsed = notificationSyncInputSchema.safeParse(payload ?? {});
          if (!parsed.success) {
            ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Payload inválido" });
            return;
          }

          const sinceDate = parsed.data.since ? new Date(parsed.data.since) : null;
          const notifications = await app.prisma.notification.findMany({
            where: {
              userId: socket.data.user.id,
              ...(sinceDate ? { createdAt: { gt: sinceDate } } : {})
            },
            orderBy: { createdAt: "asc" },
            take: 200
          });

          const missingDelivered = notifications
            .filter((notification) => notification.deliveredAt === null)
            .map((notification) => notification.id);

          if (missingDelivered.length > 0) {
            await app.prisma.notification.updateMany({
              where: {
                id: { in: missingDelivered }
              },
              data: {
                deliveredAt: new Date()
              }
            });
          }

          ack?.({ ok: true, data: notifications });
        }
      ).catch((error) => {
        ack?.({ ok: false, message: (error as Error).message });
      });
    }
  );
};
