import type { FastifyInstance } from "fastify";
import { attachTraceContext } from "../../lib/tracing.js";
import { forbidden } from "./task-helpers.js";

// Sub-servicio con operaciones de soporte de tareas (encolado de webhooks y
// automatizaciones, validación de alcance de reasignación y de disponibilidad
// del asignado), extraído de TaskService. Self-contained sobre `app`.
export class TaskOperationsService {
  constructor(private readonly app: FastifyInstance) {}

  async enqueueWebhooks(
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

  async enqueueAutomation(
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

  async ensureReassignmentScope(input: {
    taskProjectId: string;
    currentAssigneeId: string | null;
    newAssigneeId: string;
    requestedById: string;
    activeRoleRank: number;
    projectContextId?: string | null;
  }) {
    // Admins (rank 5) bypass all scope checks
    if (input.activeRoleRank >= 5) {
      return;
    }

    if (!input.projectContextId || input.projectContextId !== input.taskProjectId) {
      throw forbidden("Debes operar en el contexto del proyecto de la tarea");
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
            rank: true
          }
        }
      }
    });

    if (!member) {
      throw forbidden("No tienes permisos sobre este proyecto para reasignar");
    }

    // Only coordinators (rank 3) have team-scope restrictions
    if (member.role.rank !== 3) {
      return;
    }

    const coordinatorTeams = await this.app.prisma.teamMember.findMany({
      where: { userId: input.requestedById },
      select: { teamId: true }
    });

    const coordinatorTeamIds = coordinatorTeams.map((team) => team.teamId);
    if (coordinatorTeamIds.length === 0) {
      throw forbidden("Coordinador sin equipo asignado no puede reasignar tareas");
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
      throw forbidden("Coordinador solo puede reasignar tareas entre miembros de su equipo");
    }
  }

  async validateAssigneeAvailability(input: {
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

}
