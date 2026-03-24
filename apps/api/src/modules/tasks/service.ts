import type { FastifyInstance } from "fastify";
import type { RoleCode, TaskStatus } from "@corelia/types";
import { canReassign, canReopenCompletedTask, resolveRoleKey } from "../../lib/rbac.js";
import { createAndDispatchNotification } from "../../lib/notifications.js";
import { attachTraceContext } from "../../lib/tracing.js";

export class TaskService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";
  private static readonly MANAGER_ROLES: RoleCode[] = [
    "ADMINISTRADOR",
    "LIDER_PROYECTO",
    "COORDINADOR_EQUIPO"
  ];

  constructor(private readonly app: FastifyInstance) {}

  private syncTaskSearch(taskId: string) {
    void this.app.searchIndex?.syncTask(taskId);
  }

  private isManagerRole(role: RoleCode): boolean {
    return TaskService.MANAGER_ROLES.includes(role);
  }

  private normalizeLegacyCode(input: {
    code?: string | null | undefined;
    text?: string | null | undefined;
  }): string | null {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return TaskService.LEGACY_UNMAPPED_CODE;
    }

    return null;
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
      if (entry.code === TaskService.LEGACY_UNMAPPED_CODE) {
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
      throw this.forbidden("No tienes acceso a los miembros de este proyecto");
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

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
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

  private async enqueueAutomation(
    projectId: string,
    event:
      | "TAREA_COMPLETADA"
      | "TAREA_SIN_MOVIMIENTO"
      | "TAREA_REASIGNADA"
      | "TAREA_VENCIDA"
      | "SOLICITUD_RESUELTA",
    context: Record<string, unknown>
  ) {
    if (!this.app.queues) {
      return;
    }

    await this.app.queues.automations.add(
      "apply-automation",
      attachTraceContext({
        projectId,
        event,
        context
      })
    );
  }

  private async ensureReassignmentScope(input: {
    taskProjectId: string;
    currentAssigneeId: string | null;
    newAssigneeId: string;
    requestedById: string;
    activeRole: RoleCode;
    projectContextId?: string | null;
  }) {
    if (input.activeRole === "ADMINISTRADOR") {
      return;
    }

    if (!input.projectContextId || input.projectContextId !== input.taskProjectId) {
      throw this.forbidden("Debes operar en el contexto del proyecto de la tarea");
    }

    const member = await this.app.prisma.projectMember.findFirst({
      where: {
        projectId: input.taskProjectId,
        userId: input.requestedById
      },
      select: {
        role: {
          select: {
            key: true,
            code: true
          }
        }
      }
    });

    if (!member || resolveRoleKey(member.role) !== input.activeRole) {
      throw this.forbidden("No tienes permisos sobre este proyecto para reasignar");
    }

    if (input.activeRole !== "COORDINADOR_EQUIPO") {
      return;
    }

    const coordinatorTeams = await this.app.prisma.teamMember.findMany({
      where: { userId: input.requestedById },
      select: { teamId: true }
    });

    const coordinatorTeamIds = coordinatorTeams.map((team) => team.teamId);
    if (coordinatorTeamIds.length === 0) {
      throw this.forbidden("Coordinador sin equipo asignado no puede reasignar tareas");
    }

    const usersToValidate = [
      input.currentAssigneeId ?? undefined,
      input.newAssigneeId
    ].filter((userId): userId is string => Boolean(userId));

    const teamMemberships = await this.app.prisma.teamMember.findMany({
      where: {
        userId: { in: usersToValidate },
        teamId: { in: coordinatorTeamIds }
      },
      select: { userId: true }
    });

    const usersInCoordinatorTeams = new Set(teamMemberships.map((membership) => membership.userId));
    const outsideTeam = usersToValidate.some((userId) => !usersInCoordinatorTeams.has(userId));

    if (outsideTeam) {
      throw this.forbidden("Coordinador solo puede reasignar tareas entre miembros de su equipo");
    }
  }

  private async validateAssigneeAvailability(input: {
    assigneeId: string;
    assignAt: Date;
    confirmOutOfSchedule: boolean;
  }) {
    const block = await this.app.prisma.availabilityBlock.findFirst({
      where: {
        userId: input.assigneeId,
        startAt: { lte: input.assignAt },
        endAt: { gte: input.assignAt },
        type: { in: ["VACACIONES", "AUSENCIA"] }
      }
    });

    if (block) {
      throw new Error("El usuario está en vacaciones o ausencia y no puede recibir tareas");
    }

    const schedule = await this.app.prisma.workSchedule.findUnique({
      where: { userId: input.assigneeId }
    });

    if (!schedule) {
      return;
    }

    const day = input.assignAt.getDay();
    const hhmm = `${String(input.assignAt.getHours()).padStart(2, "0")}:${String(
      input.assignAt.getMinutes()
    ).padStart(2, "0")}`;

    const inDay = schedule.weekDays.includes(day);
    const inHour = hhmm >= schedule.startHour && hhmm <= schedule.endHour;

    if ((!inDay || !inHour) && !input.confirmOutOfSchedule) {
      throw new Error("Asignación fuera de jornada laboral. Requiere confirmación explícita");
    }

    const activeTasks = await this.app.prisma.task.count({
      where: {
        assigneeId: input.assigneeId,
        status: {
          in: ["PENDIENTE", "EN_REVISION"]
        }
      }
    });

    if (activeTasks >= schedule.maxActiveTasks) {
      throw new Error("El usuario alcanzó su límite de tareas activas");
    }
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
      await this.validateAssigneeAvailability({
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
  }) {
    const task = await this.app.prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    if (task.status === input.status) {
      return task;
    }

    const isManager = this.isManagerRole(input.activeRole);
    const isAssignee = task.assigneeId === input.changedById;

    const transition = `${task.status}->${input.status}`;
    const allowedTransition =
      (transition === "PENDIENTE->EN_REVISION" && (isAssignee || isManager)) ||
      (transition === "EN_REVISION->COMPLETADA" && isManager) ||
      (transition === "EN_REVISION->PENDIENTE" && isManager) ||
      (transition === "COMPLETADA->PENDIENTE" && isManager);

    if (!allowedTransition) {
      throw this.forbidden("Transición de estado no permitida para tu rol");
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
      await this.enqueueWebhooks("TAREA_COMPLETADA", {
        taskId: updated.id,
        projectId: updated.projectId,
        changedById: input.changedById
      });

      await this.enqueueAutomation(updated.projectId, "TAREA_COMPLETADA", {
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
  }) {
    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId }
    });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

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
  }) {
    if (!this.isManagerRole(input.activeRole)) {
      throw this.forbidden("Solo administrador, líder o coordinador pueden activar tareas manualmente");
    }

    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId }
    });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

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
  }) {
    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId }
    });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    const canManageForeignTask = ["ADMINISTRADOR", "LIDER_PROYECTO", "COORDINADOR_EQUIPO"].includes(
      input.activeRole
    );
    if (task.assigneeId && task.assigneeId !== input.changedById && !canManageForeignTask) {
      throw this.forbidden("No puedes finalizar una tarea asignada a otro usuario");
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
    projectContextId?: string | null;
  }) {
    if (!canReassign(input.activeRole)) {
      throw new Error("No tienes permiso para reasignar esta tarea");
    }

    const task = await this.app.prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    await this.ensureReassignmentScope({
      taskProjectId: task.projectId,
      currentAssigneeId: task.assigneeId,
      newAssigneeId: input.newAssigneeId,
      requestedById: input.requestedById,
      activeRole: input.activeRole,
      ...(input.projectContextId !== undefined
        ? { projectContextId: input.projectContextId }
        : {})
    });

    if (task.status === "COMPLETADA") {
      if (!input.reopenIfCompleted) {
        throw this.forbidden("No se puede reasignar una tarea completada sin reapertura autorizada");
      }
      if (!canReopenCompletedTask(input.activeRole)) {
        throw this.forbidden("Solo Líder o Administrador pueden reabrir tareas completadas");
      }
    }

    await this.validateAssigneeAvailability({
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

    await this.enqueueWebhooks("TAREA_REASIGNADA", {
      taskId: task.id,
      projectId: task.projectId,
      previousAssigneeId: task.assigneeId,
      newAssigneeId: input.newAssigneeId,
      reassignedById: input.requestedById
    });

    await this.enqueueAutomation(task.projectId, "TAREA_REASIGNADA", {
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
