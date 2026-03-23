import { MessagingService } from "../../modules/messaging/service.js";
import type { SocketBaseContext } from "./types.js";

export const registerReceiptEvents = ({ app, socket }: SocketBaseContext) => {
  const service = new MessagingService(app);

  socket.on(
    "channel:messages:delivered",
    (data: { channelId: string; messageIds: string[] }) => {
      if (!data?.channelId || !Array.isArray(data.messageIds) || data.messageIds.length === 0) {
        return;
      }

      service
        .markMessagesDelivered({
          channelId: data.channelId,
          messageIds: data.messageIds,
          userId: socket.data.user.id
        })
        .catch(() => undefined);
    }
  );

  socket.on(
    "channel:messages:read",
    (data: { channelId: string; upToMessageId: string }) => {
      if (!data?.channelId || !data.upToMessageId) {
        return;
      }

      service
        .markMessagesRead({
          channelId: data.channelId,
          upToMessageId: data.upToMessageId,
          userId: socket.data.user.id
        })
        .catch(() => undefined);
    }
  );
};
