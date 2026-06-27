import { socketHasPermission } from "./access.js";
import type { SocketBaseContext } from "./types.js";

export const registerTypingEvents = ({ socket }: SocketBaseContext) => {
  // Solo quien puede escribir mensajes emite el indicador "escribiendo…".
  const canWrite = () => socketHasPermission(socket, "MENSAJE", "ESCRIBIR");

  socket.on("channel:typing:start", (channelId: string) => {
    if (!channelId || !canWrite()) {
      return;
    }

    socket.broadcast.to(`channel:${channelId}`).emit("channel:typing", {
      channelId,
      userId: socket.data.user.id,
      isTyping: true
    });
  });

  socket.on("channel:typing:stop", (channelId: string) => {
    if (!channelId || !canWrite()) {
      return;
    }

    socket.broadcast.to(`channel:${channelId}`).emit("channel:typing", {
      channelId,
      userId: socket.data.user.id,
      isTyping: false
    });
  });
};
