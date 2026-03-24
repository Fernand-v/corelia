import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { env } from "../config/env.js";
import { buildRevocationKey } from "../modules/auth/service.js";

interface AccessTokenPayload {
  id: string;
  email: string;
  iat?: number;
}

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: {
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
    }
  });

  app.addHook("preValidation", async (request, reply) => {
    const config = request.routeOptions.config as { requiresAuth?: boolean } | undefined;
    if (config?.requiresAuth === false) {
      return;
    }

    try {
      const payload = await request.jwtVerify<AccessTokenPayload>();

      // Comprobar blacklist: si el usuario hizo logout después de que el token fue emitido
      const revocationRaw = await app.redis.get(buildRevocationKey(payload.id));
      if (revocationRaw) {
        const logoutAt = Number(revocationRaw);
        const tokenIssuedAt = (payload.iat ?? 0) * 1000;
        if (tokenIssuedAt < logoutAt) {
          return reply.code(401).send({ message: "Unauthorized" });
        }
      }

      request.authUser = {
        id: payload.id,
        email: payload.email
      };
    } catch {
      return reply.code(401).send({ message: "Unauthorized" });
    }
  });
});
