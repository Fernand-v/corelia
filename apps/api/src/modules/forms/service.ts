import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { attachTraceContext } from "../../lib/tracing.js";

export class FormService {
  constructor(private readonly app: FastifyInstance) {}

  private async enqueueNotification(notificationId: string) {
    if (!this.app.queues) {
      return;
    }

    await this.app.queues.notifications.add(
      "send-notification",
      attachTraceContext({
        notificationId
      })
    );
  }

  private async enqueueWebhooks(
    event:
      | "TAREA_COMPLETADA"
      | "SOLICITUD_APROBADA"
      | "SOLICITUD_RECHAZADA"
      | "TAREA_REASIGNADA"
      | "TAREA_VENCIDA",
    payload: Record<string, unknown>
  ) {
    if (!this.app.queues) {
      return;
    }

    const endpoints = await this.app.prisma.webhookEndpoint.findMany({
      where: {
        event,
        enabled: true
      },
      select: { id: true }
    });

    await Promise.all(
      endpoints.map((endpoint) =>
        this.app.queues!.webhooks.add(
          "deliver-webhook",
          attachTraceContext({
            endpointId: endpoint.id,
            payload
          })
        )
      )
    );
  }

  async create(input: {
    requesterId: string;
    type: "VACACIONES" | "PERMISO" | "ACCESO_RECURSO";
    payload: Record<string, unknown>;
  }) {
    return this.app.prisma.formRequest.create({
      data: {
        requesterId: input.requesterId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue
      }
    });
  }

  async resolve(input: {
    requestId: string;
    status: "APROBADA" | "RECHAZADA";
    comment: string;
    approverId: string;
  }) {
    const resolved = await this.app.prisma.formRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.status,
        comment: input.comment,
        approverId: input.approverId
      }
    });

    const notification = await this.app.prisma.notification.create({
      data: {
        userId: resolved.requesterId,
        event: "SOLICITUD_RESUELTA",
        channel: "IN_APP",
        title: `Solicitud ${resolved.status.toLowerCase()}`,
        body: `Tu solicitud ${resolved.id} fue ${resolved.status.toLowerCase()}`
      }
    });

    await this.enqueueNotification(notification.id);

    await this.enqueueWebhooks(
      resolved.status === "APROBADA" ? "SOLICITUD_APROBADA" : "SOLICITUD_RECHAZADA",
      {
        requestId: resolved.id,
        status: resolved.status,
        approverId: resolved.approverId
      }
    );

    const payload = resolved.payload as Prisma.JsonObject;
    const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;
    if (projectId && this.app.queues) {
      await this.app.queues.automations.add(
        "apply-automation",
        attachTraceContext({
          projectId,
          event: "SOLICITUD_RESUELTA",
          context: {
            requestId: resolved.id,
            status: resolved.status,
            requesterId: resolved.requesterId,
            approverId: resolved.approverId
          }
        })
      );
    }

    return resolved;
  }

  async listForUser(userId: string) {
    return this.app.prisma.formRequest.findMany({
      where: {
        OR: [{ requesterId: userId }, { approverId: userId }]
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
