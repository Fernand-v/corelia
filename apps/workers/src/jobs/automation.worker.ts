import { Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { connection, notificationsQueue } from "../lib/queues.js";
import { runJobWithTrace } from "../lib/tracing.js";
import { buildAuditTargetCreateData } from "../lib/audit-target.js";
import { createPrismaSchemaGate } from "../lib/schema-readiness.js";

const prisma = new PrismaClient();
const PENDING_ACTIVATION_SCAN_INTERVAL_MS = 60_000;
const ensureTaskLifecycleSchemaReady = createPrismaSchemaGate(prisma, "task lifecycle scheduler", [
  { table: "Task", column: "pendingActivatedAt" },
  { table: "TaskDependency", column: "dependsOnTaskId" },
  { table: "TaskStatusHistory", column: "changedAt" },
  { table: "ProjectMember", column: "roleId" },
  { table: "Notification", column: "event" }
]);
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

const parseConfig = (raw: string | null): Record<string, unknown> => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
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
        reasonCatalogId: "AUTO_PENDING_ACTIVATION",
        changedById: task.createdById,
        changedAt: activatedAt
      }
    });

    const leaders = await prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        role: {
          key: "LIDER_PROYECTO"
        }
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

const runTaskLifecycleActivation = async () => {
  if (!(await ensureTaskLifecycleSchemaReady())) {
    return;
  }

  await activatePendingTasksLifecycle();
};

export const startTaskLifecycleScheduler = () => {
  const timer = setInterval(() => {
    void runTaskLifecycleActivation().catch((error) => {
      console.error("[workers] task lifecycle activation failed", error);
    });
  }, PENDING_ACTIVATION_SCAN_INTERVAL_MS);

  void runTaskLifecycleActivation().catch((error) => {
    console.error("[workers] initial task lifecycle activation failed", error);
  });

  return () => {
    clearInterval(timer);
  };
};

export const handleMissedCallCheck = async (data: Record<string, unknown>) => {
  const meetingId = data.meetingId as string;
  const channelId = data.channelId as string;
  const callType = (data.callType as string) ?? "VIDEO";

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      status: true,
      createdById: true,
      participants: {
        select: { userId: true, joinedAt: true }
      }
    }
  });

  if (!meeting) return;
  if (meeting.status === "FINALIZADA" || meeting.status === "CANCELADA") return;

  const someoneJoined = meeting.participants.some(
    (p) => p.joinedAt !== null && p.userId !== meeting.createdById
  );

  if (someoneJoined) return;

  const label = callType === "VOZ" ? "Llamada de voz perdida" : "Videollamada perdida";

  await prisma.message.create({
    data: {
      channelId,
      authorId: meeting.createdById,
      kind: "LLAMADA_PERDIDA",
      content: label,
      mentions: [],
      meetingId
    }
  });

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "FINALIZADA" }
  });
};

export const automationWorker = new Worker(
  "automations",
  async (job) => {
    if (job.name === "check-missed-call") {
      return runJobWithTrace(
        "worker.missed-call.check",
        (job.data as Record<string, unknown>) ?? {},
        () => handleMissedCallCheck(job.data as Record<string, unknown>)
      );
    }

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
          const ruleConfig = parseConfig(rule.config);

          if (rule.action === "ENVIAR_NOTIFICACION") {
            const userId = firstString(ruleConfig.userId, context.userId);
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
                ...buildAuditTargetCreateData("AUTOMATIZACION", rule.id),
                action: "ACTUALIZAR",
                newDataText: JSON.stringify(context)
              }
            });
          }

          if (rule.action === "CAMBIAR_ESTADO_TAREA") {
            const taskId = firstString(ruleConfig.taskId, context.taskId);
            const status = resolveTaskStatus(ruleConfig.status);
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
