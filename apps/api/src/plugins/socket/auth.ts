import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SocketWithUser } from "./types.js";

const socketAuthPayloadSchema = z.object({
  id: z.string().min(1),
  email: z.string().email()
});

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

    const raw = await app.jwt.verify(authToken);
    const payload = socketAuthPayloadSchema.parse(raw);
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
