import fp from "fastify-plugin";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { createMeetingAccessChecker } from "./socket/access.js";
import { authenticateSocket } from "./socket/auth.js";
import { createCallRuntime } from "./socket/call-runtime.js";
import { registerLegacyCallEvents } from "./socket/legacy-call-events.js";
import { registerMeetingCallEvents } from "./socket/meeting-call-events.js";
import { registerNotificationEvents } from "./socket/notification-events.js";
import { markSocketOnline } from "./socket/presence.js";
import { registerSubscriptionEvents } from "./socket/subscription-events.js";
import { withSocketSpan } from "./socket/tracing.js";
import type { SocketWithUser } from "./socket/types.js";

export const socketPlugin = fp(async (app) => {
  if (!env.SOCKET_IO_ENABLED) {
    app.decorate("realtime", {
      isEnabled: false,
      emitNotification: async () => undefined,
      emitChannelMessage: async () => undefined,
      emitMeetingEvent: async () => undefined
    });
    return;
  }

  const hasMeetingAccess = createMeetingAccessChecker(app);

  const io = new Server(app.server, {
    path: env.SOCKET_IO_PATH,
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use(async (rawSocket, next) => {
    await authenticateSocket(app, rawSocket as SocketWithUser, next);
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as SocketWithUser;
    const joinedMeetingCalls = new Set<string>();

    markSocketOnline(app, socket.data.user.id, socket.id);

    const callRuntime = createCallRuntime(app, socket, joinedMeetingCalls);
    const context = {
      app,
      io,
      socket,
      withSocketSpan,
      hasMeetingAccess,
      joinedMeetingCalls,
      ...callRuntime
    };

    registerSubscriptionEvents(context);
    registerLegacyCallEvents(context);
    registerMeetingCallEvents(context);
    registerNotificationEvents(context);
  });

  app.decorate("io", io);
  app.decorate("realtime", {
    isEnabled: true,
    emitNotification: async (userId: string, notification: unknown) => {
      io.to(`user:${userId}`).emit("notification:new", notification);
    },
    emitChannelMessage: async (channelId: string, message: unknown) => {
      io.to(`channel:${channelId}`).emit("channel:message", message);
    },
    emitMeetingEvent: async (meetingId: string, eventName: string, payload: unknown) => {
      io.to(`meeting:${meetingId}`).emit(eventName, payload);
    }
  });

  app.addHook("onClose", async () => {
    await io.close();
  });
});
