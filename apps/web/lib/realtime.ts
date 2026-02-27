"use client";

import { io, type Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  API_BASE.replace(/\/api\/v1\/?$/, "");

const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/ws/socket.io";

let socket: Socket | null = null;

export const getRealtimeSocket = (accessToken: string): Socket => {
  if (socket) {
    return socket;
  }

  socket = io(WS_BASE, {
    path: SOCKET_PATH,
    transports: ["websocket", "polling"],
    auth: {
      token: accessToken
    }
  });

  return socket;
};

export const disconnectRealtimeSocket = () => {
  if (!socket) {
    return;
  }
  socket.disconnect();
  socket = null;
};
