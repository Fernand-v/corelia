import type { SocketBaseContext } from "./types.js";

export const registerTypingEvents = ({ app, socket }: SocketBaseContext) => {
  socket.on("channel:typing:start", (channelId: string) => {
    if (!channelId) {
      return;
    }

    socket.broadcast.to(`channel:${channelId}`).emit("channel:typing", {
      channelId,
      userId: socket.data.user.id,
      isTyping: true
    });
  });

  socket.on("channel:typing:stop", (channelId: string) => {
    if (!channelId) {
      return;
    }

    socket.broadcast.to(`channel:${channelId}`).emit("channel:typing", {
      channelId,
      userId: socket.data.user.id,
      isTyping: false
    });
  });
};
