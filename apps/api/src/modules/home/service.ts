import type { FastifyInstance } from "fastify";
import type { HomeDashboard, SystemRole, TaskStatus } from "@corelia/types";
import { getFrontendSettings } from "../../lib/frontend-settings.js";
import { StatusService } from "../status/service.js";
import { parseAnnouncementBody } from "../announcements/content.js";

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "PENDIENTE",
  "EN_REVISION"
];

const roundPct = (value: number): number => Math.round(value * 100) / 100;

const percentage = (part: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  return roundPct((part / total) * 100);
};

const daysUntil = (date: Date): number => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diffMs = date.getTime() - startOfToday.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

const atEndOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const extractNotificationPath = (body: string): string | null => {
  const match = body.match(/Ruta:\s*(\/\S+)/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].replace(/[).,;!?]+$/g, "");
};

export class HomeService {
  constructor(private readonly app: FastifyInstance) {}

  private getQuickActions(role: SystemRole, organizationName: string): HomeDashboard["quickActions"] {
    const base = [
      { key: "buscar", label: `Buscar en ${organizationName}`, path: "/search", intent: "SEARCH" as const }
    ];
    const internalGlobal = [
      { key: "directorio", label: "Directorio", path: "/directory", intent: "VIEW" as const },
      { key: "anuncios", label: "Anuncios", path: "/announcements", intent: "VIEW" as const }
    ];
    const workGlobal = [
      { key: "mensajes-globales", label: "Mensajes globales", path: "/messaging", intent: "VIEW" as const }
    ];

    if (role === "INVITADO_EXTERNO") {
      return [];
    }

    if (role === "OBSERVADOR") {
      return [...internalGlobal, ...base];
    }

    const collaborator = [
      { key: "nueva-tarea", label: "Nueva tarea", path: "/tasks", intent: "CREATE" as const },
      { key: "calendario", label: "Ver mi calendario", path: "/calendar", intent: "VIEW" as const },
      { key: "mis-proyectos", label: "Ir a mis proyectos", path: "/projects", intent: "VIEW" as const },
      ...workGlobal,
      ...internalGlobal,
      ...base
    ];

    if (role === "COLABORADOR") {
      return collaborator;
    }

    if (role === "COORDINADOR_EQUIPO") {
      return [
        ...collaborator,
        { key: "capacidad-equipo", label: "Ver capacidad del equipo", path: "/calendar", intent: "VIEW" as const },
        { key: "reasignar", label: "Reasignar tarea", path: "/tasks", intent: "MANAGE" as const }
      ];
    }

    if (role === "LIDER_PROYECTO") {
      return [
        ...collaborator,
        { key: "gestion-tareas", label: "Gestión de tareas", path: "/tasks?tab=gestion", intent: "MANAGE" as const },
        { key: "gantt", label: "Ver Gantt del proyecto", path: "/projects", intent: "VIEW" as const },
        { key: "indicadores", label: "Ver panel de indicadores", path: "/projects", intent: "VIEW" as const },
        { key: "aprobar", label: "Aprobar solicitudes pendientes", path: "/requests", intent: "APPROVE" as const }
      ];
    }

    if (role === "ADMINISTRADOR") {
      return [
        { key: "crear-usuario", label: "Crear usuario", path: "/admin/panel", intent: "CREATE" as const },
        {
          key: "invitar",
          label: "Generar enlace de invitación",
          path: "/admin/panel",
          intent: "CREATE" as const
        },
        { key: "auditoria", label: "Ver log de auditoría", path: "/admin/panel", intent: "VIEW" as const },
        { key: "roles", label: "Gestionar roles", path: "/admin/panel", intent: "MANAGE" as const },
        { key: "estado", label: "Ver estado del sistema", path: "/admin/system", intent: "VIEW" as const },
        { key: "gestion-tareas", label: "Gestión de tareas", path: "/tasks?tab=gestion", intent: "MANAGE" as const },
        ...workGlobal,
        ...internalGlobal,
        ...base
      ];
    }

    return base;
  }

  private async getActiveContext(input: {
    role: SystemRole;
    projectId?: string;
    teamId?: string;
  }): Promise<HomeDashboard["activeContext"]> {
    if (input.projectId) {
      const project = await this.app.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, name: true }
      });

      return {
        type: "PROYECTO",
        projectId: project?.id ?? input.projectId,
        projectName: project?.name ?? null,
        teamId: null,
        teamName: null
      };
    }

    if (input.teamId) {
      const team = await this.app.prisma.team.findUnique({
        where: { id: input.teamId },
        select: { id: true, name: true }
      });

      return {
        type: "EQUIPO",
        projectId: null,
        projectName: null,
        teamId: team?.id ?? input.teamId,
        teamName: team?.name ?? null
      };
    }

    if (input.role === "INVITADO_EXTERNO") {
      return {
        type: "EXTERNO",
        projectId: null,
        projectName: null,
        teamId: null,
        teamName: null
      };
    }

    return {
      type: "GLOBAL",
      projectId: null,
      projectName: null,
      teamId: null,
      teamName: null
    };
  }

  private async listAnnouncements(userId: string): Promise<HomeDashboard["blocks"]["announcements"]> {
    const memberships = await this.app.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true }
    });
    const teamIds = memberships.map((item) => item.teamId);

    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const announcements = await this.app.prisma.announcement.findMany({
      where: {
        expiresAt: { gt: now }
      },
      include: {
        teams: {
          select: {
            teamId: true
          }
        },
        users: {
          select: {
            userId: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return announcements
      .map((announcement) => {
        const parsedBody = parseAnnouncementBody(announcement.body);
        const inTeams = announcement.teams.some((team) => teamIds.includes(team.teamId));
        const relationUserIds = announcement.users.map((user) => user.userId);
        const inUsers =
          relationUserIds.includes(userId) || parsedBody.audienceUserIds.includes(userId);
        const isCreator = announcement.createdById === userId;

        if (!announcement.allCompany && !inTeams && !inUsers && !isCreator) {
          return null;
        }

        return {
          id: announcement.id,
          title: announcement.title,
          body: parsedBody.summary,
          ...(parsedBody.blocks.length > 0 ? { content: { blocks: parsedBody.blocks } } : {}),
          createdAt: announcement.createdAt.toISOString(),
          expiresAt: announcement.expiresAt.toISOString(),
          isNew: announcement.createdAt >= threeDaysAgo
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  private async computeProjectProgress(projectId: string, projectName: string, userId: string) {
    const now = new Date();

    const [totalTasks, completedTasks, blockedTasks, involvedBlockedTasks, overdueOpenTasks, nextMilestone] =
      await Promise.all([
        this.app.prisma.task.count({ where: { projectId } }),
        this.app.prisma.task.count({ where: { projectId, status: "COMPLETADA" } }),
        this.app.prisma.task.count({ where: { projectId, status: "EN_REVISION" } }),
        this.app.prisma.task.count({
          where: {
            projectId,
            status: "EN_REVISION",
            assigneeId: userId
          }
        }),
        this.app.prisma.task.count({
          where: {
            projectId,
            status: { in: ACTIVE_TASK_STATUSES },
            dueDate: { lt: now }
          }
        }),
        this.app.prisma.objective.findFirst({
          where: {
            projectId,
            targetDate: { gte: now }
          },
          orderBy: { targetDate: "asc" },
          select: {
            title: true,
            targetDate: true
          }
        })
      ]);

    const completionPct = percentage(completedTasks, totalTasks);
    const blockedPct = percentage(blockedTasks, totalTasks);

    return {
      projectId,
      name: projectName,
      completionPct,
      involvedBlockedTasks,
      blockedPct,
      overdueOpenTasks,
      nextMilestone: nextMilestone
        ? {
            title: nextMilestone.title,
            targetDate: nextMilestone.targetDate.toISOString(),
            daysRemaining: daysUntil(nextMilestone.targetDate)
          }
        : null,
      risk: blockedPct > 20 || overdueOpenTasks > 0
    };
  }

  private async listProjectsForUser(userId: string) {
    return this.app.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }]
      },
      select: {
        id: true,
        name: true
      }
    });
  }

  private async getCollaboratorBlocks(userId: string): Promise<Pick<HomeDashboard["blocks"], "myDay" | "myProjects" | "recentActivity">> {
    const now = new Date();
    const todayEnd = atEndOfDay(now);

    const [tasks, nextMeeting, pendingRequests, projects, unreadNotifications, recentStatusChanges, recentReassignments] =
      await Promise.all([
        this.app.prisma.task.findMany({
          where: {
            assigneeId: userId,
            status: { in: ACTIVE_TASK_STATUSES },
            dueDate: {
              lte: todayEnd
            }
          },
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 40
        }),
        this.app.prisma.meeting.findFirst({
          where: {
            participants: {
              some: {
                userId
              }
            },
            startsAt: {
              gte: now
            }
          },
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            startsAt: "asc"
          }
        }),
        this.app.prisma.formRequest.findMany({
          where: {
            requesterId: userId,
            status: "PENDIENTE"
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 10
        }),
        this.listProjectsForUser(userId),
        this.app.prisma.notification.findMany({
          where: {
            userId,
            readAt: null
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 5
        }),
        this.app.prisma.taskStatusHistory.findMany({
          where: {
            task: {
              OR: [{ assigneeId: userId }, { createdById: userId }]
            }
          },
          include: {
            task: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: {
            changedAt: "desc"
          },
          take: 8
        }),
        this.app.prisma.taskReassignment.findMany({
          where: {
            OR: [{ previousAssigneeId: userId }, { newAssigneeId: userId }]
          },
          include: {
            task: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: {
            reassignedAt: "desc"
          },
          take: 8
        })
      ]);

    const myProjects = await Promise.all(
      projects.map((project) => this.computeProjectProgress(project.id, project.name, userId))
    );

    const normalizedTaskChanges = [
      ...recentStatusChanges.map((change) => ({
        taskId: change.taskId,
        taskTitle: change.task.title,
        changeType: "CAMBIO_ESTADO" as const,
        changedAt: change.changedAt.toISOString(),
        fromStatus: change.fromStatus,
        toStatus: change.toStatus
      })),
      ...recentReassignments.map((change) => ({
        taskId: change.taskId,
        taskTitle: change.task.title,
        changeType: "REASIGNACION" as const,
        changedAt: change.reassignedAt.toISOString(),
        fromStatus: null,
        toStatus: null
      }))
    ]
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
      .slice(0, 6);

    return {
      myDay: {
        dueOrOverdueTasks: tasks
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            dueDate: task.dueDate ? task.dueDate.toISOString() : null,
            overdue: task.dueDate ? task.dueDate < now : false,
            projectId: task.project.id,
            projectName: task.project.name
          }))
          .sort((a, b) => {
            if (a.overdue !== b.overdue) {
              return a.overdue ? -1 : 1;
            }
            if (!a.dueDate || !b.dueDate) {
              return 0;
            }
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }),
        nextMeeting: nextMeeting
          ? {
              id: nextMeeting.id,
              title: nextMeeting.title,
              startsAt: nextMeeting.startsAt.toISOString(),
              endsAt: nextMeeting.endsAt.toISOString(),
              projectId: nextMeeting.project?.id ?? null,
              projectName: nextMeeting.project?.name ?? null,
              joinPath: `/call?meetingId=${encodeURIComponent(nextMeeting.id)}${
                nextMeeting.project?.id ? `&projectId=${encodeURIComponent(nextMeeting.project.id)}` : ""
              }`
            }
          : null,
        pendingRequests: pendingRequests.map((request) => ({
          id: request.id,
          type: request.type,
          status: request.status,
          createdAt: request.createdAt.toISOString()
        }))
      },
      myProjects,
      recentActivity: {
        unreadNotifications: unreadNotifications.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          createdAt: item.createdAt.toISOString(),
          readAt: item.readAt ? item.readAt.toISOString() : null,
          path: extractNotificationPath(item.body) ?? "/home"
        })),
        recentTaskChanges: normalizedTaskChanges
      }
    };
  }

  private async getCoordinatorBlocks(userId: string): Promise<
    Pick<HomeDashboard["blocks"], "teamToday" | "unassignedTasks">
  > {
    const now = new Date();

    const teamMemberships = await this.app.prisma.teamMember.findMany({
      where: {
        userId
      },
      select: {
        teamId: true
      }
    });

    if (teamMemberships.length === 0) {
      return {
        teamToday: [],
        unassignedTasks: []
      };
    }

    const teamIds = teamMemberships.map((membership) => membership.teamId);

    const teams = await this.app.prisma.team.findMany({
      where: {
        id: {
          in: teamIds
        }
      },
      include: {
        members: {
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
          }
        }
      }
    });

    const everyMemberId = [...new Set(teams.flatMap((team) => team.members.map((member) => member.userId)))];

    const [availabilityNow, meetingsNow, activeTaskCounts, overdueTaskCounts] = await Promise.all([
      this.app.prisma.availabilityBlock.findMany({
        where: {
          userId: {
            in: everyMemberId
          },
          startAt: { lte: now },
          endAt: { gte: now },
          type: { in: ["VACACIONES", "AUSENCIA"] }
        },
        select: { userId: true }
      }),
      this.app.prisma.meetingParticipant.findMany({
        where: {
          userId: {
            in: everyMemberId
          },
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
          assigneeId: { in: everyMemberId },
          status: { in: ACTIVE_TASK_STATUSES }
        },
        _count: { _all: true }
      }),
      this.app.prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: everyMemberId },
          status: { in: ACTIVE_TASK_STATUSES },
          dueDate: { lt: now }
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
    const overdueByUser = new Map(
      overdueTaskCounts
        .filter((row): row is typeof row & { assigneeId: string } => Boolean(row.assigneeId))
        .map((row) => [row.assigneeId, row._count._all])
    );

    const teamToday = teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      members: team.members.map((member) => {
        const active = activeByUser.get(member.userId) ?? 0;
        const overdue = overdueByUser.get(member.userId) ?? 0;
        const maxActive = member.user.workSchedule?.maxActiveTasks ?? 5;
        const capacityPct = maxActive > 0 ? roundPct((active / maxActive) * 100) : 0;

        const availability: "AUSENTE" | "EN_REUNION" | "OCUPADO" | "DISPONIBLE" = unavailable.has(
          member.userId
        )
          ? "AUSENTE"
          : inMeeting.has(member.userId)
            ? "EN_REUNION"
            : active > 0
              ? "OCUPADO"
              : "DISPONIBLE";

        return {
          userId: member.userId,
          fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
          availability,
          overdueTasks: overdue,
          capacityPct,
          overloaded: capacityPct >= 80
        };
      })
    }));

    const teamUserIds = [...new Set(teams.flatMap((team) => team.members.map((member) => member.userId)))];
    const projectMembers = await this.app.prisma.projectMember.findMany({
      where: {
        userId: {
          in: teamUserIds
        }
      },
      select: {
        projectId: true
      }
    });
    const projectIds = [...new Set(projectMembers.map((row) => row.projectId))];

    const unassignedTasks =
      projectIds.length === 0
        ? []
        : await this.app.prisma.task.findMany({
            where: {
              projectId: {
                in: projectIds
              },
              assigneeId: null,
              status: {
                in: ["PENDIENTE"]
              }
            },
            include: {
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 30
          });

    return {
      teamToday,
      unassignedTasks: unassignedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        projectId: task.project.id,
        projectName: task.project.name,
        createdAt: task.createdAt.toISOString()
      }))
    };
  }

  private async getLeaderBlocks(userId: string): Promise<
    Pick<HomeDashboard["blocks"], "projectStatus" | "pendingDecisions">
  > {
    const leadProjects = await this.app.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId, role: "LIDER_PROYECTO" } } }]
      },
      select: {
        id: true,
        name: true
      }
    });

    const projectStatus = await Promise.all(
      leadProjects.map((project) => this.computeProjectProgress(project.id, project.name, userId))
    );

    const projectIds = leadProjects.map((project) => project.id);
    const [pendingForms, pendingAgreements] = await Promise.all([
      this.app.prisma.formRequest.count({
        where: {
          approverId: userId,
          status: "PENDIENTE"
        }
      }),
      projectIds.length === 0
        ? 0
        : this.app.prisma.meetingAgreement.count({
            where: {
              status: "PENDIENTE_ACCION",
              meeting: {
                projectId: { in: projectIds }
              }
            }
          })
    ]);

    return {
      projectStatus,
      pendingDecisions: {
        reassignmentApprovals: pendingForms,
        pendingProjectDocuments: pendingAgreements,
        pendingTeamRequests: pendingForms
      }
    };
  }

  private async getAdminBlocks(): Promise<
    Pick<
      HomeDashboard["blocks"],
      "systemState" | "organizationActivity" | "operationalSummary"
    >
  > {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const statusService = new StatusService(this.app);
    const system = await statusService.getSystemStatus();

    const [
      newUsersLast7Days,
      onboardingInProgress,
      pendingOffboardings,
      expiringGuestsNext7Days,
      activeProjects,
      activeTasks,
      overdueTasks,
      teams,
      blockedTasks,
      failedAutomations
    ] = await Promise.all([
      this.app.prisma.user.count({
        where: {
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      }),
      this.app.prisma.onboardingRun.count({
        where: {
          completedAt: null
        }
      }),
      this.app.prisma.offboardingRecord.count({
        where: {
          archivedAt: null
        }
      }),
      this.app.prisma.guestInvite.count({
        where: {
          revokedAt: null,
          expiresAt: {
            gte: now,
            lte: sevenDays
          }
        }
      }),
      this.app.prisma.project.count(),
      this.app.prisma.task.count({
        where: {
          status: {
            in: ACTIVE_TASK_STATUSES
          }
        }
      }),
      this.app.prisma.task.count({
        where: {
          status: {
            in: ACTIVE_TASK_STATUSES
          },
          dueDate: {
            lt: now
          }
        }
      }),
      this.app.prisma.team.findMany({
        include: {
          members: {
            select: {
              userId: true
            }
          }
        }
      }),
      this.app.prisma.task.findMany({
        where: {
          status: "EN_REVISION",
          assigneeId: {
            not: null
          }
        },
        select: {
          assigneeId: true
        }
      }),
      this.app.prisma.webhookDelivery.count({
        where: {
          success: false,
          attemptedAt: {
            gte: dayAgo
          }
        }
      })
    ]);

    const blockedByTeam = new Map<string, { teamId: string; teamName: string; blockedTasks: number }>();
    const teamUsers = new Map<string, string[]>();

    teams.forEach((team) => {
      teamUsers.set(
        team.id,
        team.members.map((member) => member.userId)
      );
    });

    blockedTasks.forEach((task) => {
      if (!task.assigneeId) {
        return;
      }

      teamUsers.forEach((userIds, teamId) => {
        if (!userIds.includes(task.assigneeId!)) {
          return;
        }

        const existing = blockedByTeam.get(teamId);
        if (existing) {
          existing.blockedTasks += 1;
          return;
        }

        const team = teams.find((candidate) => candidate.id === teamId);
        blockedByTeam.set(teamId, {
          teamId,
          teamName: team?.name ?? "Equipo",
          blockedTasks: 1
        });
      });
    });

    const teamsWithMoreBlockedTasks = [...blockedByTeam.values()]
      .sort((a, b) => b.blockedTasks - a.blockedTasks)
      .slice(0, 5);

    return {
      systemState: {
        now: system.now,
        maintenance: system.maintenance,
        services: system.services,
        grafanaUrl: process.env.GRAFANA_URL ?? "http://localhost:3001"
      },
      organizationActivity: {
        newUsersLast7Days,
        onboardingInProgress,
        pendingOffboardings,
        expiringGuestsNext7Days
      },
      operationalSummary: {
        activeProjects,
        activeTasks,
        overdueTasks,
        teamsWithMoreBlockedTasks,
        failedAutomationsLast24h: failedAutomations
      }
    };
  }

  private async getObserverBlocks(userId: string): Promise<
    Pick<HomeDashboard["blocks"], "myProjects" | "recentActivity">
  > {
    const projects = await this.listProjectsForUser(userId);
    const projectIds = projects.map((project) => project.id);

    const myProjects = await Promise.all(
      projects.map((project) => this.computeProjectProgress(project.id, project.name, userId))
    );

    const latestTaskChanges =
      projectIds.length === 0
        ? []
        : await this.app.prisma.task.findMany({
            where: {
              projectId: {
                in: projectIds
              }
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 6,
            select: {
              id: true,
              title: true,
              status: true,
              updatedAt: true
            }
          });

    return {
      myProjects,
      recentActivity: {
        unreadNotifications: [],
        recentTaskChanges: latestTaskChanges.map((task) => ({
          taskId: task.id,
          taskTitle: task.title,
          changeType: "CAMBIO_ESTADO",
          changedAt: task.updatedAt.toISOString(),
          fromStatus: null,
          toStatus: task.status
        }))
      }
    };
  }

  private async getExternalGuestBlocks(input: {
    userId: string;
    userEmail: string;
    organizationName: string;
  }): Promise<Pick<HomeDashboard["blocks"], "sharedResources" | "externalBanner">> {
    const now = new Date();
    const invites = await this.app.prisma.guestInvite.findMany({
      where: {
        email: input.userEmail,
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        expiresAt: "asc"
      }
    });

    const sharedResources = invites.map((invite) => ({
      id: invite.id,
      resourceType: invite.resourceType,
      resourceId: invite.resourceId,
      expiresAt: invite.expiresAt.toISOString(),
      contactName: `${invite.createdBy.firstName} ${invite.createdBy.lastName}`.trim()
    }));

    const firstExpiration = invites[0]?.expiresAt;
    const firstContact = invites[0]
      ? `${invites[0].createdBy.firstName} ${invites[0].createdBy.lastName}`.trim()
      : `soporte ${input.organizationName}`;

    const externalBanner = firstExpiration
      ? `Tu acceso expira el ${firstExpiration.toLocaleDateString("es-ES")}. Contacta a ${firstContact} para extenderlo.`
      : "No tienes recursos compartidos activos en este momento.";

    return {
      sharedResources,
      externalBanner
    };
  }

  async getDashboard(input: {
    userId: string;
    role: SystemRole;
    projectId?: string;
    teamId?: string;
  }): Promise<HomeDashboard> {
    const now = new Date();
    const frontendSettings = await getFrontendSettings(this.app.prisma);
    const organizationName = frontendSettings.organizationName;
    const user = await this.app.prisma.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        id: true,
        email: true
      }
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const [activeContext, unreadNotificationCount] = await Promise.all([
      this.getActiveContext({
        role: input.role,
        projectId: input.projectId,
        teamId: input.teamId
      }),
      this.app.prisma.notification.count({
        where: {
          userId: input.userId,
          readAt: null
        }
      })
    ]);

    const baseBlocks: HomeDashboard["blocks"] = {};

    if (input.role !== "INVITADO_EXTERNO") {
      const announcements = await this.listAnnouncements(input.userId);
      baseBlocks.announcements = announcements;
    }

    if (["COLABORADOR", "COORDINADOR_EQUIPO", "LIDER_PROYECTO"].includes(input.role)) {
      const collaboratorBlocks = await this.getCollaboratorBlocks(input.userId);
      Object.assign(baseBlocks, collaboratorBlocks);
    }

    if (["COORDINADOR_EQUIPO", "LIDER_PROYECTO"].includes(input.role)) {
      const coordinatorBlocks = await this.getCoordinatorBlocks(input.userId);
      Object.assign(baseBlocks, coordinatorBlocks);
    }

    if (["LIDER_PROYECTO"].includes(input.role)) {
      const leaderBlocks = await this.getLeaderBlocks(input.userId);
      Object.assign(baseBlocks, leaderBlocks);
    }

    if (input.role === "ADMINISTRADOR") {
      const adminBlocks = await this.getAdminBlocks();
      Object.assign(baseBlocks, adminBlocks);
    }

    if (input.role === "OBSERVADOR") {
      const observerBlocks = await this.getObserverBlocks(input.userId);
      Object.assign(baseBlocks, observerBlocks);
    }

    if (input.role === "INVITADO_EXTERNO") {
      const externalBlocks = await this.getExternalGuestBlocks({
        userId: input.userId,
        userEmail: user.email,
        organizationName
      });
      Object.assign(baseBlocks, externalBlocks);
    }

    return {
      generatedAt: now.toISOString(),
      role: input.role,
      organizationName,
      activeContext,
      unreadNotificationCount,
      blocks: baseBlocks,
      quickActions: this.getQuickActions(input.role, organizationName)
    };
  }
}
