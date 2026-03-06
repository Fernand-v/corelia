import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { getFrontendSettings as getFrontendSettingsConfig } from "../../lib/frontend-settings.js";

export class StatusService {
  constructor(private readonly app: FastifyInstance) {}

  async getFrontendSettings() {
    return getFrontendSettingsConfig(this.app.prisma);
  }

  async getSystemStatus() {
    const services: Array<{
      service: "api" | "postgres" | "redis" | "storage" | "media";
      status: "up" | "down" | "degraded";
      detail: string | null;
    }> = [
      {
        service: "api",
        status: "up",
        detail: null
      }
    ];

    try {
      await this.app.prisma.$queryRaw`SELECT 1`;
      services.push({ service: "postgres", status: "up", detail: null });
    } catch (error) {
      services.push({
        service: "postgres",
        status: "down",
        detail: (error as Error).message
      });
    }

    try {
      const pong = await this.app.redis.ping();
      services.push({
        service: "redis",
        status: pong === "PONG" ? "up" : "degraded",
        detail: pong === "PONG" ? null : pong
      });
    } catch (error) {
      services.push({
        service: "redis",
        status: "down",
        detail: (error as Error).message
      });
    }

    try {
      const protocol = env.MINIO_USE_SSL ? "https" : "http";
      const response = await fetch(
        `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/minio/health/live`
      );
      services.push({
        service: "storage",
        status: response.ok ? "up" : "degraded",
        detail: response.ok ? null : `status ${response.status}`
      });
    } catch (error) {
      services.push({
        service: "storage",
        status: "down",
        detail: (error as Error).message
      });
    }

    const mediaHealth = this.app.media?.getHealth();
    if (!mediaHealth) {
      services.push({
        service: "media",
        status: "degraded",
        detail: "Plugin de medios no inicializado"
      });
    } else if (!mediaHealth.enabled) {
      services.push({
        service: "media",
        status: "degraded",
        detail: mediaHealth.detail ?? "Servicio de medios deshabilitado"
      });
    } else if (!mediaHealth.healthy) {
      services.push({
        service: "media",
        status: "down",
        detail: mediaHealth.detail
      });
    } else {
      services.push({
        service: "media",
        status: "up",
        detail: mediaHealth.driver
      });
    }

    const maintenance = await this.app.prisma.maintenanceMode.findUnique({ where: { id: 1 } });

    return {
      now: new Date().toISOString(),
      maintenance: {
        enabled: maintenance?.enabled ?? false,
        message: maintenance?.message ?? null
      },
      services
    };
  }

  async setMaintenance(input: { enabled: boolean; message?: string }) {
    return this.app.prisma.maintenanceMode.upsert({
      where: { id: 1 },
      update: {
        enabled: input.enabled,
        message: input.message ?? null
      },
      create: {
        id: 1,
        enabled: input.enabled,
        message: input.message ?? env.MAINTENANCE_DEFAULT_MESSAGE
      }
    });
  }
}
