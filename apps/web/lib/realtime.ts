"use client";

import { io, type Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const resolveWsBase = () => {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) {
    return explicit;
  }

  if (typeof window !== "undefined" && API_BASE.startsWith("/") && window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return API_BASE.replace(/\/api\/v1\/?$/, "");
};

const WS_BASE = resolveWsBase();

const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/ws/socket.io";

let socket: Socket | null = null;

export const getRealtimeBaseUrl = () => WS_BASE;
export const getRealtimePath = () => SOCKET_PATH;

export const getRealtimeSocket = (accessToken: string): Socket => {
  if (socket) {
    return socket;
  }

  socket = io(WS_BASE || undefined, {
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
