import { timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

const toSingleHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const constantTimeEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

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

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }

    const path = request.url.split("?")[0] ?? "/";

    // Public-only routes that intentionally do not require API key.
    if (
      path === "/" ||
      path === "/status" ||
      path === "/status/" ||
      path.startsWith("/ws/socket.io") ||
      path.startsWith("/api/v1/announcements/assets/content") ||
      path.startsWith("/api/v1/documents/assets/content")
    ) {
      return;
    }

    const providedApiKey = toSingleHeaderValue(request.headers["x-api-key"]);
    if (!providedApiKey || !constantTimeEquals(providedApiKey, env.API_KEY)) {
      return reply.code(401).send({
        message: "API key inválida o ausente"
      });
    }
  });
});
