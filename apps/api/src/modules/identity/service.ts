import type { FastifyInstance } from "fastify";
import { getMostRestrictiveRole, getPermissionsForRole } from "../../lib/rbac.js";

const resolveRoleKey = (
  role: { key?: string | null; code?: string | number | null } | null | undefined
): string | undefined => {
  if (!role) {
    return undefined;
  }
  if (typeof role.key === "string") {
    return role.key;
  }
  if (typeof role.code === "string") {
    return role.code;
  }
  return undefined;
};

export class IdentityService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";
  private static readonly PRESENCE_ONLINE_KEY_PREFIX = "presence:online:";

  constructor(private readonly app: FastifyInstance) {}

  private presenceKey(userId: string) {
    return `${IdentityService.PRESENCE_ONLINE_KEY_PREFIX}${userId}`;
  }

  async getPresenceForUsers(userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return {
        items: []
      };
    }

    const redisClient = (this.app as {
      redis?: {
        pipeline?: () => {
          scard: (key: string) => void;
          exec: () => Promise<Array<[unknown, unknown]> | null>;
        };
        scard?: (key: string) => Promise<number | string | null>;
      };
    }).redis;

    let redisResult: Array<[unknown, unknown]> | null = null;

    if (redisClient?.pipeline) {
      const redisPipeline = redisClient.pipeline();
      for (const userId of uniqueUserIds) {
        redisPipeline.scard(this.presenceKey(userId));
      }
      redisResult = await redisPipeline.exec();
    } else if (redisClient?.scard) {
      const values = await Promise.all(
        uniqueUserIds.map(async (userId) => redisClient.scard?.(this.presenceKey(userId)) ?? 0)
      );
      redisResult = values.map((value) => [null, value] as [null, number | string | null]);
    }

    const onlineSet = new Set<string>();
    if (redisResult) {
      for (const [index, [error, value]] of redisResult.entries()) {
        if (error) {
          continue;
        }
        const userId = uniqueUserIds[index];
        if (!userId) {
          continue;
        }
        const socketsCount = typeof value === "number" ? value : Number(value ?? 0);
        if (socketsCount > 0) {
          onlineSet.add(userId);
        }
      }
    }

    const meetingParticipantModel = (this.app.prisma as {
      meetingParticipant?: {
        findMany?: (args: unknown) => Promise<Array<{ userId: string }>>;
      };
    }).meetingParticipant;

    const inMeetingRows = meetingParticipantModel?.findMany
      ? await meetingParticipantModel.findMany({
          where: {
            userId: { in: uniqueUserIds },
            joinedAt: { not: null },
            leftAt: null,
            meeting: {
              status: "EN_CURSO"
            }
          },
          select: {
            userId: true
          },
          distinct: ["userId"]
        })
      : [];
    const inMeetingSet = new Set(inMeetingRows.map((row) => row.userId));

    return {
      items: uniqueUserIds.map((userId) => ({
        userId,
        status: inMeetingSet.has(userId)
          ? ("EN_REUNION" as const)
          : onlineSet.has(userId)
            ? ("EN_LINEA" as const)
            : ("DESCONECTADO" as const)
      }))
    };
  }

  private normalizeLegacyCode(input: {
    code?: string | null | undefined;
    text?: string | null | undefined;
  }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return IdentityService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  async resolveActiveRole(userId: string, projectId?: string) {
    const guestRole = await this.app.prisma.role.findUnique({
      where: {
        key: "INVITADO_EXTERNO"
      },
      select: {
        id: true,
        key: true,
        code: true
      }
    });

    if (!guestRole) {
      throw new Error("Rol INVITADO_EXTERNO no configurado");
    }

    if (projectId) {
      const membership = await this.app.prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: {
          role: {
            select: {
              id: true,
              key: true,
              code: true
            }
          }
        }
      });

      const role = membership?.role ?? guestRole;
      const roleKey = resolveRoleKey(role) ?? "INVITADO_EXTERNO";
      return {
        userId,
        projectId,
        roleId: role.id,
        role: roleKey,
        permissions: getPermissionsForRole(roleKey)
      };
    }

    const memberships = await this.app.prisma.projectMember.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            id: true,
            key: true,
            code: true
          }
        }
      }
    });
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        baseRole: {
          select: {
            id: true,
            key: true,
            code: true
          }
        }
      }
    });

    const roles = memberships
      .map((m) => resolveRoleKey(m.role))
      .filter((role): role is string => Boolean(role));
    if (user?.baseRole) {
      const baseRoleKey = resolveRoleKey(user.baseRole);
      if (baseRoleKey) {
        roles.push(baseRoleKey);
      }
    }

    const role = getMostRestrictiveRole(roles.length ? roles : ["INVITADO_EXTERNO"]);
    const resolvedRole =
      memberships.find((membership) => resolveRoleKey(membership.role) === role)?.role ??
      (resolveRoleKey(user?.baseRole) === role ? user?.baseRole ?? null : null) ??
      (await this.app.prisma.role.findUnique({
        where: {
          key: role
        },
        select: {
          id: true,
          key: true,
          code: true
        }
      })) ??
      guestRole;

    const resolvedRoleKey = resolveRoleKey(resolvedRole) ?? "INVITADO_EXTERNO";

    return {
      userId,
      projectId: null,
      roleId: resolvedRole.id,
      role: resolvedRoleKey,
      permissions: getPermissionsForRole(resolvedRoleKey)
    };
  }

  async createOnboardingChecklist(input: {
    name: string;
    items: Array<{
      key: string;
      label: string;
      required: boolean;
      order: number;
    }>;
  }) {
    return this.app.prisma.onboardingChecklist.create({
      data: {
        name: input.name,
        items: {
          create: input.items.map((item) => ({
            stepKey: item.key,
            label: item.label,
            required: item.required,
            order: item.order
          }))
        }
      },
      include: { items: true }
    });
  }

  async startOnboardingRun(input: { checklistId: string; userId: string }) {
    const checklist = await this.app.prisma.onboardingChecklist.findUnique({
      where: { id: input.checklistId },
      include: { items: true }
    });

    if (!checklist) {
      throw new Error("Checklist no encontrado");
    }

    return this.app.prisma.onboardingRun.create({
      data: {
        checklistId: input.checklistId,
        userId: input.userId,
        steps: {
          create: checklist.items.map((item) => ({
            stepKey: item.stepKey
          }))
        }
      },
      include: { steps: true }
    });
  }

  async completeOnboardingStep(input: { runId: string; stepKey: string }) {
    const step = await this.app.prisma.onboardingRunStep.update({
      where: {
        runId_stepKey: {
          runId: input.runId,
          stepKey: input.stepKey
        }
      },
      data: {
        completed: true,
        completedAt: new Date()
      }
    });

    const pending = await this.app.prisma.onboardingRunStep.count({
      where: {
        runId: input.runId,
        completed: false
      }
    });

    if (pending === 0) {
      await this.app.prisma.onboardingRun.update({
        where: { id: input.runId },
        data: { completedAt: new Date() }
      });
    }

    return step;
  }

  async offboard(input: {
    userId: string;
    transferToUserId: string;
    reason: string;
    reasonCatalogId?: string;
    archiveHistory: boolean;
  }) {
    if (input.userId === input.transferToUserId) {
      throw new Error("No se puede transferir al mismo usuario");
    }

    await this.app.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: {
          assigneeId: input.userId,
          status: {
            notIn: ["COMPLETADA"]
          }
        },
        data: {
          assigneeId: input.transferToUserId
        }
      });

      await tx.user.update({
        where: { id: input.userId },
        data: {
          isActive: false,
          deactivatedAt: new Date()
        }
      });

      await tx.offboardingRecord.create({
        data: {
          userId: input.userId,
          transferToUserId: input.transferToUserId,
          reason: input.reason,
          reasonCatalogId: this.normalizeLegacyCode({
            code: input.reasonCatalogId,
            text: input.reason
          }),
          archivedAt: input.archiveHistory ? new Date() : null
        }
      });
    });

    return { success: true };
  }

  async createGuestInvite(input: {
    email: string;
    resourceScopeType: "PROYECTO" | "ARCHIVO" | "DOCUMENTO";
    resourceScopeId: string;
    expiresAt: string;
    createdById: string;
  }) {
    const token = crypto.randomUUID();
    const tokenHash = await this.app.jwt.sign({ token }, { expiresIn: "15m" });

    return this.app.prisma.guestInvite.create({
      data: {
        email: input.email,
        projectId: input.resourceScopeType === "PROYECTO" ? input.resourceScopeId : null,
        fileId: input.resourceScopeType === "ARCHIVO" ? input.resourceScopeId : null,
        documentId: input.resourceScopeType === "DOCUMENTO" ? input.resourceScopeId : null,
        expiresAt: new Date(input.expiresAt),
        tokenHash,
        createdById: input.createdById
      }
    });
  }

  async getDirectory() {
    const users = await this.app.prisma.user.findMany({
      where: { isActive: true },
      include: {
        baseRole: {
          select: {
            key: true,
            code: true
          }
        },
        personProfile: true,
        teamMemberships: {
          include: {
            team: true
          }
        },
        workSchedule: true
      }
    });

    const presenceResult = await this.getPresenceForUsers(users.map((user) => user.id));
    const presenceByUserId = new Map(
      presenceResult.items.map((item) => [item.userId, item.status])
    );

    return users.map((user) => {
      const team = user.teamMemberships[0]?.team?.name ?? null;
      return {
        userId: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        activeRole: resolveRoleKey(user.baseRole) ?? "INVITADO_EXTERNO",
        presence: presenceByUserId.get(user.id) ?? "DESCONECTADO",
        teamName: team,
        schedule: user.workSchedule
          ? {
              timezone: user.workSchedule.timezone,
              weekDays: user.workSchedule.weekDays,
              startHour: user.workSchedule.startHour,
              endHour: user.workSchedule.endHour
            }
          : null,
        skills: user.personProfile?.skills ?? [],
        contact: {
          email: user.personProfile?.internalContactEmail ?? user.email,
          phone: user.personProfile?.internalPhone ?? undefined,
          extension: undefined
        }
      };
    });
  }

  async listTeamsForUser(userId: string) {
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        baseRole: {
          select: {
            key: true,
            code: true
          }
        }
      }
    });

    if (resolveRoleKey(user?.baseRole) === "ADMINISTRADOR") {
      const teams = await this.app.prisma.team.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: "asc"
        }
      });

      return {
        items: teams,
        total: teams.length
      };
    }

    const memberships = await this.app.prisma.teamMember.findMany({
      where: { userId },
      select: {
        team: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        team: {
          name: "asc"
        }
      }
    });

    const deduped = new Map<string, { id: string; name: string }>();
    for (const membership of memberships) {
      deduped.set(membership.team.id, membership.team);
    }

    const items = [...deduped.values()];

    return {
      items,
      total: items.length
    };
  }
}
