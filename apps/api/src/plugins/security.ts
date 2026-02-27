import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";

export const securityPlugin = fp(async (app) => {
  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    xFrameOptions: {
      action: "deny"
    }
  });

  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.ip
  });
});
