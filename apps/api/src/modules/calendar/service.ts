import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";

const encodeToken = (token: string) => Buffer.from(token).toString("base64");
const decodeToken = (token: string) => Buffer.from(token, "base64").toString("utf8");

interface ExternalCalendarTokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

interface ExternalSyncEvent {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  projectId?: string;
  teamId?: string;
}

export class CalendarService {
  constructor(private readonly app: FastifyInstance) {}

  private syncTaskSearch(taskId: string) {
    void this.app.searchIndex?.syncTask(taskId);
  }

  async getPersonalEvents(input: { userId: string; from: string; to: string }) {
    const from = new Date(input.from);
    const to = new Date(input.to);

    const [tasks, meetings, availability, externalEvents] = await Promise.all([
      this.app.prisma.task.findMany({
        where: {
          assigneeId: input.userId,
          dueDate: {
            gte: from,
            lte: to
          }
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          projectId: true,
          assigneeId: true
        }
      }),
      this.app.prisma.meeting.findMany({
        where: {
          startsAt: { lte: to },
          endsAt: { gte: from },
          participants: {
            some: { userId: input.userId }
          }
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          projectId: true,
          teamId: true
        }
      }),
      this.app.prisma.availabilityBlock.findMany({
        where: {
          userId: input.userId,
          startAt: { lte: to },
          endAt: { gte: from }
        },
        select: {
          id: true,
          type: true,
          startAt: true,
          endAt: true,
          userId: true,
          note: true
        }
      }),
      this.app.prisma.externalCalendarEvent.findMany({
        where: {
          connection: {
            userId: input.userId
          },
          startsAt: { lte: to },
          endsAt: { gte: from }
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          projectId: true,
          teamId: true
        }
      })
    ]);

    return [
      ...tasks
        .filter((task) => task.dueDate)
        .map((task) => ({
          id: task.id,
          type: "TAREA" as const,
          title: task.title,
          startsAt: task.dueDate!.toISOString(),
          endsAt: task.dueDate!.toISOString(),
          projectId: task.projectId,
          teamId: null,
          userId: task.assigneeId,
          readOnly: false,
          metadata: {}
        })),
      ...meetings.map((meeting) => ({
        id: meeting.id,
        type: "REUNION" as const,
        title: meeting.title,
        startsAt: meeting.startsAt.toISOString(),
        endsAt: meeting.endsAt.toISOString(),
        projectId: meeting.projectId,
        teamId: meeting.teamId,
        userId: input.userId,
        readOnly: false,
        metadata: {}
      })),
      ...availability.map((block) => ({
        id: block.id,
        type: "VACACIONES" as const,
        title: block.note ?? block.type,
        startsAt: block.startAt.toISOString(),
        endsAt: block.endAt.toISOString(),
        projectId: null,
        teamId: null,
        userId: block.userId,
        readOnly: false,
        metadata: {
          availabilityType: block.type
        }
      })),
      ...externalEvents.map((event) => ({
        id: event.id,
        type: "EXTERNO" as const,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        projectId: event.projectId,
        teamId: event.teamId,
        userId: input.userId,
        readOnly: true,
        metadata: {}
      }))
    ];
  }

  async getSharedEvents(input: {
    scope: "PERSONAL" | "EQUIPO" | "PROYECTO";
    scopeId: string;
    date: string;
    view: "DIA" | "SEMANA" | "MES";
  }) {
    const base = new Date(input.date);
    const from = new Date(base);
    const to = new Date(base);

    if (input.view === "DIA") {
      to.setDate(to.getDate() + 1);
    }
    if (input.view === "SEMANA") {
      to.setDate(to.getDate() + 7);
    }
    if (input.view === "MES") {
      to.setMonth(to.getMonth() + 1);
    }

    if (input.scope === "PROYECTO") {
      const [tasks, meetings, objectives] = await Promise.all([
        this.app.prisma.task.findMany({
          where: {
            projectId: input.scopeId,
            dueDate: { gte: from, lte: to }
          },
          select: {
            id: true,
            title: true,
            dueDate: true,
            assigneeId: true
          }
        }),
        this.app.prisma.meeting.findMany({
          where: {
            projectId: input.scopeId,
            startsAt: { lte: to },
            endsAt: { gte: from }
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true
          }
        }),
        this.app.prisma.objective.findMany({
          where: {
            projectId: input.scopeId,
            targetDate: { gte: from, lte: to }
          },
          select: {
            id: true,
            title: true,
            targetDate: true
          }
        })
      ]);

      return [
        ...tasks
          .filter((task) => task.dueDate)
          .map((task) => ({
            id: task.id,
            type: "TAREA" as const,
            title: task.title,
            startsAt: task.dueDate!.toISOString(),
            endsAt: task.dueDate!.toISOString(),
            projectId: input.scopeId,
            teamId: null,
            userId: task.assigneeId,
            readOnly: false,
            metadata: {}
          })),
        ...meetings.map((meeting) => ({
          id: meeting.id,
          type: "REUNION" as const,
          title: meeting.title,
          startsAt: meeting.startsAt.toISOString(),
          endsAt: meeting.endsAt.toISOString(),
          projectId: input.scopeId,
          teamId: null,
          userId: null,
          readOnly: false,
          metadata: {}
        })),
        ...objectives.map((objective) => ({
          id: objective.id,
          type: "HITO" as const,
          title: objective.title,
          startsAt: objective.targetDate.toISOString(),
          endsAt: objective.targetDate.toISOString(),
          projectId: input.scopeId,
          teamId: null,
          userId: null,
          readOnly: false,
          metadata: {}
        }))
      ];
    }

    if (input.scope === "EQUIPO") {
      const members = await this.app.prisma.teamMember.findMany({
        where: { teamId: input.scopeId },
        select: { userId: true }
      });
      const userIds = members.map((member) => member.userId);

      const [meetings, availability] = await Promise.all([
        this.app.prisma.meeting.findMany({
          where: {
            teamId: input.scopeId,
            startsAt: { lte: to },
            endsAt: { gte: from }
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true
          }
        }),
        this.app.prisma.availabilityBlock.findMany({
          where: {
            userId: { in: userIds },
            startAt: { lte: to },
            endAt: { gte: from }
          },
          select: {
            id: true,
            userId: true,
            type: true,
            startAt: true,
            endAt: true
          }
        })
      ]);

      return [
        ...meetings.map((meeting) => ({
          id: meeting.id,
          type: "REUNION" as const,
          title: meeting.title,
          startsAt: meeting.startsAt.toISOString(),
          endsAt: meeting.endsAt.toISOString(),
          projectId: null,
          teamId: input.scopeId,
          userId: null,
          readOnly: false,
          metadata: {}
        })),
        ...availability.map((block) => ({
          id: block.id,
          type: "VACACIONES" as const,
          title: block.type,
          startsAt: block.startAt.toISOString(),
          endsAt: block.endAt.toISOString(),
          projectId: null,
          teamId: input.scopeId,
          userId: block.userId,
          readOnly: false,
          metadata: {
            availabilityType: block.type
          }
        }))
      ];
    }

    return [];
  }

  async rescheduleTask(input: {
    taskId: string;
    dueDate: string;
    requesterId: string;
    confirmOutOfSchedule: boolean;
    allowDependencyConflict: boolean;
  }) {
    const dueDate = new Date(input.dueDate);
    const task = await this.app.prisma.task.findUnique({
      where: { id: input.taskId },
      include: {
        dependencies: {
          include: {
            dependsOnTask: {
              select: { status: true }
            }
          }
        }
      }
    });

    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    const warnings: string[] = [];

    if (task.assigneeId) {
      const block = await this.app.prisma.availabilityBlock.findFirst({
        where: {
          userId: task.assigneeId,
          type: { in: ["VACACIONES", "AUSENCIA"] },
          startAt: { lte: dueDate },
          endAt: { gte: dueDate }
        }
      });

      if (block) {
        throw new Error("El responsable está en vacaciones o ausencia para la fecha seleccionada");
      }

      const schedule = await this.app.prisma.workSchedule.findUnique({
        where: { userId: task.assigneeId }
      });

      if (schedule) {
        const day = dueDate.getDay();
        const hhmm = `${String(dueDate.getHours()).padStart(2, "0")}:${String(
          dueDate.getMinutes()
        ).padStart(2, "0")}`;
        const inDay = schedule.weekDays.includes(day);
        const inHour = hhmm >= schedule.startHour && hhmm <= schedule.endHour;

        if ((!inDay || !inHour) && !input.confirmOutOfSchedule) {
          throw new Error("Reprogramación fuera de jornada laboral, confirma para continuar");
        }
        if (!inDay || !inHour) {
          warnings.push("Reprogramación fuera de jornada laboral");
        }
      }

      const oneHourLater = new Date(dueDate.getTime() + 60 * 60 * 1000);
      const overlapMeeting = await this.app.prisma.meetingParticipant.findFirst({
        where: {
          userId: task.assigneeId,
          meeting: {
            status: { in: ["PROGRAMADA", "EN_CURSO"] },
            startsAt: { lt: oneHourLater },
            endsAt: { gt: dueDate }
          }
        },
        select: { meetingId: true }
      });

      if (overlapMeeting) {
        warnings.push(`Conflicto horario con reunión ${overlapMeeting.meetingId}`);
      }
    }

    const unresolvedDependencies = task.dependencies.filter(
      (dependency) => dependency.dependsOnTask.status !== "COMPLETADA"
    );
    if (unresolvedDependencies.length > 0) {
      warnings.push("La tarea tiene dependencias bloqueantes no resueltas");
      if (!input.allowDependencyConflict) {
        warnings.push(
          "Se permite continuar por ser alerta no bloqueante; confirma explícitamente en UI"
        );
      }
    }

    const updated = await this.app.prisma.task.update({
      where: { id: task.id },
      data: {
        dueDate
      }
    });

    this.syncTaskSearch(updated.id);
    return {
      task: updated,
      warnings
    };
  }

  async getTeamCapacity(input: { teamId: string; weekStart: string }) {
    const from = new Date(input.weekStart);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const members = await this.app.prisma.teamMember.findMany({
      where: { teamId: input.teamId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            workSchedule: {
              select: {
                periodHoursCapacity: true
              }
            }
          }
        }
      }
    });

    const rows = await Promise.all(
      members.map(async (member) => {
        const [plannedMinutes, activeTasks] = await Promise.all([
          this.app.prisma.timeEntry.aggregate({
            _sum: { minutes: true },
            where: {
              userId: member.user.id,
              loggedAt: {
                gte: from,
                lt: to
              }
            }
          }),
          this.app.prisma.task.count({
            where: {
              assigneeId: member.user.id,
              status: {
                in: ["PENDIENTE", "EN_REVISION"]
              }
            }
          })
        ]);

        return {
          userId: member.user.id,
          fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
          weeklyCapacityHours: member.user.workSchedule?.periodHoursCapacity ?? 40,
          plannedMinutes: plannedMinutes._sum.minutes ?? 0,
          activeTasks
        };
      })
    );

    return rows;
  }

  private async exchangeAuthorizationCode(input: {
    provider: "GOOGLE" | "MICROSOFT";
    authorizationCode: string;
  }): Promise<ExternalCalendarTokenPayload> {
    if (input.provider === "GOOGLE") {
      const body = new URLSearchParams({
        code: input.authorizationCode,
        client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALENDAR_REDIRECT_URI,
        grant_type: "authorization_code"
      });

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      if (!response.ok) {
        throw new Error("No se pudo completar OAuth con Google Calendar");
      }

      const payload = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      const expiresAt = payload.expires_in
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;

      return {
        accessToken: payload.access_token,
        ...(payload.refresh_token ? { refreshToken: payload.refresh_token } : {}),
        ...(expiresAt ? { expiresAt } : {})
      };
    }

    const body = new URLSearchParams({
      code: input.authorizationCode,
      client_id: env.MICROSOFT_CALENDAR_CLIENT_ID,
      client_secret: env.MICROSOFT_CALENDAR_CLIENT_SECRET,
      redirect_uri: env.MICROSOFT_CALENDAR_REDIRECT_URI,
      grant_type: "authorization_code"
    });

    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      throw new Error("No se pudo completar OAuth con Microsoft Calendar");
    }

    const payload = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresAt = payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null;

    return {
      accessToken: payload.access_token,
      ...(payload.refresh_token ? { refreshToken: payload.refresh_token } : {}),
      ...(expiresAt ? { expiresAt } : {})
    };
  }

  private async fetchProviderEvents(input: {
    provider: "GOOGLE" | "MICROSOFT";
    accessToken: string;
    from: Date;
    to: Date;
  }): Promise<ExternalSyncEvent[]> {
    if (input.provider === "GOOGLE") {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: input.from.toISOString(),
        timeMax: input.to.toISOString()
      });

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${input.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("No se pudieron sincronizar eventos desde Google Calendar");
      }

      const payload = (await response.json()) as {
        items?: Array<{
          id?: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
      };

      return (payload.items ?? [])
        .map((event) => {
          const startsAt = event.start?.dateTime ?? event.start?.date;
          const endsAt = event.end?.dateTime ?? event.end?.date;
          if (!event.id || !startsAt || !endsAt) {
            return null;
          }

          return {
            externalId: event.id,
            title: event.summary ?? "Evento externo",
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString()
          };
        })
        .filter((event): event is ExternalSyncEvent => Boolean(event));
    }

    const params = new URLSearchParams({
      startDateTime: input.from.toISOString(),
      endDateTime: input.to.toISOString(),
      $orderby: "start/dateTime"
    });

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendar/events?${params}`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error("No se pudieron sincronizar eventos desde Microsoft Calendar");
    }

    const payload = (await response.json()) as {
      value?: Array<{
        id?: string;
        subject?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      }>;
    };

    return (payload.value ?? [])
      .map((event) => {
        const startsAt = event.start?.dateTime;
        const endsAt = event.end?.dateTime;
        if (!event.id || !startsAt || !endsAt) {
          return null;
        }

        return {
          externalId: event.id,
          title: event.subject ?? "Evento externo",
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString()
        };
      })
      .filter((event): event is ExternalSyncEvent => Boolean(event));
  }

  async connectExternalCalendar(input: {
    userId: string;
    provider: "GOOGLE" | "MICROSOFT";
    externalAccountId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    authorizationCode?: string;
  }) {
    const oauthTokens = input.authorizationCode
      ? await this.exchangeAuthorizationCode({
          provider: input.provider,
          authorizationCode: input.authorizationCode
        })
      : null;

    const accessToken = oauthTokens?.accessToken ?? input.accessToken;
    if (!accessToken) {
      throw new Error("Token OAuth no disponible para conectar calendario externo");
    }

    const externalAccountId =
      input.externalAccountId ?? `${input.provider.toLowerCase()}-${input.userId}`;

    return this.app.prisma.externalCalendarConnection.upsert({
      where: {
        provider_externalAccountId: {
          provider: input.provider,
          externalAccountId
        }
      },
      update: {
        accessTokenEncrypted: encodeToken(accessToken),
        refreshTokenEncrypted: input.refreshToken
          ? encodeToken(input.refreshToken)
          : oauthTokens?.refreshToken
            ? encodeToken(oauthTokens.refreshToken)
            : null,
        expiresAt: input.expiresAt
          ? new Date(input.expiresAt)
          : oauthTokens?.expiresAt
            ? new Date(oauthTokens.expiresAt)
            : null
      },
      create: {
        userId: input.userId,
        provider: input.provider,
        externalAccountId,
        accessTokenEncrypted: encodeToken(accessToken),
        refreshTokenEncrypted: input.refreshToken
          ? encodeToken(input.refreshToken)
          : oauthTokens?.refreshToken
            ? encodeToken(oauthTokens.refreshToken)
            : null,
        expiresAt: input.expiresAt
          ? new Date(input.expiresAt)
          : oauthTokens?.expiresAt
            ? new Date(oauthTokens.expiresAt)
            : null
      }
    });
  }

  async syncExternalEvents(input: {
    userId: string;
    connectionId: string;
    events?: ExternalSyncEvent[];
    from?: string;
    to?: string;
  }) {
    const connection = await this.app.prisma.externalCalendarConnection.findFirst({
      where: {
        id: input.connectionId,
        userId: input.userId
      },
      select: {
        id: true,
        provider: true,
        accessTokenEncrypted: true
      }
    });

    if (!connection) {
      throw new Error("Conexión de calendario externo no encontrada");
    }

    const from = input.from ? new Date(input.from) : new Date();
    const to = input.to ? new Date(input.to) : new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    const events =
      input.events && input.events.length > 0
        ? input.events
        : await this.fetchProviderEvents({
            provider: connection.provider,
            accessToken: decodeToken(connection.accessTokenEncrypted),
            from,
            to
          });

    const upserted = await Promise.all(
      events.map((event) =>
        this.app.prisma.externalCalendarEvent.upsert({
          where: {
            connectionId_externalId: {
              connectionId: connection.id,
              externalId: event.externalId
            }
          },
          update: {
            title: event.title,
            startsAt: new Date(event.startsAt),
            endsAt: new Date(event.endsAt),
            projectId: event.projectId ?? null,
            teamId: event.teamId ?? null
          },
          create: {
            connectionId: connection.id,
            externalId: event.externalId,
            title: event.title,
            startsAt: new Date(event.startsAt),
            endsAt: new Date(event.endsAt),
            projectId: event.projectId ?? null,
            teamId: event.teamId ?? null
          }
        })
      )
    );

    return {
      synced: upserted.length
    };
  }

  getExternalOAuthUrl(provider: "GOOGLE" | "MICROSOFT") {
    if (provider === "GOOGLE") {
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
        redirect_uri: env.GOOGLE_CALENDAR_REDIRECT_URI,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        access_type: "offline",
        prompt: "consent"
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const params = new URLSearchParams({
      client_id: env.MICROSOFT_CALENDAR_CLIENT_ID,
      redirect_uri: env.MICROSOFT_CALENDAR_REDIRECT_URI,
      response_type: "code",
      response_mode: "query",
      scope: "offline_access Calendars.Read"
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }
}
