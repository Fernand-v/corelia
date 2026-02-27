import type { FastifyInstance } from "fastify";
import type { SystemRole } from "@corelia/types";
import { canReassign, canReopenCompletedTask } from "../../lib/rbac.js";
import { createAndDispatchNotification } from "../../lib/notifications.js";
import { attachTraceContext } from "../../lib/tracing.js";

export class TaskService {
  constructor(private readonly app: FastifyInstance) {}

  async listTasks(userId: string, projectId?: string) {
    return this.app.prisma.task.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { project: { members: { some: { userId } } } }
        ]
      },
      orderBy: {
        createdAt: "desc"
      }
    });
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
          baseRole: "ADMINISTRADOR"
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
            in: ["BACKLOG", "PENDIENTE", "EN_PROGRESO", "EN_REVISION", "BLOQUEADA"]
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
        role: member.role
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
    activeRole: SystemRole;
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
      select: { role: true }
    });

    if (!member || member.role !== input.activeRole) {
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
          in: ["BACKLOG", "PENDIENTE", "EN_PROGRESO", "EN_REVISION", "BLOQUEADA"]
        }
      }
    });

    if (activeTasks >= schedule.maxActiveTasks) {
      throw new Error("El usuario alcanzó su límite de tareas activas");
    }
  }

  async createTask(input: {
    projectId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    status: "BACKLOG" | "PENDIENTE" | "EN_PROGRESO" | "EN_REVISION" | "BLOQUEADA" | "COMPLETADA" | "CANCELADA";
    createdById: string;
    confirmOutOfSchedule: boolean;
  }) {
    if (input.assigneeId) {
      await this.validateAssigneeAvailability({
        assigneeId: input.assigneeId,
        assignAt: new Date(),
        confirmOutOfSchedule: input.confirmOutOfSchedule
      });
    }

    const task = await this.app.prisma.task.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: input.status,
        createdById: input.createdById
      }
    });

    if (task.assigneeId) {
      await createAndDispatchNotification(this.app, {
        userId: task.assigneeId,
        event: "TAREA_ASIGNADA",
        title: "Nueva tarea asignada",
        body: `Se te asignó la tarea ${task.title}`
      });
    }

    return task;
  }

  async getTask(taskId: string) {
    return this.app.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dependencies: true,
        dependents: true,
        statusHistory: {
          orderBy: { changedAt: "desc" }
        },
        reassignments: {
          orderBy: { reassignedAt: "desc" }
        }
      }
    });
  }

  async changeStatus(input: {
    taskId: string;
    status: "BACKLOG" | "PENDIENTE" | "EN_PROGRESO" | "EN_REVISION" | "BLOQUEADA" | "COMPLETADA" | "CANCELADA";
    reason: string;
    blockingTaskId?: string;
    blockedReason?: string;
    changedById: string;
  }) {
    const task = await this.app.prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    if (input.status === "EN_PROGRESO") {
      const unresolvedDependencies = await this.app.prisma.taskDependency.findMany({
        where: {
          taskId: input.taskId,
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

      if (unresolvedDependencies.length > 0) {
        throw new Error("No se puede iniciar la tarea: existen dependencias no resueltas");
      }
    }

    const updated = await this.app.prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        blockingTaskId: input.status === "BLOQUEADA" ? input.blockingTaskId : null,
        blockedReason: input.status === "BLOQUEADA" ? input.blockedReason : null,
        completedAt: input.status === "COMPLETADA" ? new Date() : null
      }
    });

    await this.app.prisma.taskStatusHistory.create({
      data: {
        taskId: input.taskId,
        fromStatus: task.status,
        toStatus: input.status,
        reason: input.reason,
        changedById: input.changedById
      }
    });

    if (updated.assigneeId) {
      const event = input.status === "BLOQUEADA" ? "TAREA_BLOQUEADA" : "TAREA_ESTADO_CAMBIADO";
      await createAndDispatchNotification(this.app, {
        userId: updated.assigneeId,
        event,
        title: "Cambio de estado de tarea",
        body: `La tarea ${updated.title} cambió a ${updated.status}`
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

  async reassign(input: {
    taskId: string;
    newAssigneeId: string;
    reason: string;
    reopenIfCompleted: boolean;
    requestedById: string;
    activeRole: SystemRole;
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
      projectContextId: input.projectContextId
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
        task.status === "COMPLETADA" && input.reopenIfCompleted ? "EN_PROGRESO" : task.status;

      const nextTask = await tx.task.update({
        where: { id: input.taskId },
        data: {
          assigneeId: input.newAssigneeId,
          status: newStatus,
          completedAt: newStatus === "COMPLETADA" ? task.completedAt : null
        }
      });

      await tx.taskReassignment.create({
        data: {
          taskId: input.taskId,
          previousAssigneeId: task.assigneeId,
          newAssigneeId: input.newAssigneeId,
          reason: input.reason,
          reassignedById: input.requestedById
        }
      });

      if (task.status === "COMPLETADA" && input.reopenIfCompleted) {
        await tx.taskStatusHistory.create({
          data: {
            taskId: task.id,
            fromStatus: "COMPLETADA",
            toStatus: "EN_PROGRESO",
            reason: "Reapertura autorizada para reasignación",
            changedById: input.requestedById
          }
        });
      }

      return nextTask;
    });

    const leaders = await this.app.prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        role: "LIDER_PROYECTO"
      },
      select: { userId: true }
    });

    const recipients = new Set<string>([
      input.newAssigneeId,
      ...leaders.map((leader) => leader.userId),
      ...(task.assigneeId ? [task.assigneeId] : [])
    ]);

    for (const userId of recipients) {
      await createAndDispatchNotification(this.app, {
        userId,
        event: "TAREA_REASIGNADA",
        title: "Tarea reasignada",
        body: `La tarea ${task.title} cambió de responsable`
      });
    }

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

    return updated;
  }
}
