import { Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { connection, notificationsQueue } from "../lib/queues.js";
import { runJobWithTrace } from "../lib/tracing.js";

const prisma = new PrismaClient();
const PENDING_ACTIVATION_SCAN_INTERVAL_MS = 60_000;
const taskStatuses = [
  "PENDIENTE",
  "EN_REVISION",
  "COMPLETADA"
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

const activatePendingTasksLifecycle = async () => {
  const now = new Date();
  const candidates = await prisma.task.findMany({
    where: {
      status: "PENDIENTE",
      pendingActivatedAt: null,
      OR: [
        {
          startDate: {
            lte: now
          }
        },
        {
          AND: [
            {
              dependencies: {
                some: {}
              }
            },
            {
              dependencies: {
                every: {
                  dependsOnTask: {
                    status: "COMPLETADA"
                  }
                }
              }
            }
          ]
        }
      ]
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      assigneeId: true,
      createdById: true
    }
  });

  for (const task of candidates) {
    const activatedAt = new Date();
    const updated = await prisma.task.updateMany({
      where: {
        id: task.id,
        pendingActivatedAt: null
      },
      data: {
        pendingActivatedAt: activatedAt
      }
    });

    if (updated.count === 0) {
      continue;
    }

    await prisma.taskStatusHistory.create({
      data: {
        id: randomUUID(),
        taskId: task.id,
        fromStatus: "PENDIENTE",
        toStatus: "PENDIENTE",
        reason: "Activación automática por fecha de inicio o tarea previa completada",
        reasonCode: "AUTO_PENDING_ACTIVATION",
        changedById: task.createdById,
        changedAt: activatedAt
      }
    });

    const leaders = await prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        role: "LIDER_PROYECTO"
      },
      select: {
        userId: true
      }
    });

    const recipients = new Set<string>(leaders.map((leader: { userId: string }) => leader.userId));
    if (task.assigneeId) {
      recipients.add(task.assigneeId);
    }

    for (const userId of recipients) {
      const notification = await prisma.notification.create({
        data: {
          userId,
          event: "TAREA_ESTADO_CAMBIADO",
          channel: "IN_APP",
          title: "Tarea activada automáticamente",
          body: `La tarea ${task.title} quedó activa en pendiente.`
        }
      });

      await notificationsQueue.add("send-notification", {
        notificationId: notification.id
      });
    }
  }
};

export const startTaskLifecycleScheduler = () => {
  const timer = setInterval(() => {
    void activatePendingTasksLifecycle().catch((error) => {
      console.error("[workers] task lifecycle activation failed", error);
    });
  }, PENDING_ACTIVATION_SCAN_INTERVAL_MS);

  void activatePendingTasksLifecycle().catch((error) => {
    console.error("[workers] initial task lifecycle activation failed", error);
  });

  return () => {
    clearInterval(timer);
  };
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
