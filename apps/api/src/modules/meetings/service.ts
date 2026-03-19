import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { resolveInstantCallExpiryStatus } from "../../lib/instant-call-expiry.js";
import { createAndDispatchNotification } from "../../lib/notifications.js";

interface MeetingConflictWarning {
  type: "HORARIO_OCUPADO";
  userId: string;
  detail: string;
}

const MAX_MEETING_PARTICIPANTS = 20;

export class MeetingsService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";

  constructor(private readonly app: FastifyInstance) {}

  private normalizeLegacyCode(input: {
    code?: string | null | undefined;
    text?: string | null | undefined;
  }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return MeetingsService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  private async assertContextAccess(input: {
    userId: string;
    projectId?: string;
    teamId?: string;
  }) {
    if (input.projectId) {
      const projectAccess = await this.app.prisma.projectMember.findFirst({
        where: {
          projectId: input.projectId,
          userId: input.userId
        },
        select: { id: true }
      });

      if (!projectAccess) {
        throw new Error("No tienes acceso al proyecto vinculado");
      }
    }

    if (input.teamId) {
      const teamAccess = await this.app.prisma.teamMember.findFirst({
        where: {
          teamId: input.teamId,
          userId: input.userId
        },
        select: { id: true }
      });

      if (!teamAccess) {
        throw new Error("No tienes acceso al equipo vinculado");
      }
    }
  }

  private async ensureMeetingReadAccess(meetingId: string, userId: string) {
    const meeting = await this.app.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: true
      }
    });

    if (!meeting) {
      throw new Error("Reunión no encontrada");
    }

    const isParticipant = meeting.participants.some((participant) => participant.userId === userId);
    if (isParticipant || meeting.createdById === userId) {
      return meeting;
    }

    if (meeting.projectId) {
      const isProjectLeader = await this.app.prisma.projectMember.findFirst({
        where: {
          projectId: meeting.projectId,
          userId,
          role: {
            is: {
              key: {
                in: ["LIDER_PROYECTO", "ADMINISTRADOR"]
              }
            }
          }
        },
        select: { id: true }
      });

      if (isProjectLeader) {
        return meeting;
      }
    }

    const isAdmin = await this.app.prisma.user.findFirst({
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

    if (isAdmin) {
      return meeting;
    }

    throw new Error("No tienes acceso a esta reunión");
  }

  private async assertInstantCallNotExpired(input: { meetingId: string; meetingCreatedAt: Date }) {
    const status = await resolveInstantCallExpiryStatus(this.app.prisma, input);
    if (status.isInstantCall && status.expired) {
      throw new Error(`La videollamada instantánea venció (vigencia: ${status.expiryHours} horas)`);
    }
  }

  private async validateParticipants(
    participantIds: string[],
    startsAt: Date,
    endsAt: Date
  ): Promise<MeetingConflictWarning[]> {
    if (participantIds.length > MAX_MEETING_PARTICIPANTS) {
      throw new Error(`Máximo ${MAX_MEETING_PARTICIPANTS} participantes por reunión`);
    }

    const uniqueParticipantIds = [...new Set(participantIds)];
    const users = await this.app.prisma.user.findMany({
      where: {
        id: {
          in: uniqueParticipantIds
        },
        isActive: true
      },
      select: { id: true }
    });

    if (users.length !== uniqueParticipantIds.length) {
      throw new Error("Hay participantes inválidos o inactivos");
    }

    const blocked = await this.app.prisma.availabilityBlock.findMany({
      where: {
        userId: { in: uniqueParticipantIds },
        type: { in: ["VACACIONES", "AUSENCIA"] },
        startAt: { lt: endsAt },
        endAt: { gt: startsAt }
      },
      select: {
        userId: true,
        type: true
      }
    });

    if (blocked.length > 0) {
      const blockedIds = blocked.map((item) => item.userId).join(", ");
      throw new Error(`No se puede programar: usuarios en vacaciones/ausencia (${blockedIds})`);
    }

    const overlaps = await this.app.prisma.meetingParticipant.findMany({
      where: {
        userId: { in: uniqueParticipantIds },
        meeting: {
          status: { in: ["PROGRAMADA", "EN_CURSO"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt }
        }
      },
      select: {
        userId: true,
        meetingId: true
      }
    });

    const warnings: MeetingConflictWarning[] = overlaps.map((conflict) => ({
      type: "HORARIO_OCUPADO",
      userId: conflict.userId,
      detail: `Conflicto con la reunión ${conflict.meetingId}`
    }));

    return warnings;
  }

  private async notifyMeetingCreated(input: {
    meetingId: string;
    title: string;
    startsAt: Date;
    createdById: string;
    participantIds: string[];
  }) {
    const targets = input.participantIds.filter((participantId) => participantId !== input.createdById);

    await Promise.all(
      targets.map((participantId) =>
        createAndDispatchNotification(this.app, {
          userId: participantId,
          event: "REUNION_PROGRAMADA",
          title: "Nueva reunión programada",
          body: `${input.title} - ${input.startsAt.toISOString()}`
        })
      )
    );

    if (env.SLACK_WEBHOOK_URL) {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Corelia: reunión programada "${input.title}" (${input.meetingId})`
        })
      }).catch(() => undefined);
    }

    if (env.TEAMS_WEBHOOK_URL) {
      await fetch(env.TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Corelia: reunión programada "${input.title}" (${input.meetingId})`
        })
      }).catch(() => undefined);
    }
  }

  async createMeeting(input: {
    title: string;
    description?: string;
    descriptionCatalogId?: string;
    projectId?: string;
    teamId?: string;
    startsAt: string;
    endsAt: string;
    participantIds: string[];
    agenda: string[];
    createdById: string;
  }) {
    await this.assertContextAccess({
      userId: input.createdById,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {})
    });

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const participantIds = [...new Set([input.createdById, ...input.participantIds])];
    const conflictWarnings = await this.validateParticipants(participantIds, startsAt, endsAt);

    const meeting = await this.app.prisma.meeting.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        descriptionCatalogId: this.normalizeLegacyCode({
          code: input.descriptionCatalogId,
          text: input.description
        }),
        projectId: input.projectId ?? null,
        teamId: input.teamId ?? null,
        startsAt,
        endsAt,
        createdById: input.createdById,
        participants: {
          create: participantIds.map((userId) => ({
            userId
          }))
        },
        agendaItems: {
          create: input.agenda.map((text, index) => ({
            text,
            order: index
          }))
        }
      },
      include: {
        participants: true,
        agendaItems: {
          orderBy: { order: "asc" }
        }
      }
    });

    await this.notifyMeetingCreated({
      meetingId: meeting.id,
      title: meeting.title,
      startsAt,
      createdById: input.createdById,
      participantIds
    });

    await this.app.realtime?.emitMeetingEvent(meeting.id, "meeting:created", meeting);

    return {
      meeting,
      warnings: conflictWarnings
    };
  }

  async listMeetings(input: {
    userId: string;
    from?: string;
    to?: string;
    projectId?: string;
    teamId?: string;
  }) {
    return this.app.prisma.meeting.findMany({
      where: {
        ...(input.from || input.to
          ? {
              startsAt: {
                ...(input.from ? { gte: new Date(input.from) } : {}),
                ...(input.to ? { lte: new Date(input.to) } : {})
              }
            }
          : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.teamId ? { teamId: input.teamId } : {}),
        OR: [
          { createdById: input.userId },
          { participants: { some: { userId: input.userId } } },
          {
            project: {
              members: {
                some: {
                  userId: input.userId,
                role: {
                  is: {
                    key: "LIDER_PROYECTO"
                  }
                }
                }
              }
            }
          }
        ]
      },
      orderBy: { startsAt: "asc" },
      include: {
        participants: true
      }
    });
  }

  async getMeeting(meetingId: string, userId: string) {
    const meetingAccess = await this.ensureMeetingReadAccess(meetingId, userId);
    await this.assertInstantCallNotExpired({
      meetingId,
      meetingCreatedAt: meetingAccess.createdAt
    });
    return this.app.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: true,
        agendaItems: {
          orderBy: { order: "asc" }
        },
        notes: {
          orderBy: { updatedAt: "desc" }
        },
        agreements: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  }

  async addNote(input: {
    meetingId: string;
    userId: string;
    content: Record<string, unknown>;
  }) {
    await this.ensureMeetingReadAccess(input.meetingId, input.userId);

    const note = await this.app.prisma.meetingNote.create({
      data: {
        meetingId: input.meetingId,
        authorId: input.userId,
        content: input.content as never
      }
    });

    await this.app.realtime?.emitMeetingEvent(input.meetingId, "meeting:note", note);
    return note;
  }

  async createAgreement(input: {
    meetingId: string;
    userId: string;
    title: string;
    description?: string;
    descriptionCatalogId?: string;
    existingTaskId?: string;
    createTask?: {
      projectId: string;
      title: string;
      description?: string;
      descriptionCatalogId?: string;
      assigneeId?: string;
      dueDate?: string;
    };
  }) {
    const meeting = await this.ensureMeetingReadAccess(input.meetingId, input.userId);

    let linkedTaskId: string | null = null;
    let createdTask = false;
    let status: "PENDIENTE_ACCION" | "VINCULADO_TAREA" | "COMPLETADO" = "PENDIENTE_ACCION";

    if (input.existingTaskId) {
      const existingTask = await this.app.prisma.task.findUnique({
        where: { id: input.existingTaskId },
        select: { id: true }
      });

      if (!existingTask) {
        throw new Error("La tarea existente no fue encontrada");
      }

      linkedTaskId = existingTask.id;
      status = "VINCULADO_TAREA";
    }

    if (!linkedTaskId && input.createTask) {
      const created = await this.app.prisma.task.create({
        data: {
          projectId: input.createTask.projectId,
          title: input.createTask.title,
          description: input.createTask.description ?? null,
          descriptionCatalogId: this.normalizeLegacyCode({
            code: input.createTask.descriptionCatalogId,
            text: input.createTask.description
          }),
          assigneeId: input.createTask.assigneeId ?? null,
          dueDate: input.createTask.dueDate ? new Date(input.createTask.dueDate) : null,
          createdById: input.userId,
          status: "PENDIENTE"
        }
      });

      linkedTaskId = created.id;
      createdTask = true;
      status = "VINCULADO_TAREA";

      if (created.assigneeId) {
        await createAndDispatchNotification(this.app, {
          userId: created.assigneeId,
          event: "ACUERDO_ASIGNADO_TAREA",
          title: "Nuevo acuerdo asignado",
          body: `Se creó una tarea desde reunión: ${created.title}`
        });
      }

      if (env.SLACK_WEBHOOK_URL) {
        await fetch(env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Corelia: acuerdo convertido en tarea (${created.id}) en reunión ${meeting.id}`
          })
        }).catch(() => undefined);
      }

      if (env.TEAMS_WEBHOOK_URL) {
        await fetch(env.TEAMS_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Corelia: acuerdo convertido en tarea (${created.id}) en reunión ${meeting.id}`
          })
        }).catch(() => undefined);
      }
    }

    const agreement = await this.app.prisma.meetingAgreement.create({
      data: {
        meetingId: input.meetingId,
        title: input.title,
        description: input.description ?? null,
        descriptionCatalogId: this.normalizeLegacyCode({
          code: input.descriptionCatalogId,
          text: input.description
        }),
        authorId: input.userId,
        taskId: linkedTaskId,
        createdTask,
        status
      }
    });

    await this.app.realtime?.emitMeetingEvent(input.meetingId, "meeting:agreement", agreement);
    return agreement;
  }

  async updateStatus(input: {
    meetingId: string;
    userId: string;
    status: "PROGRAMADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
  }) {
    await this.ensureMeetingReadAccess(input.meetingId, input.userId);
    return this.app.prisma.meeting.update({
      where: { id: input.meetingId },
      data: { status: input.status }
    });
  }

  async listPendingFollowUp(meetingId: string, userId: string) {
    await this.ensureMeetingReadAccess(meetingId, userId);
    return this.app.prisma.meetingAgreement.findMany({
      where: {
        meetingId,
        status: "PENDIENTE_ACCION"
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async getMediaCapabilities(meetingId: string, userId: string) {
    const meetingAccess = await this.ensureMeetingReadAccess(meetingId, userId);
    await this.assertInstantCallNotExpired({
      meetingId,
      meetingCreatedAt: meetingAccess.createdAt
    });

    const meeting = await this.app.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        mediaRoomId: true
      }
    });

    if (!meeting) {
      throw new Error("Reunión no encontrada");
    }

    const roomId = meeting.mediaRoomId ?? meeting.id;
    const health = this.app.media?.getHealth();

    if (!this.app.media || !health?.enabled || !health.healthy) {
      return {
        available: false,
        message: health?.detail ?? "Videollamadas no disponibles, modo degradado activo"
      };
    }

    const capabilities = await this.app.media.getRoomCapabilities(roomId);

    if (!meeting.mediaRoomId) {
      await this.app.prisma.meeting.update({
        where: { id: meeting.id },
        data: { mediaRoomId: roomId }
      });
    }

    return {
      available: capabilities.available,
      message: null,
      roomId,
      rtpCapabilities: capabilities.rtpCapabilities
    };
  }
}
