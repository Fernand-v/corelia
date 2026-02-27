import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

export class AutomationService {
  constructor(private readonly app: FastifyInstance) {}

  async create(input: {
    projectId: string;
    name: string;
    event: "TAREA_COMPLETADA" | "TAREA_SIN_MOVIMIENTO" | "TAREA_REASIGNADA" | "TAREA_VENCIDA" | "SOLICITUD_RESUELTA";
    action: "ENVIAR_NOTIFICACION" | "CREAR_AUDITORIA" | "CAMBIAR_ESTADO_TAREA";
    config: Record<string, unknown>;
    enabled: boolean;
    createdById: string;
  }) {
    return this.app.prisma.automationRule.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        event: input.event,
        action: input.action,
        config: input.config as Prisma.InputJsonValue,
        enabled: input.enabled,
        createdById: input.createdById
      }
    });
  }

  async list(projectId: string) {
    return this.app.prisma.automationRule.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  }
}
