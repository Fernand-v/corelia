import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

const LOCAL_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal)(:\d+)?$/i;

const PRIVATE_IPV4_PATTERN =
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/;
const PRIVATE_IPV6_PATTERN = /^(::1|fc|fd|fe80:)/i;

const parseConfiguredCorsOrigins = () =>
  env.CORS_ALLOWED_ORIGINS.split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildOriginMatcher = (pattern: string) => {
  if (pattern === "*") {
    return () => true;
  }

  if (!pattern.includes("*")) {
    return (origin: string) => origin.toLowerCase() === pattern.toLowerCase();
  }

  const regexPattern = pattern
    .split("*")
    .map((segment) => escapeRegex(segment))
    .join(".*");
  const regex = new RegExp(`^${regexPattern}$`, "i");

  return (origin: string) => regex.test(origin);
};

const isPrivateNetworkOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "host.docker.internal"
    ) {
      return true;
    }

    if (hostname.endsWith(".local")) {
      return true;
    }

    return PRIVATE_IPV4_PATTERN.test(hostname) || PRIVATE_IPV6_PATTERN.test(hostname);
  } catch {
    return false;
  }
};

export const securityPlugin = fp(async (app) => {
  const originMatchers = parseConfiguredCorsOrigins().map((pattern) => buildOriginMatcher(pattern));

  await app.register(cors, {
    origin: (origin, callback) => {
      // Non-browser clients usually don't send Origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV !== "production" && LOCAL_ORIGIN_PATTERN.test(origin)) {
        callback(null, true);
        return;
      }

      if (originMatchers.some((matcher) => matcher(origin))) {
        callback(null, true);
        return;
      }

      if (env.CORS_ALLOW_PRIVATE_NETWORK && isPrivateNetworkOrigin(origin)) {
        callback(null, true);
        return;
      }

      const corsError = new Error("Origin not allowed") as Error & { statusCode?: number };
      corsError.statusCode = 403;
      callback(corsError, false);
    },
    credentials: true
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
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
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const forwarded = request.headers["x-forwarded-for"];
      if (typeof forwarded === "string") {
        const clientIp = forwarded.split(",")[0]?.trim();
        if (clientIp) {
          return clientIp;
        }
      }
      return request.ip;
    }
  });
});
