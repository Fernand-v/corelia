import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import client from "prom-client";
import { env } from "../config/env.js";

const metricsPlugin = async (app: FastifyInstance) => {
  const register = new client.Registry();

  client.collectDefaultMetrics({ register });

  const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register]
  });

  const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [register]
  });

  app.addHook("onResponse", (request, reply, done) => {
    if (request.url === "/metrics") {
      done();
      return;
    }

    const route = request.routeOptions?.url ?? request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode)
    };

    const durationSeconds = reply.elapsedTime / 1000;
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);

    done();
  });

  app.get(
    "/metrics",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async (request, reply) => {
      if (env.METRICS_SECRET) {
        const authHeader = request.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${env.METRICS_SECRET}`) {
          return reply.code(401).send({ message: "No autorizado" });
        }
      } else {
        const ip = request.ip;
        const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
        if (!isLocal) {
          return reply.code(403).send({ message: "Acceso restringido a red local" });
        }
      }

      const metrics = await register.metrics();
      return reply.type(register.contentType).send(metrics);
    }
  );
};

export default fp(metricsPlugin, { name: "metrics" });
