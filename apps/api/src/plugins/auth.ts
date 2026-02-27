import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

interface AccessTokenPayload {
  id: string;
  email: string;
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
      request.authUser = {
        id: payload.id,
        email: payload.email
      };
    } catch {
      return reply.code(401).send({ message: "Unauthorized" });
    }
  });
});
