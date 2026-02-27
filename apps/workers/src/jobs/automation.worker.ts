import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { connection, notificationsQueue } from "../lib/queues.js";
import { runJobWithTrace } from "../lib/tracing.js";

const prisma = new PrismaClient();
const taskStatuses = [
  "BACKLOG",
  "PENDIENTE",
  "EN_PROGRESO",
  "EN_REVISION",
  "BLOQUEADA",
  "COMPLETADA",
  "CANCELADA"
] as const;

type TaskStatus = (typeof taskStatuses)[number];

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
};

const resolveTaskStatus = (value: unknown): TaskStatus => {
  if (typeof value === "string" && taskStatuses.includes(value as TaskStatus)) {
    return value as TaskStatus;
  }

  return "EN_REVISION";
};

export const automationWorker = new Worker(
  "automations",
  async (job) => {
    return runJobWithTrace(
      "worker.automations.apply",
      (job.data as Record<string, unknown>) ?? {},
      async () => {
        const { projectId, event, context } = job.data as {
          projectId: string;
          event:
            | "TAREA_COMPLETADA"
            | "TAREA_SIN_MOVIMIENTO"
            | "TAREA_REASIGNADA"
            | "TAREA_VENCIDA"
            | "SOLICITUD_RESUELTA";
          context: Record<string, unknown>;
          _trace?: Record<string, string>;
        };

        const rules = await prisma.automationRule.findMany({
          where: {
            projectId,
            event,
            enabled: true
          }
        });

        for (const rule of rules) {
          if (rule.action === "ENVIAR_NOTIFICACION") {
            const userId = firstString((rule.config as Record<string, unknown>).userId, context.userId);
            if (userId) {
              const notification = await prisma.notification.create({
                data: {
                  userId,
                  event: "TAREA_ESTADO_CAMBIADO",
                  channel: "IN_APP",
                  title: `Automatización: ${rule.name}`,
                  body: JSON.stringify(context)
                }
              });

              await notificationsQueue.add("send-notification", {
                notificationId: notification.id,
                _trace: job.data._trace
              });
            }
          }

          if (rule.action === "CREAR_AUDITORIA") {
            await prisma.auditLog.create({
              data: {
                entityType: "AUTOMATIZACION",
                entityId: rule.id,
                action: "ACTUALIZAR",
                newData: context as never
              }
            });
          }

          if (rule.action === "CAMBIAR_ESTADO_TAREA") {
            const taskId = firstString((rule.config as Record<string, unknown>).taskId, context.taskId);
            const status = resolveTaskStatus((rule.config as Record<string, unknown>).status);
            if (taskId) {
              await prisma.task.update({
                where: { id: taskId },
                data: {
                  status
                }
              });
            }
          }
        }
      }
    );
  },
  {
    connection
  }
);
