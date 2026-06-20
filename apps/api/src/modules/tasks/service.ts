import type { FastifyInstance } from "fastify";
import type { RoleCode, TaskStatus } from "@corelia/types";
import { canReassign, canReopenCompletedTask, isManagerOrAbove, resolveRoleKey } from "../../lib/rbac.js";
import { createAndDispatchNotification } from "../../lib/notifications.js";
import {
  canManageTaskProject,
  ensureProjectContext,
  forbidden,
  LEGACY_UNMAPPED_CODE
} from "./task-helpers.js";
import { TaskOperationsService } from "./task-operations-service.js";

export class TaskService {
  private readonly ops: TaskOperationsService;

  constructor(private readonly app: FastifyInstance) {
    this.ops = new TaskOperationsService(this.app);
  }

  private syncTaskSearch(taskId: string) {
    void this.app.searchIndex?.syncTask(taskId);
  }

  private async resolveTaskCodeLabels(entries: Array<{ field: string; code: string | null | undefined }>) {
    const uniqueCodes = [
      ...new Set(entries.map((entry) => entry.code).filter((code): code is string => Boolean(code)))
    ];
    if (uniqueCodes.length === 0) {
      return new Map<string, string>();
    }

    const catalogs = await this.app.prisma.taskCodeCatalog.findMany({
      where: {
        key: { in: uniqueCodes }
      },
      select: {
        field: true,
        key: true,
        label: true
      }
    });

    const labels = new Map<string, string>();
    for (const catalog of catalogs) {
      labels.set(`${catalog.field}:${catalog.key}`, catalog.label);
    }

    for (const entry of entries) {
      if (entry.code === LEGACY_UNMAPPED_CODE) {
        labels.set(`${entry.field}:${entry.code}`, "Descripción heredada");
      }
    }

    return labels;
  }

  async listTasks(
    userId: string,
    filters?: {
      projectId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const admin = await this.app.prisma.user.findFirst({
      where: {
        id: userId,
        baseRole: {
          is: {
            key: "ADMINISTRADOR"
          }
        }
      },
      select: { id: true }
    });

    const dueDateRange =
      filters?.dateFrom || filters?.dateTo
        ? {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {})
          }
        : undefined;

    const tasks = await this.app.prisma.task.findMany({
      where: {
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(dueDateRange ? { dueDate: dueDateRange } : {}),
        ...(admin
          ? {}
          : {
              OR: [
                { assigneeId: userId },
                { createdById: userId },
                { project: { members: { some: { userId } } } }
              ]
            })
      },
      include: {
        stage: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        assignee: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const labels = await this.resolveTaskCodeLabels(
      tasks.flatMap((task) => [
        { field: "TASK_DESCRIPTION", code: task.descriptionCatalogId },
        { field: "TASK_BLOCKED_REASON", code: task.blockedReasonCatalogId }
      ])
    );

    return tasks.map((task) => ({
      ...task,
      stageCode: task.stage?.code ?? null,
      stageName: task.stage?.name ?? null,
      stageColor: task.stage?.color ?? null,
      descriptionLabel: task.descriptionCatalogId
        ? labels.get(`TASK_DESCRIPTION:${task.descriptionCatalogId}`) ?? task.descriptionCatalogId
        : null,
      blockedReasonLabel: task.blockedReasonCatalogId
        ? labels.get(`TASK_BLOCKED_REASON:${task.blockedReasonCatalogId}`) ?? task.blockedReasonCatalogId
        : null,
      createdByName: `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim(),
      assigneeName: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}`.trim() : null
    }));
  }

  async listProjectMembers(userId: string, projectId: string) {
    const [project, admin] = await Promise.all([
      this.app.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          ownerId: true,
          members: {
            where: { userId },
            select: { userId: true }
          }
        }
      }),
      this.app.prisma.user.findFirst({
        where: {
          id: userId,
          baseRole: {
            is: {
              key: "ADMINISTRADOR"
            }
          }
        },
        select: { id: true }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    const hasAccess = Boolean(admin) || project.ownerId === userId || project.members.length > 0;
    if (!hasAccess) {
      throw forbidden("No tienes acceso a los miembros de este proyecto");
    }

    const members = await this.app.prisma.projectMember.findMany({
      where: {
        projectId
      },
      include: {
        role: {
          select: {
            key: true,
            code: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            workSchedule: {
              select: {
                maxActiveTasks: true
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    const memberIds = members.map((member) => member.userId);
    if (memberIds.length === 0) {
      return [];
    }

    const now = new Date();
    const [availabilityNow, meetingsNow, activeTaskCounts] = await Promise.all([
      this.app.prisma.availabilityBlock.findMany({
        where: {
          userId: { in: memberIds },
          startAt: { lte: now },
          endAt: { gte: now },
          type: { in: ["VACACIONES", "AUSENCIA"] }
        },
        select: { userId: true }
      }),
      this.app.prisma.meetingParticipant.findMany({
        where: {
          userId: { in: memberIds },
          meeting: {
            startsAt: { lte: now },
            endsAt: { gte: now },
            status: { in: ["PROGRAMADA", "EN_CURSO"] }
          }
        },
        select: { userId: true }
      }),
      this.app.prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: memberIds },
          status: {
            in: ["PENDIENTE", "EN_REVISION"]
          }
        },
        _count: { _all: true }
      })
    ]);

    const unavailable = new Set(availabilityNow.map((row) => row.userId));
    const inMeeting = new Set(meetingsNow.map((row) => row.userId));
    const activeByUser = new Map(
      activeTaskCounts
        .filter((row): row is typeof row & { assigneeId: string } => Boolean(row.assigneeId))
        .map((row) => [row.assigneeId, row._count._all])
    );

    return members.map((member) => {
      const fullName = `${member.user.firstName} ${member.user.lastName}`.trim();
      const initials = `${member.user.firstName.charAt(0)}${member.user.lastName.charAt(0)}`.toUpperCase();
      const activeTasks = activeByUser.get(member.userId) ?? 0;
      const maxActiveTasks = member.user.workSchedule?.maxActiveTasks ?? 5;
      const availability: "DISPONIBLE" | "OCUPADO" | "EN_REUNION" | "AUSENTE" = unavailable.has(
        member.userId
      )
        ? "AUSENTE"
        : inMeeting.has(member.userId)
          ? "EN_REUNION"
          : activeTasks > 0
            ? "OCUPADO"
            : "DISPONIBLE";

      return {
        userId: member.userId,
        fullName,
        initials,
        availability,
        activeTasks,
        maxActiveTasks,
        overloaded: maxActiveTasks > 0 ? activeTasks >= maxActiveTasks : false,
        role: resolveRoleKey(member.role) ?? "INVITADO_EXTERNO"
      };
    });
  }


  async createTask(input: {
    projectId: string;
    stageId?: string;
    title: string;
    description?: string;
    descriptionCatalogId?: string;
    assigneeId?: string;
    startDate?: string;
    dueDate?: string;
    status: TaskStatus;
    createdById: string;
    confirmOutOfSchedule: boolean;
  }) {
    if (input.stageId) {
      const stage = await this.app.prisma.projectStage.findUnique({
        where: { id: input.stageId },
        select: { id: true, projectId: true }
      });
      if (!stage || stage.projectId !== input.projectId) {
        throw new Error("La etapa seleccionada no pertenece al proyecto");
      }
    }

    if (input.assigneeId) {
      await this.ops.validateAssigneeAvailability({
        assigneeId: input.assigneeId,
        assignAt: new Date(),
        confirmOutOfSchedule: input.confirmOutOfSchedule
      });
    }

    const now = new Date();
    const parsedStartDate = input.startDate ? new Date(input.startDate) : null;
    const pendingActivatedAt =
      input.status === "COMPLETADA" ||
      input.status === "EN_REVISION" ||
      !parsedStartDate ||
      parsedStartDate.getTime() <= now.getTime()
        ? now
        : null;

    const task = await this.app.prisma.task.create({
      data: {
        projectId: input.projectId,
        stageId: input.stageId ?? null,
        title: input.title,
        description: input.description ?? null,
        descriptionCatalogId: input.descriptionCatalogId ?? null,
        assigneeId: input.assigneeId ?? null,
        startDate: parsedStartDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: input.status,
        pendingActivatedAt,
        createdById: input.createdById
      }
    });

    if (task.assigneeId) {
      await createAndDispatchNotification(this.app, {
        userId: task.assigneeId,
        event: "TAREA_ASIGNADA",
        title: "Nueva tarea asignada",
        body: `Se te asignó la tarea ${task.title}`,
        groupKey: `task:assign:${task.id}`
      });
    }

    this.syncTaskSearch(task.id);
    return task;
  }

  async getTask(taskId: string) {
    const task = await this.app.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        stage: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        dependencies: true,
        dependents: true,
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { changedAt: "desc" }
        },
        reassignments: {
          include: {
            reassignedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { reassignedAt: "desc" }
        },
        scheduleHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { changedAt: "desc" }
        }
      }
    });

    if (!task) {
      return null;
    }

    const labels = await this.resolveTaskCodeLabels([
      { field: "TASK_DESCRIPTION", code: task.descriptionCatalogId },
      { field: "TASK_BLOCKED_REASON", code: task.blockedReasonCatalogId },
      ...(task.statusHistory ?? []).map((entry) => ({
        field: "TASK_STATUS_REASON",
        code: entry.reasonCatalogId
      })),
      ...(task.reassignments ?? []).map((entry) => ({
        field: "TASK_REASSIGN_REASON",
        code: entry.reasonCatalogId
      })),
      ...(task.scheduleHistory ?? []).map((entry) => ({
        field: "TASK_SCHEDULE_REASON",
        code: entry.reasonCatalogId
      }))
    ]);

    return {
      ...task,
      descriptionLabel: task.descriptionCatalogId
        ? labels.get(`TASK_DESCRIPTION:${task.descriptionCatalogId}`) ?? task.descriptionCatalogId
        : null,
      blockedReasonLabel: task.blockedReasonCatalogId
        ? labels.get(`TASK_BLOCKED_REASON:${task.blockedReasonCatalogId}`) ?? task.blockedReasonCatalogId
        : null,
      statusHistory: (task.statusHistory ?? []).map((entry) => ({
        ...entry,
        reasonLabel: entry.reasonCatalogId
          ? labels.get(`TASK_STATUS_REASON:${entry.reasonCatalogId}`) ?? entry.reasonCatalogId
          : null
      })),
      reassignments: (task.reassignments ?? []).map((entry) => ({
        ...entry,
        reasonLabel: entry.reasonCatalogId
          ? labels.get(`TASK_REASSIGN_REASON:${entry.reasonCatalogId}`) ?? entry.reasonCatalogId
          : null
      })),
      scheduleHistory: (task.scheduleHistory ?? []).map((entry) => ({
        ...entry,
        reasonLabel: entry.reasonCatalogId
          ? labels.get(`TASK_SCHEDULE_REASON:${entry.reasonCatalogId}`) ?? entry.reasonCatalogId
          : null
      }))
    };
  }

  async changeStatus(input: {
    taskId: string;
    status: TaskStatus;
    reason: string;
    reasonCatalogId?: string;
    blockingTaskId?: string;
    blockedReason?: string;
    blockedReasonCatalogId?: string;
    changedById: string;
    activeRole: RoleCode;
    activeRoleRank: number;
    projectContextId?: string | null;
  }) {
    const task = await this.app.prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    if (task.status === input.status) {
      return task;
    }

    const transition = `${task.status}->${input.status}`;
    const isAssignee = task.assigneeId === input.changedById;
    const requiresManager =
      (transition === "PENDIENTE->EN_REVISION" && !isAssignee) ||
      transition === "EN_REVISION->COMPLETADA" ||
      transition === "EN_REVISION->PENDIENTE" ||
      transition === "COMPLETADA->PENDIENTE";
    const isManager = requiresManager
      ? canManageTaskProject({
          taskProjectId: task.projectId,
          activeRoleRank: input.activeRoleRank,
          ...(input.projectContextId !== undefined ? { projectContextId: input.projectContextId } : {})
        })
      : false;
    const allowedTransition =
      (transition === "PENDIENTE->EN_REVISION" && (isAssignee || isManager)) ||
      (transition === "EN_REVISION->COMPLETADA" && isManager) ||
      (transition === "EN_REVISION->PENDIENTE" && isManager) ||
      (transition === "COMPLETADA->PENDIENTE" && isManager);

    if (!allowedTransition) {
      throw forbidden("Transición de estado no permitida para tu rol");
    }

    const now = new Date();
    const updated = await this.app.prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        pendingActivatedAt:
          input.status === "PENDIENTE" || input.status === "EN_REVISION" || input.status === "COMPLETADA"
            ? now
            : null,
        blockingTaskId: null,
        blockedReason: null,
        blockedReasonCatalogId: null,
        completedAt: input.status === "COMPLETADA" ? now : null
      }
    });

    await this.app.prisma.taskStatusHistory.create({
      data: {
        taskId: input.taskId,
        fromStatus: task.status,
        toStatus: input.status,
        reason: input.reason,
        reasonCatalogId: input.reasonCatalogId ?? null,
        changedById: input.changedById
      }
    });

    if (updated.assigneeId) {
      await createAndDispatchNotification(this.app, {
        userId: updated.assigneeId,
        event: "TAREA_ESTADO_CAMBIADO",
        title: "Cambio de estado de tarea",
        body: `La tarea ${updated.title} cambió a ${updated.status}`,
        groupKey: `task:status:${updated.id}`
      });
    }

    if (updated.status === "COMPLETADA") {
      await this.ops.enqueueWebhooks("TAREA_COMPLETADA", {
        taskId: updated.id,
        projectId: updated.projectId,
        changedById: input.changedById
      });

      await this.ops.enqueueAutomation(updated.projectId, "TAREA_COMPLETADA", {
        taskId: updated.id,
        projectId: updated.projectId,
        userId: updated.assigneeId,
        changedById: input.changedById
      });
    }

    this.syncTaskSearch(updated.id);
    return updated;
  }

  async addDependency(input: { taskId: string; dependsOnTaskId: string }) {
    if (input.taskId === input.dependsOnTaskId) {
      throw new Error("Una tarea no puede depender de sí misma");
    }

    const task = await this.app.prisma.task.findUnique({ where: { id: input.taskId } });
    const dependency = await this.app.prisma.task.findUnique({ where: { id: input.dependsOnTaskId } });

    if (!task || !dependency) {
      throw new Error("Tarea o dependencia inexistente");
    }

    return this.app.prisma.taskDependency.create({
      data: input
    });
  }

  async canStart(taskId: string) {
    const unresolvedDependencies = await this.app.prisma.taskDependency.findMany({
      where: {
        taskId,
        dependsOnTask: {
          status: {
            not: "COMPLETADA"
          }
        }
      },
      select: {
        dependsOnTaskId: true
      }
    });

    return {
      canStart: unresolvedDependencies.length === 0,
      unresolvedDependencies: unresolvedDependencies.map((item) => item.dependsOnTaskId),
      message:
        unresolvedDependencies.length === 0
          ? "La tarea puede iniciar"
          : "Existen dependencias no resueltas"
    };
  }

  async updateSchedule(input: {
    taskId: string;
    startDate?: string | null;
    dueDate?: string | null;
    reason: string;
    reasonCatalogId?: string;
    changedById: string;
    activeRoleRank: number;
    projectContextId?: string | null;
  }) {
    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId }
    });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    ensureProjectContext({
      taskProjectId: task.projectId,
      activeRoleRank: input.activeRoleRank,
      ...(input.projectContextId !== undefined ? { projectContextId: input.projectContextId } : {})
    });

    const startDate =
      input.startDate === undefined ? task.startDate : input.startDate ? new Date(input.startDate) : null;
    const dueDate =
      input.dueDate === undefined ? task.dueDate : input.dueDate ? new Date(input.dueDate) : null;

    if (startDate && dueDate && startDate.getTime() > dueDate.getTime()) {
      throw new Error("La fecha desde no puede ser mayor que la fecha hasta");
    }

    const updated = await this.app.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: input.taskId },
        data: {
          startDate,
          dueDate
        }
      });

      await tx.taskScheduleHistory.create({
        data: {
          taskId: task.id,
          previousStartDate: task.startDate,
          previousDueDate: task.dueDate,
          newStartDate: startDate,
          newDueDate: dueDate,
          reason: input.reason,
          reasonCatalogId: input.reasonCatalogId ?? null,
          changedById: input.changedById
        }
      });

      return updated;
    });

    this.syncTaskSearch(updated.id);
    return updated;
  }

  async activateTask(input: {
    taskId: string;
    reason: string;
    reasonCatalogId?: string;
    changedById: string;
    activeRole: RoleCode;
    activeRoleRank: number;
    projectContextId?: string | null;
  }) {
    if (!isManagerOrAbove(input.activeRoleRank)) {
      throw forbidden("Solo administrador, líder o coordinador pueden activar tareas manualmente");
    }

    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId }
    });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    ensureProjectContext({
      taskProjectId: task.projectId,
      activeRoleRank: input.activeRoleRank,
      ...(input.projectContextId !== undefined ? { projectContextId: input.projectContextId } : {})
    });

    const canActivateHiddenPending = task.status === "PENDIENTE" && task.pendingActivatedAt === null;
    const allowedFrom = new Set<TaskStatus>(["EN_REVISION", "COMPLETADA"]);
    if (!canActivateHiddenPending && !allowedFrom.has(task.status)) {
      return task;
    }

    const updated = await this.app.prisma.task.update({
      where: { id: task.id },
      data: {
        status: "PENDIENTE",
        pendingActivatedAt: new Date(),
        blockingTaskId: null,
        blockedReason: null
      }
    });

    await this.app.prisma.taskStatusHistory.create({
      data: {
        taskId: task.id,
        fromStatus: task.status,
        toStatus: "PENDIENTE",
        reason: input.reason,
        reasonCatalogId: input.reasonCatalogId ?? null,
        changedById: input.changedById
      }
    });

    const leaders = await this.app.prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        role: {
          is: {
            key: "LIDER_PROYECTO"
          }
        }
      },
      select: { userId: true }
    });

    const recipients = new Set<string>(leaders.map((leader) => leader.userId));
    if (task.assigneeId) {
      recipients.add(task.assigneeId);
    }

    await Promise.all(
      Array.from(recipients).map((userId) =>
        createAndDispatchNotification(this.app, {
          userId,
          event: "TAREA_ESTADO_CAMBIADO",
          title: "Tarea activada manualmente",
          body: `La tarea ${task.title} fue activada y ahora está en PENDIENTE`,
          groupKey: `task:status:${task.id}`
        })
      )
    );

    this.syncTaskSearch(updated.id);
    return updated;
  }

  async finalizeAndAdvance(input: {
    taskId: string;
    reason?: string;
    reasonCatalogId?: string;
    changedById: string;
    activeRole: RoleCode;
    activeRoleRank: number;
    projectContextId?: string | null;
  }) {
    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId }
    });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    const isAssignee = task.assigneeId === input.changedById;
    const canManageForeignTask = !isAssignee
      ? canManageTaskProject({
          taskProjectId: task.projectId,
          activeRoleRank: input.activeRoleRank,
          ...(input.projectContextId !== undefined ? { projectContextId: input.projectContextId } : {})
        })
      : false;
    if (!isAssignee && !canManageForeignTask) {
      throw forbidden("No puedes finalizar una tarea asignada a otro usuario");
    }

    const statusPriority: Record<string, number> = {
      PENDIENTE: 0,
      EN_REVISION: 1
    };

    const reason = input.reason?.trim() || "Finalización desde Mis Tareas";
    const reasonCatalogId = input.reasonCatalogId ?? null;

    const { completedTask, nextTask } = await this.app.prisma.$transaction(async (tx) => {
      const completedTask =
        task.status === "COMPLETADA"
          ? task
          : await tx.task.update({
              where: { id: task.id },
              data: {
                status: "COMPLETADA",
                completedAt: new Date(),
                pendingActivatedAt: new Date(),
                blockingTaskId: null,
                blockedReason: null
              }
            });

      if (task.status !== "COMPLETADA") {
        await tx.taskStatusHistory.create({
          data: {
            taskId: task.id,
            fromStatus: task.status,
            toStatus: "COMPLETADA",
            reason,
            reasonCatalogId,
            changedById: input.changedById
          }
        });
      }

      const candidates = await tx.task.findMany({
        where: {
          projectId: task.projectId,
          id: { not: task.id },
          status: { in: ["PENDIENTE", "EN_REVISION"] }
        },
        orderBy: [{ createdAt: "asc" }]
      });

      const nextCandidate = candidates.sort((a, b) => {
        const priorityDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) {
          return aDue - bDue;
        }

        return a.createdAt.getTime() - b.createdAt.getTime();
      })[0];

      if (!nextCandidate) {
        return {
          completedTask,
          nextTask: null
        };
      }

      const needsActivation = nextCandidate.status === "PENDIENTE" && nextCandidate.pendingActivatedAt === null;
      const nextTask = needsActivation
        ? await tx.task.update({
            where: { id: nextCandidate.id },
            data: {
              pendingActivatedAt: new Date(),
              completedAt: null
            }
          })
        : nextCandidate;

      if (needsActivation) {
        await tx.taskStatusHistory.create({
          data: {
            taskId: nextTask.id,
            fromStatus: "PENDIENTE",
            toStatus: "PENDIENTE",
            reason: "Avance automático por finalización de tarea previa",
            reasonCatalogId: "AUTO_ADVANCE",
            changedById: input.changedById
          }
        });
      }

      return {
        completedTask,
        nextTask
      };
    });

    let notificationsSent = 0;
    if (nextTask) {
      const leaders = await this.app.prisma.projectMember.findMany({
        where: {
          projectId: nextTask.projectId,
          role: {
            is: {
              key: "LIDER_PROYECTO"
            }
          }
        },
        select: { userId: true }
      });

      const recipients = new Set<string>(leaders.map((leader) => leader.userId));
      if (nextTask.assigneeId) {
        recipients.add(nextTask.assigneeId);
      }

      await Promise.all(
        Array.from(recipients).map((userId) =>
          createAndDispatchNotification(this.app, {
            userId,
            event: "TAREA_ESTADO_CAMBIADO",
            title: "Siguiente tarea activada",
            body: `Se activó la tarea ${nextTask.title} en ${nextTask.status}`,
            groupKey: `task:status:${nextTask.id}`
          })
        )
      );
      notificationsSent = recipients.size;
    }

    this.syncTaskSearch(completedTask.id);
    if (nextTask) {
      this.syncTaskSearch(nextTask.id);
    }

    return {
      completedTask,
      nextTask,
      notificationsSent
    };
  }

  async reassign(input: {
    taskId: string;
    newAssigneeId: string;
    reason: string;
    reasonCatalogId?: string;
    reopenIfCompleted: boolean;
    requestedById: string;
    activeRole: RoleCode;
    activeRoleRank: number;
    projectContextId?: string | null;
  }) {
    if (!canReassign(input.activeRoleRank)) {
      throw new Error("No tienes permiso para reasignar esta tarea");
    }

    const task = await this.app.prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    await this.ops.ensureReassignmentScope({
      taskProjectId: task.projectId,
      currentAssigneeId: task.assigneeId,
      newAssigneeId: input.newAssigneeId,
      requestedById: input.requestedById,
      activeRoleRank: input.activeRoleRank,
      ...(input.projectContextId !== undefined
        ? { projectContextId: input.projectContextId }
        : {})
    });

    if (task.status === "COMPLETADA") {
      if (!input.reopenIfCompleted) {
        throw forbidden("No se puede reasignar una tarea completada sin reapertura autorizada");
      }
      if (!canReopenCompletedTask(input.activeRoleRank)) {
        throw forbidden("Solo Líder o Administrador pueden reabrir tareas completadas");
      }
    }

    await this.ops.validateAssigneeAvailability({
      assigneeId: input.newAssigneeId,
      assignAt: new Date(),
      confirmOutOfSchedule: true
    });

    const updated = await this.app.prisma.$transaction(async (tx) => {
      const newStatus =
        task.status === "COMPLETADA" && input.reopenIfCompleted ? "PENDIENTE" : task.status;

      const nextTask = await tx.task.update({
        where: { id: input.taskId },
        data: {
          assigneeId: input.newAssigneeId,
          status: newStatus,
          pendingActivatedAt: newStatus === "PENDIENTE" ? new Date() : task.pendingActivatedAt,
          completedAt: newStatus === "COMPLETADA" ? task.completedAt : null
        }
      });

      await tx.taskReassignment.create({
        data: {
          taskId: input.taskId,
          previousAssigneeId: task.assigneeId,
          newAssigneeId: input.newAssigneeId,
          reason: input.reason,
          reasonCatalogId: input.reasonCatalogId ?? null,
          reassignedById: input.requestedById
        }
      });

      if (task.status === "COMPLETADA" && input.reopenIfCompleted) {
        await tx.taskStatusHistory.create({
          data: {
            taskId: task.id,
            fromStatus: "COMPLETADA",
            toStatus: "PENDIENTE",
            reason: "Reapertura autorizada para reasignación",
            reasonCatalogId: "REOPEN_REASSIGN",
            changedById: input.requestedById
          }
        });
      }

      return nextTask;
    });

    const leaders = await this.app.prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        role: {
          is: {
            key: "LIDER_PROYECTO"
          }
        }
      },
      select: { userId: true }
    });

    const recipients = new Set<string>([
      input.newAssigneeId,
      ...leaders.map((leader) => leader.userId),
      ...(task.assigneeId ? [task.assigneeId] : [])
    ]);

    await Promise.all(
      Array.from(recipients).map((userId) =>
        createAndDispatchNotification(this.app, {
          userId,
          event: "TAREA_REASIGNADA",
          title: "Tarea reasignada",
          body: `La tarea ${task.title} cambió de responsable`,
          groupKey: `task:reassign:${task.id}`
        })
      )
    );

    await this.ops.enqueueWebhooks("TAREA_REASIGNADA", {
      taskId: task.id,
      projectId: task.projectId,
      previousAssigneeId: task.assigneeId,
      newAssigneeId: input.newAssigneeId,
      reassignedById: input.requestedById
    });

    await this.ops.enqueueAutomation(task.projectId, "TAREA_REASIGNADA", {
      taskId: task.id,
      projectId: task.projectId,
      previousAssigneeId: task.assigneeId,
      newAssigneeId: input.newAssigneeId,
      requestedById: input.requestedById
    });

    this.syncTaskSearch(updated.id);
    return updated;
  }
}
