import type { FastifyInstance } from "fastify";
import { getMostRestrictiveRole, getPermissionsForRole } from "../../lib/rbac.js";

export class IdentityService {
  constructor(private readonly app: FastifyInstance) {}

  async resolveActiveRole(userId: string, projectId?: string) {
    if (projectId) {
      const membership = await this.app.prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { role: true }
      });

      const role = membership?.role ?? "INVITADO_EXTERNO";
      return {
        userId,
        projectId,
        role,
        permissions: getPermissionsForRole(role)
      };
    }

    const memberships = await this.app.prisma.projectMember.findMany({
      where: { userId },
      select: { role: true }
    });
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      select: { baseRole: true }
    });

    const roles = memberships.map((m) => m.role);
    if (user?.baseRole) {
      roles.push(user.baseRole);
    }

    const role = getMostRestrictiveRole(roles.length ? roles : ["INVITADO_EXTERNO"]);

    return {
      userId,
      projectId: null,
      role,
      permissions: getPermissionsForRole(role)
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

  async offboard(input: { userId: string; transferToUserId: string; reason: string; archiveHistory: boolean }) {
    if (input.userId === input.transferToUserId) {
      throw new Error("No se puede transferir al mismo usuario");
    }

    await this.app.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: {
          assigneeId: input.userId,
          status: {
            notIn: ["COMPLETADA", "CANCELADA"]
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
          archivedAt: input.archiveHistory ? new Date() : null
        }
      });
    });

    return { success: true };
  }

  async createGuestInvite(input: {
    email: string;
    resourceType: "PROYECTO" | "ARCHIVO" | "DOCUMENTO";
    resourceId: string;
    expiresAt: string;
    createdById: string;
  }) {
    const token = crypto.randomUUID();
    const tokenHash = await this.app.jwt.sign({ token }, { expiresIn: "15m" });

    return this.app.prisma.guestInvite.create({
      data: {
        email: input.email,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
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
        personProfile: true,
        teamMemberships: {
          include: {
            team: true
          }
        },
        workSchedule: true
      }
    });

    return users.map((user) => {
      const team = user.teamMemberships[0]?.team?.name ?? null;
      return {
        userId: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        activeRole: user.baseRole,
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
}
