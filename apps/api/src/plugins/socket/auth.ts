import type { FastifyInstance } from "fastify";
import type { SocketAuthPayload, SocketWithUser } from "./types.js";

export const parseBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

export const authenticateSocket = async (
  app: FastifyInstance,
  socket: SocketWithUser,
  next: (err?: Error | undefined) => void
) => {
  try {
    const authToken =
      (typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : null) ??
      parseBearerToken(
        typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization
          : undefined
      );

    if (!authToken) {
      return next(new Error("Unauthorized socket"));
    }

    const payload = (await app.jwt.verify(authToken)) as SocketAuthPayload;
    socket.data.user = {
      id: payload.id,
      email: payload.email
    };
    socket.join(`user:${payload.id}`);

    return next();
  } catch {
    return next(new Error("Unauthorized socket"));
  }
};
