import type { FastifyInstance } from "fastify";
import type { RoleCode } from "@corelia/types";
import { resolveRoleKey } from "../../lib/rbac.js";
import { invalidateMembershipCache } from "../../plugins/rbac.js";
import { ProjectTeamSyncService } from "./team-sync-service.js";

const projectManagerRoles = new Set<RoleCode>([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO"
]);

export class ProjectService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";
  private readonly teamSync: ProjectTeamSyncService;

  constructor(private readonly app: FastifyInstance) {
    this.teamSync = new ProjectTeamSyncService(app);
  }

  private syncProjectSearch(projectId: string) {
    void this.app.searchIndex?.syncProject(projectId);
  }

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private normalizeLegacyCode(input: {
    code?: string | null | undefined;
    text?: string | null | undefined;
  }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return ProjectService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  private toStageNumber(code: number): number {
    const parsed = Number(code);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private mapStageForClient(stage: {
    id: string;
    projectId: string;
    code: number;
    name: string;
    color: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...stage,
      code: this.toStageNumber(stage.code)
    };
  }

  private async assertStageManagementRole(actorId: string, projectId: string) {
    const [user, membership] = await Promise.all([
      this.app.prisma.user.findUnique({
        where: { id: actorId },
        select: {
          baseRole: {
            select: {
              key: true,
              code: true
            }
          }
        }
      }),
      this.app.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: actorId
        },
        select: {
          role: {
            select: {
              key: true,
              code: true
            }
          }
        }
      })
    ]);

    if (resolveRoleKey(user?.baseRole) === "ADMINISTRADOR") {
      return;
    }

    if (resolveRoleKey(membership?.role) === "LIDER_PROYECTO") {
      return;
    }

    throw this.forbidden("Solo administrador o líder de proyecto pueden gestionar etapas");
  }

  private async syncProjectChannelsForMember(input: {
    projectId: string;
    userId: string;
    action: "ADD" | "REMOVE";
  }) {
    const projectChannels = await this.app.prisma.channel.findMany({
      where: {
        scope: "PROYECTO",
        projectId: input.projectId
      },
      select: {
        id: true
      }
    });

    if (projectChannels.length === 0) {
      return;
    }

    const channelIds = projectChannels.map((channel) => channel.id);

    if (input.action === "ADD") {
      await this.app.prisma.channelMember.createMany({
        data: channelIds.map((channelId) => ({
          channelId,
          userId: input.userId
        })),
        skipDuplicates: true
      });
      return;
    }

    await this.app.prisma.channelMember.deleteMany({
      where: {
        userId: input.userId,
        channelId: {
          in: channelIds
        }
      }
    });
  }

  private async ensureProjectScope(actorId: string, projectId: string, requireManage: boolean) {
    const [actor, project, membership] = await Promise.all([
      this.app.prisma.user.findUnique({
        where: { id: actorId },
        select: {
          baseRole: {
            select: {
              key: true,
              code: true
            }
          }
        }
      }),
      this.app.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          ownerId: true,
          name: true
        }
      }),
      this.app.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: actorId
        },
        select: {
          role: {
            select: {
              key: true,
              code: true
            }
          }
        }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (resolveRoleKey(actor?.baseRole) === "ADMINISTRADOR") {
      return project;
    }

    const isOwner = project.ownerId === actorId;
    const isMember = Boolean(membership);

    if (!isOwner && !isMember) {
      throw this.forbidden("No tienes acceso a este proyecto");
    }

    if (requireManage) {
      const membershipRole = resolveRoleKey(membership?.role) as RoleCode | undefined;
      const canManage = isOwner || (membershipRole ? projectManagerRoles.has(membershipRole) : false);
      if (!canManage) {
        throw this.forbidden("No tienes permisos para gestionar miembros del proyecto");
      }
    }

    return project;
  }

  async createProject(input: {
    name: string;
    description?: string;
    descriptionCatalogId?: string;
    template: "SOFTWARE" | "CONTENIDO" | "OPERACIONES";
    ownerId: string;
    memberIds: string[];
    startDate?: string;
    estimatedEndDate?: string;
  }) {
    const project = await this.app.prisma.$transaction(async (tx) => {
      const [leaderRole, collaboratorRole] = await Promise.all([
        tx.role.findUnique({
          where: { key: "LIDER_PROYECTO" },
          select: { id: true }
        }),
        tx.role.findUnique({
          where: { key: "COLABORADOR" },
          select: { id: true }
        })
      ]);
      if (!leaderRole || !collaboratorRole) {
        throw new Error("Roles base no configurados");
      }

      const project = await tx.project.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          descriptionCatalogId: input.descriptionCatalogId ?? null,
          template: input.template,
          ownerId: input.ownerId,
          startDate: input.startDate ? new Date(input.startDate) : null,
          estimatedEndDate: input.estimatedEndDate ? new Date(input.estimatedEndDate) : null
        }
      });

      await tx.projectMember.createMany({
        data: [
          {
            projectId: project.id,
            userId: input.ownerId,
            roleId: leaderRole.id,
            membershipSource: "MANUAL",
            syncTeamsCount: 0
          },
          ...input.memberIds
            .filter((id) => id !== input.ownerId)
            .map((memberId) => ({
              projectId: project.id,
              userId: memberId,
              roleId: collaboratorRole.id,
              membershipSource: "MANUAL" as const,
              syncTeamsCount: 0
            }))
        ],
        skipDuplicates: true
      });

      const channelMemberIds = [...new Set([input.ownerId, ...input.memberIds])];
      await tx.channel.create({
        data: {
          name: `${project.name} · General`.slice(0, 120),
          scope: "PROYECTO",
          projectId: project.id,
          members: {
            create: channelMemberIds.map((userId) => ({ userId }))
          }
        }
      });

      return project;
    });

    this.syncProjectSearch(project.id);
    return project;
  }

  async updateProjectPlanning(
    actorId: string,
    projectId: string,
    input: { startDate?: string | null; estimatedEndDate?: string | null }
  ) {
    await this.ensureProjectScope(actorId, projectId, true);

    const project = await this.app.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ? new Date(input.startDate) : null }
          : {}),
        ...(input.estimatedEndDate !== undefined
          ? { estimatedEndDate: input.estimatedEndDate ? new Date(input.estimatedEndDate) : null }
          : {})
      }
    });

    this.syncProjectSearch(project.id);
    return project;
  }

  async listProjects(userId: string) {
    const actor = await this.app.prisma.user.findUnique({
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

    if (resolveRoleKey(actor?.baseRole) === "ADMINISTRADOR") {
      return this.app.prisma.project.findMany({
        include: {
          members: true
        }
      });
    }

    return this.app.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }]
      },
      include: {
        members: true
      }
    });
  }

  async getProjectMembers(projectId: string, actorId: string) {
    const project = await this.ensureProjectScope(actorId, projectId, false);

    const members = await this.app.prisma.projectMember.findMany({
      where: {
        projectId
      },
      include: {
        role: {
          select: {
            id: true,
            key: true,
            code: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    return {
      projectId: project.id,
      projectName: project.name,
      members: members.map((member) => ({
        userId: member.userId,
        fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
        email: member.user.email,
        roleId: member.role.id,
        role: resolveRoleKey(member.role) ?? null,
        joinedAt: member.joinedAt.toISOString()
      }))
    };
  }

  async assignRole(input: {
    projectId: string;
    userId: string;
    roleId: string;
  }) {
    const member = await this.app.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId
        }
      },
      update: {
        role: {
          connect: {
            id: input.roleId
          }
        },
        membershipSource: "MANUAL",
        syncTeamsCount: 0
      },
      create: {
        project: {
          connect: {
            id: input.projectId
          }
        },
        user: {
          connect: {
            id: input.userId
          }
        },
        role: {
          connect: {
            id: input.roleId
          }
        },
        membershipSource: "MANUAL",
        syncTeamsCount: 0
      },
      include: {
        role: {
          select: {
            id: true,
            key: true,
            code: true
          }
        }
      }
    });

    await invalidateMembershipCache(this.app, input.userId, input.projectId);

    await this.syncProjectChannelsForMember({
      projectId: input.projectId,
      userId: input.userId,
      action: "ADD"
    });

    return {
      ...member,
      roleId: member.role.id,
      role: resolveRoleKey(member.role) ?? null
    };
  }

  async addProjectMember(
    actorId: string,
    input: {
      projectId: string;
      userId: string;
      roleId: string;
    }
  ) {
    await this.ensureProjectScope(actorId, input.projectId, true);
    return this.assignRole(input);
  }

  async removeProjectMember(actorId: string, projectId: string, userId: string) {
    const project = await this.ensureProjectScope(actorId, projectId, true);

    if (project.ownerId === userId) {
      throw new Error("No se puede quitar al owner del proyecto");
    }

    await this.app.prisma.projectMember.deleteMany({
      where: {
        projectId,
        userId
      }
    });

    await invalidateMembershipCache(this.app, userId, projectId);

    await this.syncProjectChannelsForMember({
      projectId,
      userId,
      action: "REMOVE"
    });

    return {
      success: true
    };
  }

  async listStages(actorId: string, projectId: string) {
    await this.ensureProjectScope(actorId, projectId, false);
    const stages = await this.app.prisma.projectStage.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }]
    });

    return stages.map((stage) => this.mapStageForClient(stage));
  }

  async listLinkedTeams(actorId: string, projectId: string) {
    await this.ensureProjectScope(actorId, projectId, false);
    return this.teamSync.listProjectLinkedTeams(projectId);
  }

  async linkTeam(actorId: string, input: { projectId: string; teamId: string }) {
    await this.ensureProjectScope(actorId, input.projectId, true);
    return this.app.prisma.$transaction(async (tx) =>
      this.teamSync.linkTeamToProject(
        {
          projectId: input.projectId,
          teamId: input.teamId,
          createdById: actorId
        },
        tx
      )
    );
  }

  async unlinkTeam(actorId: string, input: { projectId: string; teamId: string }) {
    await this.ensureProjectScope(actorId, input.projectId, true);
    return this.app.prisma.$transaction(async (tx) =>
      this.teamSync.unlinkTeamFromProject(
        {
          projectId: input.projectId,
          teamId: input.teamId
        },
        tx
      )
    );
  }

  async createStage(
    actorId: string,
    input: {
      projectId: string;
      name: string;
      color?: string;
    }
  ) {
    await this.ensureProjectScope(actorId, input.projectId, true);
    await this.assertStageManagementRole(actorId, input.projectId);

    const existingStages = await this.app.prisma.projectStage.findMany({
      where: { projectId: input.projectId },
      select: {
        code: true,
        order: true
      }
    });

    const nextStageNumber = existingStages.reduce((max, stage) => {
      return Math.max(max, stage.code);
    }, 0) + 1;

    const nextOrder = existingStages.reduce((max, stage) => Math.max(max, stage.order), -1) + 1;

    const created = await this.app.prisma.projectStage.create({
      data: {
        projectId: input.projectId,
        code: nextStageNumber,
        name: input.name,
        color: input.color ?? "#4F7CFF",
        order: nextOrder
      }
    });

    return this.mapStageForClient(created);
  }

  async updateStage(
    actorId: string,
    stageId: string,
    input: {
      name?: string;
      color?: string;
    }
  ) {
    const stage = await this.app.prisma.projectStage.findUnique({
      where: { id: stageId }
    });
    if (!stage) {
      throw new Error("Etapa no encontrada");
    }

    await this.ensureProjectScope(actorId, stage.projectId, true);
    await this.assertStageManagementRole(actorId, stage.projectId);

    const updated = await this.app.prisma.projectStage.update({
      where: { id: stageId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {})
      }
    });

    return this.mapStageForClient(updated);
  }

  async deleteStage(actorId: string, stageId: string) {
    const stage = await this.app.prisma.projectStage.findUnique({
      where: { id: stageId }
    });
    if (!stage) {
      throw new Error("Etapa no encontrada");
    }

    await this.ensureProjectScope(actorId, stage.projectId, true);
    await this.assertStageManagementRole(actorId, stage.projectId);

    const attachedTasks = await this.app.prisma.task.count({
      where: {
        stageId
      }
    });

    if (attachedTasks > 0) {
      throw new Error("No se puede eliminar la etapa porque tiene tareas asociadas");
    }

    await this.app.prisma.projectStage.delete({
      where: { id: stageId }
    });

    return {
      success: true
    };
  }
}
