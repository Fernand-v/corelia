import type { FastifyInstance } from "fastify";
import type { Prisma, SystemRole } from "@prisma/client";
import { getPermissionsForRole } from "../../lib/rbac.js";
import { hashPassword } from "../../lib/password.js";
import { createOpaqueToken, hashOpaqueToken } from "../../lib/tokens.js";
import {
  getFrontendSettings as getFrontendSettingsConfig,
  resetFrontendSettings as resetFrontendSettingsConfig,
  updateFrontendSettings as updateFrontendSettingsConfig
} from "../../lib/frontend-settings.js";
import { StatusService } from "../status/service.js";
import { ProjectTeamSyncService } from "../projects/team-sync-service.js";

const ROLE_ORDER: SystemRole[] = [
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR",
  "INVITADO_EXTERNO"
];

const ACTIVE_TASK_STATUSES: Array<"PENDIENTE" | "EN_REVISION"> = ["PENDIENTE", "EN_REVISION"];

const CODE_CATALOG_FIELDS = {
  TASK: [
    "TASK_DESCRIPTION",
    "TASK_BLOCKED_REASON",
    "TASK_STATUS_REASON",
    "TASK_REASSIGN_REASON",
    "TASK_SCHEDULE_REASON"
  ],
  PROJECT: ["PROJECT_DESCRIPTION"],
  TEAM: ["TEAM_DESCRIPTION"],
  MEETING: ["MEETING_DESCRIPTION", "MEETING_AGREEMENT_DESCRIPTION"],
  OBJECTIVE: ["OBJECTIVE_DESCRIPTION"],
  DECISION: ["DECISION_DESCRIPTION"],
  IDENTITY: ["OFFBOARDING_REASON"],
  AUDIT: ["AUDIT_REASON"]
} as const;

type CodeCatalogDomain = keyof typeof CODE_CATALOG_FIELDS;
type SystemHealthService = {
  service: "api" | "postgres" | "redis" | "storage" | "media";
  status: "up" | "down" | "degraded";
  detail: string | null;
};
type SystemOverallStatus = "OK" | "ERROR";

const SYSTEM_STATUS_ENTITY_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_STATUS_REASON_CODE = "SYSTEM_STATUS_CHANGE";

export class AdminService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";
  private readonly teamSync: ProjectTeamSyncService;

  constructor(private readonly app: FastifyInstance) {
    this.teamSync = new ProjectTeamSyncService(app);
  }

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private async assertAdmin(actorId: string) {
    const actor = await this.app.prisma.user.findUnique({
      where: { id: actorId },
      select: { baseRole: true }
    });

    if (!actor || actor.baseRole !== "ADMINISTRADOR") {
      throw this.forbidden("Solo administradores pueden usar el panel de administración");
    }
  }

  private normalizeLegacyCode(input: { code?: string | null; text?: string | null }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return AdminService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  private assertValidCatalogField(domain: CodeCatalogDomain, field: string) {
    const valid = CODE_CATALOG_FIELDS[domain].includes(field as never);
    if (!valid) {
      throw new Error(`Campo ${field} no válido para dominio ${domain}`);
    }
  }

  private inferUserState(input: {
    isActive: boolean;
    hasOnboardingInProgress: boolean;
    hasOffboardingInProgress: boolean;
  }): "ACTIVO" | "INACTIVO" | "ONBOARDING" | "OFFBOARDING" {
    if (input.hasOffboardingInProgress) {
      return "OFFBOARDING";
    }

    if (input.hasOnboardingInProgress) {
      return "ONBOARDING";
    }

    if (!input.isActive) {
      return "INACTIVO";
    }

    return "ACTIVO";
  }

  private getOverallSystemStatus(services: SystemHealthService[]): SystemOverallStatus {
    return services.some((service) => service.status !== "up") ? "ERROR" : "OK";
  }

  private normalizeSystemServices(services: SystemHealthService[]): SystemHealthService[] {
    return [...services].sort((a, b) => a.service.localeCompare(b.service));
  }

  private parseSnapshotFromAuditData(
    data: Prisma.JsonValue | null
  ): { services: SystemHealthService[]; overallStatus: SystemOverallStatus } | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const objectData = data as Prisma.JsonObject;
    const snapshot = objectData.snapshot;
    const overallStatus = objectData.overallStatus;

    if (
      !Array.isArray(snapshot) ||
      (overallStatus !== "OK" && overallStatus !== "ERROR")
    ) {
      return null;
    }

    const services = snapshot
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const serviceItem = item as Prisma.JsonObject;
        const service = serviceItem.service;
        const status = serviceItem.status;
        const detail = serviceItem.detail;

        if (
          typeof service !== "string" ||
          !["api", "postgres", "redis", "storage", "media"].includes(service) ||
          typeof status !== "string" ||
          !["up", "down", "degraded"].includes(status)
        ) {
          return null;
        }

        if (detail !== null && typeof detail !== "string") {
          return null;
        }

        return {
          service: service as SystemHealthService["service"],
          status: status as SystemHealthService["status"],
          detail
        };
      })
      .filter((item): item is SystemHealthService => item !== null);

    return {
      services: this.normalizeSystemServices(services),
      overallStatus
    };
  }

  private diffSystemServices(
    previousServices: SystemHealthService[] | null,
    nextServices: SystemHealthService[]
  ) {
    const previousMap = new Map(
      (previousServices ?? []).map((service) => [service.service, service])
    );

    return nextServices
      .map((nextService) => {
        const previousService = previousMap.get(nextService.service) ?? null;
        const hasChanged =
          !previousService ||
          previousService.status !== nextService.status ||
          previousService.detail !== nextService.detail;

        if (!hasChanged) {
          return null;
        }

        return {
          service: nextService.service,
          previousStatus: previousService?.status ?? null,
          previousDetail: previousService?.detail ?? null,
          nextStatus: nextService.status,
          nextDetail: nextService.detail
        };
      })
      .filter((item): item is {
        service: SystemHealthService["service"];
        previousStatus: SystemHealthService["status"] | null;
        previousDetail: string | null;
        nextStatus: SystemHealthService["status"];
        nextDetail: string | null;
      } => item !== null);
  }

  private async listSystemStatusRecentChanges(limit = 10) {
    const entries = await this.app.prisma.auditLog.findMany({
      where: {
        entityType: "AUTOMATIZACION",
        entityId: SYSTEM_STATUS_ENTITY_ID,
        reasonCode: SYSTEM_STATUS_REASON_CODE
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return entries.map((entry) => {
      const parsedSnapshot = this.parseSnapshotFromAuditData(entry.newData);
      const changedServicesRaw =
        entry.newData &&
        typeof entry.newData === "object" &&
        !Array.isArray(entry.newData) &&
        Array.isArray((entry.newData as Prisma.JsonObject).changedServices)
          ? ((entry.newData as Prisma.JsonObject).changedServices as Prisma.JsonArray)
          : [];

      const changedServices = changedServicesRaw
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const value = item as Prisma.JsonObject;
          const service = value.service;
          const previousStatus = value.previousStatus;
          const previousDetail = value.previousDetail;
          const nextStatus = value.nextStatus;
          const nextDetail = value.nextDetail;

          if (
            typeof service !== "string" ||
            !["api", "postgres", "redis", "storage", "media"].includes(service) ||
            (previousStatus !== null &&
              (typeof previousStatus !== "string" || !["up", "down", "degraded"].includes(previousStatus))) ||
            typeof nextStatus !== "string" ||
            !["up", "down", "degraded"].includes(nextStatus) ||
            (previousDetail !== null && typeof previousDetail !== "string") ||
            (nextDetail !== null && typeof nextDetail !== "string")
          ) {
            return null;
          }

          return {
            service: service as SystemHealthService["service"],
            previousStatus: previousStatus as SystemHealthService["status"] | null,
            previousDetail: previousDetail as string | null,
            nextStatus: nextStatus as SystemHealthService["status"],
            nextDetail: nextDetail as string | null
          };
        })
        .filter((item): item is {
          service: SystemHealthService["service"];
          previousStatus: SystemHealthService["status"] | null;
          previousDetail: string | null;
          nextStatus: SystemHealthService["status"];
          nextDetail: string | null;
        } => item !== null);

      return {
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        userId: entry.userId,
        reason: entry.reason,
        overallStatus: parsedSnapshot?.overallStatus ?? "ERROR",
        changedServices
      };
    });
  }

  async listUsers(
    actorId: string,
    input: {
      search?: string;
      role?: SystemRole;
      teamId?: string;
      state?: "ACTIVO" | "INACTIVO" | "ONBOARDING" | "OFFBOARDING";
    }
  ) {
    await this.assertAdmin(actorId);

    const where: Prisma.UserWhereInput = {};

    if (input.search) {
      where.OR = [
        { firstName: { contains: input.search, mode: "insensitive" } },
        { lastName: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } }
      ];
    }

    if (input.role) {
      where.baseRole = input.role;
    }

    if (input.teamId) {
      where.teamMemberships = {
        some: {
          teamId: input.teamId
        }
      };
    }

    if (input.state === "ACTIVO") {
      where.isActive = true;
    }

    if (input.state === "INACTIVO") {
      where.isActive = false;
    }

    if (input.state === "ONBOARDING") {
      where.onboardingRuns = {
        some: {
          completedAt: null
        }
      };
    }

    if (input.state === "OFFBOARDING") {
      where.offboardingRecords = {
        some: {
          archivedAt: null
        }
      };
    }

    const [users, total] = await Promise.all([
      this.app.prisma.user.findMany({
        where,
        include: {
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            take: 1
          },
          onboardingRuns: {
            where: {
              completedAt: null
            },
            select: {
              id: true
            },
            take: 1
          },
          offboardingRecords: {
            where: {
              archivedAt: null
            },
            select: {
              id: true
            },
            take: 1
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.app.prisma.user.count({ where })
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.baseRole,
        teamId: user.teamMemberships[0]?.team.id ?? null,
        teamName: user.teamMemberships[0]?.team.name ?? null,
        state: this.inferUserState({
          isActive: user.isActive,
          hasOnboardingInProgress: user.onboardingRuns.length > 0,
          hasOffboardingInProgress: user.offboardingRecords.length > 0
        }),
        createdAt: user.createdAt.toISOString(),
        deactivatedAt: user.deactivatedAt?.toISOString() ?? null
      })),
      total
    };
  }

  async createUser(
    actorId: string,
    input: {
      email: string;
      firstName: string;
      lastName: string;
      password?: string;
      baseRole: SystemRole;
      teamId?: string;
      workSchedule?: {
        timezone: string;
        weekDays: number[];
        startHour: string;
        endHour: string;
      };
      startOnboarding: boolean;
      checklistId?: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const tempPassword = `Corelia!${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const passwordHash = await hashPassword(input.password ?? tempPassword);

    const created = await this.app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          baseRole: input.baseRole,
          passwordHash
        }
      });

      if (input.teamId) {
        await tx.teamMember.create({
          data: {
            teamId: input.teamId,
            userId: user.id
          }
        });

        await this.teamSync.handleTeamMembershipAdded(
          {
            teamId: input.teamId,
            userId: user.id
          },
          tx
        );
      }

      if (input.workSchedule) {
        await tx.workSchedule.upsert({
          where: {
            userId: user.id
          },
          update: {
            timezone: input.workSchedule.timezone,
            weekDays: input.workSchedule.weekDays,
            startHour: input.workSchedule.startHour,
            endHour: input.workSchedule.endHour
          },
          create: {
            userId: user.id,
            timezone: input.workSchedule.timezone,
            weekDays: input.workSchedule.weekDays,
            startHour: input.workSchedule.startHour,
            endHour: input.workSchedule.endHour
          }
        });
      }

      let onboardingRunId: string | null = null;
      if (input.startOnboarding) {
        const checklist = input.checklistId
          ? await tx.onboardingChecklist.findUnique({
              where: {
                id: input.checklistId
              },
              include: {
                items: true
              }
            })
          :
            (await tx.onboardingChecklist.findFirst({
              where: {
                isDefault: true
              },
              include: {
                items: true
              }
            })) ??
            (await tx.onboardingChecklist.findFirst({
              include: {
                items: true
              }
            }));

        if (checklist) {
          const run = await tx.onboardingRun.create({
            data: {
              checklistId: checklist.id,
              userId: user.id,
              steps: {
                create: checklist.items.map((item) => ({
                  stepKey: item.stepKey
                }))
              }
            }
          });
          onboardingRunId = run.id;
        }
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        baseRole: user.baseRole,
        temporaryPassword: input.password ? null : tempPassword,
        onboardingRunId
      };
    });

    return created;
  }

  async updateUser(
    actorId: string,
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      baseRole?: SystemRole;
      teamId?: string | null;
      isActive?: boolean;
      workSchedule?: {
        timezone: string;
        weekDays: number[];
        startHour: string;
        endHour: string;
      };
    }
  ) {
    await this.assertAdmin(actorId);

    const result = await this.app.prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {};

      if (input.firstName !== undefined) {
        updateData.firstName = input.firstName;
      }
      if (input.lastName !== undefined) {
        updateData.lastName = input.lastName;
      }
      if (input.email !== undefined) {
        updateData.email = input.email;
      }
      if (input.baseRole !== undefined) {
        updateData.baseRole = input.baseRole;
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
        updateData.deactivatedAt = input.isActive ? null : new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: updateData
        });
      }

      if (input.teamId !== undefined) {
        const previousMemberships = await tx.teamMember.findMany({
          where: {
            userId
          },
          select: {
            teamId: true
          }
        });
        const previousTeamIds = [...new Set(previousMemberships.map((membership) => membership.teamId))];

        await tx.teamMember.deleteMany({
          where: {
            userId
          }
        });

        const nextTeamIds: string[] = [];
        if (input.teamId) {
          await tx.teamMember.create({
            data: {
              teamId: input.teamId,
              userId
            }
          });
          nextTeamIds.push(input.teamId);
        }

        const removedTeamIds = previousTeamIds.filter((teamId) => !nextTeamIds.includes(teamId));
        const addedTeamIds = nextTeamIds.filter((teamId) => !previousTeamIds.includes(teamId));

        for (const teamId of removedTeamIds) {
          await this.teamSync.handleTeamMembershipRemoved(
            {
              teamId,
              userId
            },
            tx
          );
        }

        for (const teamId of addedTeamIds) {
          await this.teamSync.handleTeamMembershipAdded(
            {
              teamId,
              userId
            },
            tx
          );
        }
      }

      if (input.workSchedule) {
        await tx.workSchedule.upsert({
          where: {
            userId
          },
          update: {
            timezone: input.workSchedule.timezone,
            weekDays: input.workSchedule.weekDays,
            startHour: input.workSchedule.startHour,
            endHour: input.workSchedule.endHour
          },
          create: {
            userId,
            timezone: input.workSchedule.timezone,
            weekDays: input.workSchedule.weekDays,
            startHour: input.workSchedule.startHour,
            endHour: input.workSchedule.endHour
          }
        });
      }

      return tx.user.findUnique({
        where: {
          id: userId
        },
        include: {
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            take: 1
          }
        }
      });
    });

    return {
      id: result?.id,
      fullName: result ? `${result.firstName} ${result.lastName}`.trim() : null,
      email: result?.email ?? null,
      role: result?.baseRole ?? null,
      teamId: result?.teamMemberships[0]?.teamId ?? null,
      teamName: result?.teamMemberships[0]?.team.name ?? null,
      isActive: result?.isActive ?? false
    };
  }

  async previewOffboarding(actorId: string, userId: string) {
    await this.assertAdmin(actorId);

    const [activeTasks, leadershipProjects, ownedDocuments] = await Promise.all([
      this.app.prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: {
            in: ACTIVE_TASK_STATUSES
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
        }
      }),
      this.app.prisma.projectMember.findMany({
        where: {
          userId,
          role: {
            in: ["LIDER_PROYECTO", "COORDINADOR_EQUIPO"]
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      this.app.prisma.fileObject.findMany({
        where: {
          ownerId: userId,
          deletedAt: null
        },
        select: {
          id: true,
          originalName: true
        },
        take: 100
      })
    ]);

    return {
      userId,
      activeTasks: activeTasks.map((task) => ({
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        projectName: task.project.name
      })),
      leadershipProjects: leadershipProjects.map((membership) => ({
        projectId: membership.project.id,
        projectName: membership.project.name,
        role: membership.role
      })),
      ownedDocuments: ownedDocuments.map((doc) => ({
        fileId: doc.id,
        originalName: doc.originalName
      }))
    };
  }

  async executeOffboarding(
    actorId: string,
    input: {
      userId: string;
      primaryTransferToUserId: string;
      reason: string;
      archiveHistory: boolean;
      taskTransfers: Array<{
        taskId: string;
        toUserId: string;
      }>;
      leadershipTransfers: Array<{
        projectId: string;
        role: SystemRole;
        toUserId: string;
      }>;
      documentTransfers: Array<{
        fileId: string;
        toUserId: string;
      }>;
    }
  ) {
    await this.assertAdmin(actorId);

    if (input.userId === input.primaryTransferToUserId) {
      throw new Error("El responsable principal no puede ser el mismo usuario");
    }

    const taskTransferMap = new Map<string, string>();
    for (const transfer of input.taskTransfers) {
      if (taskTransferMap.has(transfer.taskId)) {
        throw new Error(`Transferencia duplicada para tarea ${transfer.taskId}`);
      }
      taskTransferMap.set(transfer.taskId, transfer.toUserId);
    }

    const leadershipTransferMap = new Map<string, { toUserId: string; role: SystemRole }>();
    for (const transfer of input.leadershipTransfers) {
      if (leadershipTransferMap.has(transfer.projectId)) {
        throw new Error(`Transferencia duplicada para proyecto ${transfer.projectId}`);
      }
      leadershipTransferMap.set(transfer.projectId, {
        toUserId: transfer.toUserId,
        role: transfer.role
      });
    }

    const documentTransferMap = new Map<string, string>();
    for (const transfer of input.documentTransfers) {
      if (documentTransferMap.has(transfer.fileId)) {
        throw new Error(`Transferencia duplicada para documento ${transfer.fileId}`);
      }
      documentTransferMap.set(transfer.fileId, transfer.toUserId);
    }

    const [activeTasks, leadershipMemberships, ownedDocuments] = await Promise.all([
      this.app.prisma.task.findMany({
        where: {
          assigneeId: input.userId,
          status: {
            in: ACTIVE_TASK_STATUSES
          }
        },
        select: {
          id: true
        }
      }),
      this.app.prisma.projectMember.findMany({
        where: {
          userId: input.userId,
          role: {
            in: ["LIDER_PROYECTO", "COORDINADOR_EQUIPO"]
          }
        },
        select: {
          projectId: true,
          role: true
        }
      }),
      this.app.prisma.fileObject.findMany({
        where: {
          ownerId: input.userId,
          deletedAt: null
        },
        select: {
          id: true
        }
      })
    ]);

    const activeTaskIds = new Set(activeTasks.map((task) => task.id));
    const leadershipProjectIds = new Set(leadershipMemberships.map((membership) => membership.projectId));
    const ownedDocumentIds = new Set(ownedDocuments.map((document) => document.id));

    const missingTaskTransfers = [...activeTaskIds].filter((taskId) => !taskTransferMap.has(taskId));
    if (missingTaskTransfers.length > 0) {
      throw new Error("Faltan transferencias para tareas activas del usuario");
    }

    const invalidTaskTransfers = [...taskTransferMap.keys()].filter((taskId) => !activeTaskIds.has(taskId));
    if (invalidTaskTransfers.length > 0) {
      throw new Error("Hay tareas en transferencia que no pertenecen al usuario o no están activas");
    }

    const missingLeadershipTransfers = [...leadershipProjectIds].filter(
      (projectId) => !leadershipTransferMap.has(projectId)
    );
    if (missingLeadershipTransfers.length > 0) {
      throw new Error("Faltan transferencias para roles de liderazgo en proyectos");
    }

    const invalidLeadershipTransfers = [...leadershipTransferMap.keys()].filter(
      (projectId) => !leadershipProjectIds.has(projectId)
    );
    if (invalidLeadershipTransfers.length > 0) {
      throw new Error("Hay proyectos en transferencia de liderazgo que no corresponden al usuario");
    }

    const missingDocumentTransfers = [...ownedDocumentIds].filter((fileId) => !documentTransferMap.has(fileId));
    if (missingDocumentTransfers.length > 0) {
      throw new Error("Faltan transferencias para documentos del usuario");
    }

    const invalidDocumentTransfers = [...documentTransferMap.keys()].filter((fileId) => !ownedDocumentIds.has(fileId));
    if (invalidDocumentTransfers.length > 0) {
      throw new Error("Hay documentos en transferencia que no pertenecen al usuario");
    }

    const everyTransferTarget = new Set<string>([
      input.primaryTransferToUserId,
      ...input.taskTransfers.map((transfer) => transfer.toUserId),
      ...input.leadershipTransfers.map((transfer) => transfer.toUserId),
      ...input.documentTransfers.map((transfer) => transfer.toUserId)
    ]);

    if (everyTransferTarget.has(input.userId)) {
      throw new Error("El usuario de offboarding no puede ser destino de transferencia");
    }

    const targetUsers = await this.app.prisma.user.findMany({
      where: {
        id: {
          in: [...everyTransferTarget]
        },
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (targetUsers.length !== everyTransferTarget.size) {
      throw new Error("Uno o más usuarios destino no existen o están inactivos");
    }

    return this.app.prisma.$transaction(async (tx) => {
      const [taskTransferResults, documentTransferResults] = await Promise.all([
        Promise.all(
          input.taskTransfers.map((transfer) =>
            tx.task.updateMany({
              where: {
                id: transfer.taskId,
                assigneeId: input.userId,
                status: {
                  in: ACTIVE_TASK_STATUSES
                }
              },
              data: {
                assigneeId: transfer.toUserId
              }
            })
          )
        ),
        Promise.all(
          input.documentTransfers.map((transfer) =>
            tx.fileObject.updateMany({
              where: {
                id: transfer.fileId,
                ownerId: input.userId,
                deletedAt: null
              },
              data: {
                ownerId: transfer.toUserId
              }
            })
          )
        )
      ]);

      await Promise.all(
        input.leadershipTransfers.map((transfer) =>
          tx.projectMember.upsert({
            where: {
              projectId_userId: {
                projectId: transfer.projectId,
                userId: transfer.toUserId
              }
            },
            update: {
              role: transfer.role
            },
            create: {
              projectId: transfer.projectId,
              userId: transfer.toUserId,
              role: transfer.role
            }
          })
        )
      );

      const removedLeaderships = await tx.projectMember.deleteMany({
        where: {
          userId: input.userId,
          projectId: {
            in: input.leadershipTransfers.map((transfer) => transfer.projectId)
          }
        }
      });

      await tx.user.update({
        where: {
          id: input.userId
        },
        data: {
          isActive: false,
          deactivatedAt: new Date()
        }
      });

      await tx.offboardingRecord.create({
        data: {
          userId: input.userId,
          transferToUserId: input.primaryTransferToUserId,
          reason: input.reason,
          archivedAt: input.archiveHistory ? new Date() : null
        }
      });

      return {
        success: true,
        transferredTasks: taskTransferResults.reduce((acc, item) => acc + item.count, 0),
        transferredDocuments: documentTransferResults.reduce((acc, item) => acc + item.count, 0),
        transferredLeaderships: removedLeaderships.count
      };
    });
  }

  async listInternalInvites(actorId: string) {
    await this.assertAdmin(actorId);

    const invites = await this.app.prisma.internalInvite.findMany({
      where: {
        acceptedAt: null
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        team: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      items: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        baseRole: invite.baseRole,
        teamId: invite.teamId,
        teamName: invite.team?.name ?? null,
        expiresAt: invite.expiresAt.toISOString(),
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        resentAt: invite.resentAt?.toISOString() ?? null,
        createdByName: `${invite.createdBy.firstName} ${invite.createdBy.lastName}`.trim()
      })),
      total: invites.length
    };
  }

  async createInternalInvite(
    actorId: string,
    input: {
      email: string;
      baseRole: SystemRole;
      teamId?: string;
      expiresAt: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new Error("La fecha de expiración de la invitación debe estar en el futuro");
    }

    const [existingUser, existingInvite] = await Promise.all([
      this.app.prisma.user.findUnique({
        where: {
          email: input.email
        },
        select: {
          id: true
        }
      }),
      this.app.prisma.internalInvite.findFirst({
        where: {
          email: input.email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: new Date()
          }
        },
        select: {
          id: true
        }
      })
    ]);

    if (existingUser) {
      throw new Error("Ya existe un usuario activo o registrado con este email");
    }

    if (existingInvite) {
      throw new Error("Ya existe una invitación interna activa para este email");
    }

    const token = createOpaqueToken();
    const tokenHash = hashOpaqueToken(token);

    const invite = await this.app.prisma.internalInvite.create({
      data: {
        email: input.email,
        baseRole: input.baseRole,
        teamId: input.teamId,
        expiresAt,
        tokenHash,
        createdById: actorId
      }
    });

    return {
      id: invite.id,
      email: invite.email,
      baseRole: invite.baseRole,
      teamId: invite.teamId,
      expiresAt: invite.expiresAt.toISOString(),
      linkPreview: `${process.env.CORELIA_APP_URL ?? "http://localhost:3000"}/activate-invite?token=${encodeURIComponent(token)}`
    };
  }

  async revokeInternalInvite(actorId: string, inviteId: string) {
    await this.assertAdmin(actorId);

    const invite = await this.app.prisma.internalInvite.update({
      where: {
        id: inviteId
      },
      data: {
        revokedAt: new Date()
      }
    });

    return {
      id: invite.id,
      revokedAt: invite.revokedAt?.toISOString() ?? null
    };
  }

  async resendInternalInvite(actorId: string, inviteId: string, expiresAt?: string) {
    await this.assertAdmin(actorId);

    const existing = await this.app.prisma.internalInvite.findUnique({
      where: {
        id: inviteId
      }
    });

    if (!existing) {
      throw new Error("Invitación interna no encontrada");
    }

    if (existing.acceptedAt) {
      throw new Error("La invitación ya fue aceptada");
    }

    const now = new Date();
    const nextExpiresAt = expiresAt
      ? new Date(expiresAt)
      : existing.expiresAt > now
        ? existing.expiresAt
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(nextExpiresAt.getTime()) || nextExpiresAt <= now) {
      throw new Error("La nueva expiración debe ser una fecha futura válida");
    }

    const token = createOpaqueToken();
    const tokenHash = hashOpaqueToken(token);

    const invite = await this.app.prisma.internalInvite.update({
      where: {
        id: inviteId
      },
      data: {
        tokenHash,
        expiresAt: nextExpiresAt,
        revokedAt: null,
        resentAt: now
      }
    });

    return {
      id: invite.id,
      expiresAt: invite.expiresAt.toISOString(),
      linkPreview: `${process.env.CORELIA_APP_URL ?? "http://localhost:3000"}/activate-invite?token=${encodeURIComponent(token)}`
    };
  }

  async listGuestInvites(actorId: string) {
    await this.assertAdmin(actorId);

    const invites = await this.app.prisma.guestInvite.findMany({
      include: {
        createdBy: {
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

    return {
      items: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        resourceType: invite.resourceType,
        resourceId: invite.resourceId,
        expiresAt: invite.expiresAt.toISOString(),
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        createdByName: `${invite.createdBy.firstName} ${invite.createdBy.lastName}`.trim()
      })),
      total: invites.length
    };
  }

  async createGuestInvite(
    actorId: string,
    input: {
      email: string;
      resourceType: "PROYECTO" | "ARCHIVO" | "DOCUMENTO";
      resourceId: string;
      expiresAt: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const token = crypto.randomUUID();
    const tokenHash = await this.app.jwt.sign({ token }, { expiresIn: "15m" });

    const invite = await this.app.prisma.guestInvite.create({
      data: {
        email: input.email,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        expiresAt: new Date(input.expiresAt),
        tokenHash,
        createdById: actorId
      }
    });

    return {
      id: invite.id,
      email: invite.email,
      resourceType: invite.resourceType,
      resourceId: invite.resourceId,
      expiresAt: invite.expiresAt.toISOString(),
      linkPreview: `${process.env.CORELIA_APP_URL ?? "http://localhost:3000"}/invite/${invite.id}`
    };
  }

  async revokeGuestInvite(actorId: string, inviteId: string) {
    await this.assertAdmin(actorId);

    const invite = await this.app.prisma.guestInvite.update({
      where: {
        id: inviteId
      },
      data: {
        revokedAt: new Date()
      }
    });

    return {
      id: invite.id,
      revokedAt: invite.revokedAt?.toISOString() ?? null
    };
  }

  async extendGuestInvite(actorId: string, inviteId: string, expiresAt: string) {
    await this.assertAdmin(actorId);

    const invite = await this.app.prisma.guestInvite.update({
      where: {
        id: inviteId
      },
      data: {
        expiresAt: new Date(expiresAt),
        revokedAt: null
      }
    });

    return {
      id: invite.id,
      expiresAt: invite.expiresAt.toISOString()
    };
  }

  async listTeams(actorId: string) {
    await this.assertAdmin(actorId);

    const teams = await this.app.prisma.team.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                baseRole: true
              }
            }
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    const descriptionCodes = [
      ...new Set(
        teams
          .map((team) => team.descriptionCode)
          .filter((code): code is string => Boolean(code))
      )
    ];
    const descriptionCatalog =
      descriptionCodes.length > 0
        ? await this.app.prisma.teamCodeCatalog.findMany({
            where: {
              field: "TEAM_DESCRIPTION",
              code: {
                in: descriptionCodes
              }
            },
            select: {
              code: true,
              label: true
            }
          })
        : [];
    const labels = new Map(descriptionCatalog.map((entry) => [entry.code, entry.label]));
    labels.set(AdminService.LEGACY_UNMAPPED_CODE, "Descripción heredada");

    const items = await Promise.all(
      teams.map(async (team) => {
        const coordinator =
          team.members.find((member) => member.user.baseRole === "COORDINADOR_EQUIPO") ?? null;
        const memberIds = team.members.map((member) => member.userId);
        const projectMemberships =
          memberIds.length === 0
            ? []
            : await this.app.prisma.projectMember.findMany({
                where: {
                  userId: {
                    in: memberIds
                  }
                },
                select: {
                  projectId: true
                }
              });

        return {
          id: team.id,
          name: team.name,
          description: team.description,
          descriptionCode: team.descriptionCode,
          descriptionLabel: team.descriptionCode ? labels.get(team.descriptionCode) ?? team.descriptionCode : null,
          coordinator: coordinator
            ? {
                userId: coordinator.userId,
                fullName: `${coordinator.user.firstName} ${coordinator.user.lastName}`.trim()
              }
            : null,
          membersCount: team.members.length,
          activeProjects: new Set(projectMemberships.map((membership) => membership.projectId)).size
        };
      })
    );

    return {
      items,
      total: teams.length
    };
  }

  async getTeam(actorId: string, teamId: string) {
    await this.assertAdmin(actorId);

    const team = await this.app.prisma.team.findUnique({
      where: {
        id: teamId
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                baseRole: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      throw new Error("Equipo no encontrado");
    }

    const memberIds = team.members.map((member) => member.userId);
    const projectMemberships =
      memberIds.length === 0
        ? []
        : await this.app.prisma.projectMember.findMany({
            where: {
              userId: {
                in: memberIds
              }
            },
            select: {
              projectId: true
            }
          });

    const coordinator = team.members.find((member) => member.user.baseRole === "COORDINADOR_EQUIPO");

    const descriptionLabel = team.descriptionCode
      ? (
          await this.app.prisma.teamCodeCatalog.findFirst({
            where: {
              field: "TEAM_DESCRIPTION",
              code: team.descriptionCode
            },
            select: { label: true }
          })
        )?.label ??
        (team.descriptionCode === AdminService.LEGACY_UNMAPPED_CODE
          ? "Descripción heredada"
          : team.descriptionCode)
      : null;

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      descriptionCode: team.descriptionCode,
      descriptionLabel,
      coordinatorUserId: coordinator?.userId ?? null,
      activeProjects: new Set(projectMemberships.map((membership) => membership.projectId)).size,
      members: team.members.map((member) => ({
        userId: member.userId,
        fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
        email: member.user.email,
        baseRole: member.user.baseRole
      }))
    };
  }

  async createTeam(
    actorId: string,
    input: {
      name: string;
      description?: string;
      descriptionCode?: string;
      coordinatorUserId?: string;
      memberIds: string[];
    }
  ) {
    await this.assertAdmin(actorId);

    const memberIds = [...new Set([...(input.memberIds ?? []), ...(input.coordinatorUserId ? [input.coordinatorUserId] : [])])];

    const team = await this.app.prisma.team.create({
      data: {
        name: input.name,
        description: input.description,
        descriptionCode: this.normalizeLegacyCode({
          code: input.descriptionCode,
          text: input.description
        }),
        members: {
          create: memberIds.map((memberId) => ({
            userId: memberId
          }))
        }
      }
    });

    return {
      id: team.id,
      name: team.name
    };
  }

  async updateTeam(
    actorId: string,
    teamId: string,
    input: {
      name?: string;
      description?: string | null;
      descriptionCode?: string | null;
      coordinatorUserId?: string | null;
      memberIds?: string[];
    }
  ) {
    await this.assertAdmin(actorId);

    await this.app.prisma.$transaction(async (tx) => {
      const updateData: Prisma.TeamUpdateInput = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
        updateData.descriptionCode = this.normalizeLegacyCode({
          code: input.descriptionCode,
          text: input.description
        });
      } else if (input.descriptionCode !== undefined) {
        updateData.descriptionCode = input.descriptionCode;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.team.update({
          where: {
            id: teamId
          },
          data: updateData
        });
      }

      const shouldReplaceMembers = input.memberIds !== undefined || input.coordinatorUserId !== undefined;

      if (shouldReplaceMembers) {
        const beforeMembers = (
          await tx.teamMember.findMany({
            where: {
              teamId
            },
            select: {
              userId: true
            }
          })
        ).map((member) => member.userId);

        const desiredMembers = input.memberIds ?? beforeMembers;
        const nextMembers = [...new Set(desiredMembers)];

        if (input.coordinatorUserId) {
          nextMembers.push(input.coordinatorUserId);
        }

        const normalizedMembers = [...new Set(nextMembers)];

        await tx.teamMember.deleteMany({
          where: {
            teamId
          }
        });

        if (normalizedMembers.length > 0) {
          await tx.teamMember.createMany({
            data: normalizedMembers.map((userId) => ({
              teamId,
              userId
            })),
            skipDuplicates: true
          });
        }

        await this.teamSync.handleTeamMembershipSetChanged(
          {
            teamId,
            beforeUserIds: beforeMembers,
            afterUserIds: normalizedMembers
          },
          tx
        );
      }
    });

    return this.listTeams(actorId);
  }

  async dissolveTeam(actorId: string, teamId: string) {
    await this.assertAdmin(actorId);

    const now = new Date();
    const [teamMembers, activeMeetings, activeObjectives, linkedFolders, linkedChannels, linkedProjectLinks] =
      await Promise.all([
      this.app.prisma.teamMember.findMany({
        where: {
          teamId
        },
        select: {
          userId: true
        }
      }),
      this.app.prisma.meeting.count({
        where: {
          teamId,
          status: {
            in: ["PROGRAMADA", "EN_CURSO"]
          }
        }
      }),
      this.app.prisma.objective.count({
        where: {
          teamId,
          targetDate: {
            gte: now
          }
        }
      }),
      this.app.prisma.folder.count({
        where: {
          teamId
        }
      }),
      this.app.prisma.channel.count({
        where: {
          teamId
        }
      }),
      this.app.prisma.projectTeamLink.count({
        where: {
          teamId
        }
      })
    ]);

    const teamMemberIds = teamMembers.map((member) => member.userId);
    const projectMemberships =
      teamMemberIds.length === 0
        ? []
        : await this.app.prisma.projectMember.findMany({
            where: {
              userId: {
                in: teamMemberIds
              }
            },
            select: {
              projectId: true
            }
          });

    const activeProjects = new Set(projectMemberships.map((membership) => membership.projectId)).size;

    if (
      activeMeetings > 0 ||
      activeObjectives > 0 ||
      linkedFolders > 0 ||
      linkedChannels > 0 ||
      linkedProjectLinks > 0 ||
      activeProjects > 0
    ) {
      throw new Error(
        "No se puede disolver el equipo mientras tenga proyectos activos, reuniones activas u otros recursos vinculados"
      );
    }

    await this.app.prisma.team.delete({
      where: {
        id: teamId
      }
    });

    return {
      success: true
    };
  }

  async getRolesMatrix(actorId: string) {
    await this.assertAdmin(actorId);

    return ROLE_ORDER.map((role) => ({
      role,
      permissions: getPermissionsForRole(role)
    }));
  }

  async getAccessByResource(
    actorId: string,
    input: {
      type: "PROYECTO" | "EQUIPO" | "ARCHIVO" | "DOCUMENTO";
      id: string;
    }
  ) {
    await this.assertAdmin(actorId);

    if (input.type === "PROYECTO") {
      const members = await this.app.prisma.projectMember.findMany({
        where: {
          projectId: input.id
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      const externalInvites = await this.app.prisma.guestInvite.findMany({
        where: {
          resourceType: "PROYECTO",
          resourceId: input.id,
          revokedAt: null
        }
      });

      return [
        ...members.map((member) => ({
          userId: member.userId,
          fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
          email: member.user.email,
          accessLevel: member.role
        })),
        ...externalInvites.map((invite) => ({
          userId: invite.id,
          fullName: invite.email,
          email: invite.email,
          accessLevel: "LECTURA_EXTERNA"
        }))
      ];
    }

    if (input.type === "EQUIPO") {
      const members = await this.app.prisma.teamMember.findMany({
        where: {
          teamId: input.id
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              baseRole: true
            }
          }
        }
      });

      return members.map((member) => ({
        userId: member.userId,
        fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
        email: member.user.email,
        accessLevel: member.user.baseRole
      }));
    }

    const file = await this.app.prisma.fileObject.findUnique({
      where: {
        id: input.id
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const resourceType = input.type === "DOCUMENTO" ? "DOCUMENTO" : "ARCHIVO";

    const invites = await this.app.prisma.guestInvite.findMany({
      where: {
        resourceType,
        resourceId: input.id,
        revokedAt: null
      }
    });

    return [
      ...(file
        ? [
            {
              userId: file.ownerId,
              fullName: `${file.owner.firstName} ${file.owner.lastName}`.trim(),
              email: file.owner.email,
              accessLevel: "PROPIETARIO"
            }
          ]
        : []),
      ...invites.map((invite) => ({
        userId: invite.id,
        fullName: invite.email,
        email: invite.email,
        accessLevel: "LECTURA_EXTERNA"
      }))
    ];
  }

  private resolveAuditRange(input: { from?: string; to?: string }) {
    const now = new Date();
    const to = input.to ? new Date(input.to) : now;
    if (Number.isNaN(to.getTime())) {
      throw new Error("Fecha hasta inválida");
    }

    const from = input.from ? new Date(input.from) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime())) {
      throw new Error("Fecha desde inválida");
    }

    if (from.getTime() > to.getTime()) {
      throw new Error("El rango de fechas es inválido");
    }

    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new Error("El rango máximo permitido es de 90 días");
    }

    return { from, to };
  }

  private formatAuditActor(input: {
    user:
      | {
          firstName: string;
          lastName: string;
          email: string;
        }
      | null;
    userId: string | null;
  }) {
    if (!input.userId) {
      return "Sistema";
    }

    if (!input.user) {
      return input.userId;
    }

    const fullName = `${input.user.firstName} ${input.user.lastName}`.trim();
    return fullName || input.user.email || input.userId;
  }

  async getAuditReport(
    actorId: string,
    input: {
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
    }
  ) {
    await this.assertAdmin(actorId);
    const range = this.resolveAuditRange({
      from: input.from,
      to: input.to
    });

    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: range.from,
        lte: range.to
      }
    };

    const [items, total] = await Promise.all([
      this.app.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: "desc"
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      this.app.prisma.auditLog.count({ where })
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        entityType: item.entityType,
        action: item.action,
        entityId: item.entityId,
        reason: item.reason,
        reasonCode: item.reasonCode,
        userId: item.userId,
        actorName: this.formatAuditActor({
          user: item.user,
          userId: item.userId
        }),
        createdAt: item.createdAt.toISOString()
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      from: range.from.toISOString(),
      to: range.to.toISOString()
    };
  }

  async exportAuditReportCsv(
    actorId: string,
    input: {
      from?: string;
      to?: string;
    }
  ) {
    await this.assertAdmin(actorId);
    const range = this.resolveAuditRange({
      from: input.from,
      to: input.to
    });

    const items = await this.app.prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: range.from,
          lte: range.to
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10000,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    const escapeCsv = (value: string | null | undefined) => {
      const text = value ?? "";
      const normalized = text.replaceAll('"', '""');
      return `"${normalized}"`;
    };

    const header = ["fecha", "actor", "entityType", "action", "entityId", "reason", "reasonCode"];
    const rows = items.map((item) =>
      [
        item.createdAt.toISOString(),
        this.formatAuditActor({
          user: item.user,
          userId: item.userId
        }),
        item.entityType,
        item.action,
        item.entityId ?? "",
        item.reason ?? "",
        item.reasonCode ?? ""
      ]
        .map((value) => escapeCsv(value))
        .join(",")
    );

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      csv: [header.map((value) => escapeCsv(value)).join(","), ...rows].join("\n")
    };
  }

  async getSystemStatus(actorId: string) {
    await this.assertAdmin(actorId);

    const statusService = new StatusService(this.app);
    const status = await statusService.getSystemStatus();
    const services = this.normalizeSystemServices(status.services);
    const overallStatus = this.getOverallSystemStatus(services);
    const recentChanges = await this.listSystemStatusRecentChanges();

    return {
      now: status.now,
      overallStatus,
      maintenance: status.maintenance,
      services,
      recentChanges
    };
  }

  async checkSystemStatus(actorId: string) {
    await this.assertAdmin(actorId);

    const statusService = new StatusService(this.app);
    const status = await statusService.getSystemStatus();
    const services = this.normalizeSystemServices(status.services);
    const overallStatus = this.getOverallSystemStatus(services);

    const previousEntry = await this.app.prisma.auditLog.findFirst({
      where: {
        entityType: "AUTOMATIZACION",
        entityId: SYSTEM_STATUS_ENTITY_ID,
        reasonCode: SYSTEM_STATUS_REASON_CODE
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const previousSnapshot = this.parseSnapshotFromAuditData(previousEntry?.newData ?? null);
    const changedServices = this.diffSystemServices(previousSnapshot?.services ?? null, services);
    const changed =
      !previousSnapshot ||
      previousSnapshot.overallStatus !== overallStatus ||
      changedServices.length > 0;

    const recentChanges = await this.listSystemStatusRecentChanges();

    return {
      now: status.now,
      overallStatus,
      maintenance: status.maintenance,
      services,
      changed,
      changedServices,
      auditLogged: changed,
      recentChanges,
      auditEvent: changed
        ? {
            entityType: "AUTOMATIZACION" as const,
            entityId: SYSTEM_STATUS_ENTITY_ID,
            action: "ACTUALIZAR" as const,
            reasonCode: SYSTEM_STATUS_REASON_CODE,
            reason:
              changedServices.length > 0
                ? `Cambio detectado en servicios: ${changedServices.map((item) => item.service).join(", ")}`
                : "Cambio detectado en estado general del sistema",
            previousData: previousSnapshot
              ? {
                  snapshot: previousSnapshot.services,
                  overallStatus: previousSnapshot.overallStatus
                }
              : null,
            newData: {
              snapshot: services,
              overallStatus,
              changedServices
            }
          }
        : null
    };
  }

  async listCodeCatalogs(
    actorId: string,
    input: {
      domain: CodeCatalogDomain;
      field?: string;
      includeInactive: boolean;
    }
  ) {
    await this.assertAdmin(actorId);
    if (input.field) {
      this.assertValidCatalogField(input.domain, input.field);
    }

    const whereBase = {
      ...(input.field ? { field: input.field as never } : {}),
      ...(input.includeInactive ? {} : { isActive: true })
    };

    const mapItem = (item: {
      id: string;
      field: string;
      code: string;
      label: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
      id: item.id,
      domain: input.domain,
      field: item.field,
      code: item.code,
      label: item.label,
      description: item.description,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    });

    if (input.domain === "TASK") {
      return (
        await this.app.prisma.taskCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "PROJECT") {
      return (
        await this.app.prisma.projectCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "TEAM") {
      return (
        await this.app.prisma.teamCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "MEETING") {
      return (
        await this.app.prisma.meetingCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "OBJECTIVE") {
      return (
        await this.app.prisma.objectiveCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "DECISION") {
      return (
        await this.app.prisma.decisionCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "IDENTITY") {
      return (
        await this.app.prisma.identityCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }

    return (
      await this.app.prisma.auditCodeCatalog.findMany({
        where: whereBase,
        orderBy: [{ field: "asc" }, { code: "asc" }]
      })
    ).map((item) => mapItem(item));
  }

  async createCodeCatalog(
    actorId: string,
    input: {
      domain: CodeCatalogDomain;
      field: string;
      code: string;
      label: string;
      description?: string;
    }
  ) {
    await this.assertAdmin(actorId);
    this.assertValidCatalogField(input.domain, input.field);

    const data = {
      field: input.field as never,
      code: input.code,
      label: input.label,
      description: input.description ?? null
    };

    if (input.domain === "TASK") {
      return this.app.prisma.taskCodeCatalog.create({ data });
    }
    if (input.domain === "PROJECT") {
      return this.app.prisma.projectCodeCatalog.create({ data });
    }
    if (input.domain === "TEAM") {
      return this.app.prisma.teamCodeCatalog.create({ data });
    }
    if (input.domain === "MEETING") {
      return this.app.prisma.meetingCodeCatalog.create({ data });
    }
    if (input.domain === "OBJECTIVE") {
      return this.app.prisma.objectiveCodeCatalog.create({ data });
    }
    if (input.domain === "DECISION") {
      return this.app.prisma.decisionCodeCatalog.create({ data });
    }
    if (input.domain === "IDENTITY") {
      return this.app.prisma.identityCodeCatalog.create({ data });
    }

    return this.app.prisma.auditCodeCatalog.create({ data });
  }

  async updateCodeCatalog(
    actorId: string,
    domain: CodeCatalogDomain,
    id: string,
    input: {
      label?: string;
      description?: string | null;
      isActive?: boolean;
    }
  ) {
    await this.assertAdmin(actorId);
    const data = {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    };

    if (domain === "TASK") {
      return this.app.prisma.taskCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "PROJECT") {
      return this.app.prisma.projectCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "TEAM") {
      return this.app.prisma.teamCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "MEETING") {
      return this.app.prisma.meetingCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "OBJECTIVE") {
      return this.app.prisma.objectiveCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "DECISION") {
      return this.app.prisma.decisionCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "IDENTITY") {
      return this.app.prisma.identityCodeCatalog.update({ where: { id }, data });
    }

    return this.app.prisma.auditCodeCatalog.update({ where: { id }, data });
  }

  async deactivateCodeCatalog(actorId: string, domain: CodeCatalogDomain, id: string) {
    await this.assertAdmin(actorId);
    return this.updateCodeCatalog(actorId, domain, id, { isActive: false });
  }

  async getFrontendSettings(actorId: string) {
    await this.assertAdmin(actorId);
    return getFrontendSettingsConfig(this.app.prisma);
  }

  async updateFrontendSettings(
    actorId: string,
    input: {
      organizationName?: string;
      taskStatusColors?: {
        PENDIENTE?: string;
        EN_REVISION?: string;
        COMPLETADA?: string;
      };
    }
  ) {
    await this.assertAdmin(actorId);
    return updateFrontendSettingsConfig(this.app.prisma, input);
  }

  async resetFrontendSettings(actorId: string) {
    await this.assertAdmin(actorId);
    return resetFrontendSettingsConfig(this.app.prisma);
  }

  async getOverview(
    actorId: string,
    input: {
      page: number;
      pageSize: number;
    }
  ) {
    await this.assertAdmin(actorId);

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const statusService = new StatusService(this.app);
    const [status, frontendSettings] = await Promise.all([
      statusService.getSystemStatus(),
      getFrontendSettingsConfig(this.app.prisma)
    ]);

    const [
      users,
      teams,
      projects,
      tasks,
      overdueTasks,
      automationsTotal,
      automationsEnabled,
      failedAutomations,
      formsPending,
      formsPendingApproval,
      formsByStatus,
      webhooksTotal,
      webhooksEnabled,
      latestDeliveries,
      activeAnnouncements,
      recentAnnouncements,
      latestJobs,
      latestEvents
    ] = await Promise.all([
      this.app.prisma.user.count(),
      this.app.prisma.team.count(),
      this.app.prisma.project.count(),
      this.app.prisma.task.count(),
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
      this.app.prisma.automationRule.count(),
      this.app.prisma.automationRule.count({
        where: {
          enabled: true
        }
      }),
      this.app.prisma.webhookDelivery.count({
        where: {
          success: false,
          attemptedAt: {
            gte: dayAgo
          }
        }
      }),
      this.app.prisma.formRequest.count({
        where: {
          status: "PENDIENTE"
        }
      }),
      this.app.prisma.formRequest.count({
        where: {
          status: "PENDIENTE",
          approverId: {
            not: null
          }
        }
      }),
      this.app.prisma.formRequest.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.app.prisma.webhookEndpoint.count(),
      this.app.prisma.webhookEndpoint.count({
        where: {
          enabled: true
        }
      }),
      this.app.prisma.webhookDelivery.findMany({
        orderBy: {
          attemptedAt: "desc"
        },
        take: 10
      }),
      this.app.prisma.announcement.count({
        where: {
          expiresAt: {
            gt: now
          }
        }
      }),
      this.app.prisma.announcement.findMany({
        where: {
          expiresAt: {
            gt: now
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }),
      this.app.prisma.importJob.findMany({
        orderBy: {
          startedAt: "desc"
        },
        take: 10
      }),
      this.app.prisma.auditLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })
    ]);

    const formsStatusRows = formsByStatus.map((row) => ({
      status: row.status,
      total: row._count._all
    }));

    return {
      generatedAt: now.toISOString(),
      totals: {
        users,
        teams,
        projects,
        tasks,
        overdueTasks
      },
      organization: {
        name: frontendSettings.organizationName,
        defaultTimezone: process.env.CORELIA_DEFAULT_TIMEZONE ?? "UTC",
        defaultLanguage: process.env.CORELIA_DEFAULT_LANGUAGE ?? "es",
        workingDays: (process.env.CORELIA_DEFAULT_WORK_DAYS ?? "1,2,3,4,5")
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
        workingHours: {
          startHour: process.env.CORELIA_DEFAULT_WORK_START ?? "09:00",
          endHour: process.env.CORELIA_DEFAULT_WORK_END ?? "18:00"
        }
      },
      automations: {
        total: automationsTotal,
        enabled: automationsEnabled,
        failedLast24h: failedAutomations
      },
      forms: {
        activeRequests: formsPending,
        pendingApproval: formsPendingApproval,
        byStatus: formsStatusRows
      },
      system: {
        maintenanceEnabled: status.maintenance.enabled,
        maintenanceMessage: status.maintenance.message,
        services: status.services
      },
      integrations: {
        webhooksConfigured: webhooksTotal,
        webhooksEnabled,
        latestDeliveries: latestDeliveries.map((delivery) => ({
          id: delivery.id,
          endpointId: delivery.endpointId,
          success: delivery.success,
          statusCode: delivery.statusCode,
          attemptedAt: delivery.attemptedAt.toISOString()
        }))
      },
      announcements: {
        active: activeAnnouncements,
        recent: recentAnnouncements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          createdAt: announcement.createdAt.toISOString(),
          expiresAt: announcement.expiresAt.toISOString()
        }))
      },
      imports: {
        latestJobs: latestJobs.map((job) => ({
          id: job.id,
          source: job.source,
          filename: job.filename,
          startedAt: job.startedAt.toISOString(),
          finishedAt: job.finishedAt?.toISOString() ?? null,
          success: job.success
        }))
      },
      audit: {
        latestEvents: latestEvents.map((event) => ({
          id: event.id,
          entityType: event.entityType,
          action: event.action,
          createdAt: event.createdAt.toISOString(),
          userId: event.userId,
          userName: this.formatAuditActor({
            user: event.user,
            userId: event.userId
          })
        }))
      },
      pagination: {
        page: input.page,
        pageSize: input.pageSize
      }
    };
  }

  async backfillProjectGeneralChannels(actorId: string, input: { dryRun: boolean }) {
    await this.assertAdmin(actorId);

    const projects = await this.app.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const projectIds = projects.map((project) => project.id);
    const [projectMembers, projectChannels] = await Promise.all([
      projectIds.length
        ? this.app.prisma.projectMember.findMany({
            where: {
              projectId: {
                in: projectIds
              }
            },
            select: {
              projectId: true,
              userId: true
            }
          })
        : [],
      projectIds.length
        ? this.app.prisma.channel.findMany({
            where: {
              scope: "PROYECTO",
              projectId: {
                in: projectIds
              }
            },
            include: {
              members: {
                select: {
                  userId: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          })
        : []
    ]);

    const membersByProject = new Map<string, Set<string>>();
    for (const project of projects) {
      membersByProject.set(project.id, new Set([project.ownerId]));
    }
    for (const member of projectMembers) {
      const set = membersByProject.get(member.projectId) ?? new Set<string>();
      set.add(member.userId);
      membersByProject.set(member.projectId, set);
    }

    const channelsByProject = new Map<string, typeof projectChannels>();
    for (const channel of projectChannels) {
      if (!channel.projectId) {
        continue;
      }
      const list = channelsByProject.get(channel.projectId) ?? [];
      list.push(channel);
      channelsByProject.set(channel.projectId, list);
    }

    let channelsCreated = 0;
    let membershipsInserted = 0;

    for (const project of projects) {
      const memberIds = [...(membersByProject.get(project.id) ?? new Set<string>([project.ownerId]))];
      const candidates = channelsByProject.get(project.id) ?? [];
      const selected = candidates.find((channel) => /general/i.test(channel.name)) ?? candidates[0] ?? null;

      if (!selected) {
        channelsCreated += 1;
        membershipsInserted += memberIds.length;

        if (input.dryRun) {
          continue;
        }

        await this.app.prisma.channel.create({
          data: {
            name: `${project.name} · General`.slice(0, 120),
            scope: "PROYECTO",
            projectId: project.id,
            members: {
              create: memberIds.map((userId) => ({ userId }))
            }
          }
        });
        continue;
      }

      const existingMemberIds = new Set(selected.members.map((member) => member.userId));
      const missingMemberIds = memberIds.filter((userId) => !existingMemberIds.has(userId));
      membershipsInserted += missingMemberIds.length;

      if (input.dryRun || missingMemberIds.length === 0) {
        continue;
      }

      await this.app.prisma.channelMember.createMany({
        data: missingMemberIds.map((userId) => ({
          channelId: selected.id,
          userId
        })),
        skipDuplicates: true
      });
    }

    return {
      dryRun: input.dryRun,
      projectsScanned: projects.length,
      channelsCreated,
      membershipsInserted
    };
  }
}
