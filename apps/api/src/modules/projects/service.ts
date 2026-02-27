import type { FastifyInstance } from "fastify";
import type { SystemRole } from "@corelia/types";

const projectManagerRoles = new Set<SystemRole>([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO"
]);

export class ProjectService {
  constructor(private readonly app: FastifyInstance) {}

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private async ensureProjectScope(actorId: string, projectId: string, requireManage: boolean) {
    const [actor, project, membership] = await Promise.all([
      this.app.prisma.user.findUnique({
        where: { id: actorId },
        select: { baseRole: true }
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
          role: true
        }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (actor?.baseRole === "ADMINISTRADOR") {
      return project;
    }

    const isOwner = project.ownerId === actorId;
    const isMember = Boolean(membership);

    if (!isOwner && !isMember) {
      throw this.forbidden("No tienes acceso a este proyecto");
    }

    if (requireManage) {
      const canManage = isOwner || (membership ? projectManagerRoles.has(membership.role as SystemRole) : false);
      if (!canManage) {
        throw this.forbidden("No tienes permisos para gestionar miembros del proyecto");
      }
    }

    return project;
  }

  async createProject(input: {
    name: string;
    description?: string;
    template: "SOFTWARE" | "CONTENIDO" | "OPERACIONES";
    ownerId: string;
    memberIds: string[];
  }) {
    return this.app.prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        template: input.template,
        ownerId: input.ownerId,
        members: {
          create: [
            {
              userId: input.ownerId,
              role: "LIDER_PROYECTO"
            },
            ...input.memberIds
              .filter((id) => id !== input.ownerId)
              .map((memberId) => ({
                userId: memberId,
                role: "COLABORADOR" as const
              }))
          ]
        }
      },
      include: {
        members: true
      }
    });
  }

  async listProjects(userId: string) {
    const actor = await this.app.prisma.user.findUnique({
      where: { id: userId },
      select: { baseRole: true }
    });

    if (actor?.baseRole === "ADMINISTRADOR") {
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
        role: member.role,
        joinedAt: member.joinedAt.toISOString()
      }))
    };
  }

  async assignRole(input: {
    projectId: string;
    userId: string;
    role:
      | "ADMINISTRADOR"
      | "LIDER_PROYECTO"
      | "COORDINADOR_EQUIPO"
      | "COLABORADOR"
      | "OBSERVADOR"
      | "INVITADO_EXTERNO";
  }) {
    return this.app.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId
        }
      },
      update: {
        role: input.role
      },
      create: {
        projectId: input.projectId,
        userId: input.userId,
        role: input.role
      }
    });
  }

  async addProjectMember(
    actorId: string,
    input: {
      projectId: string;
      userId: string;
      role:
        | "ADMINISTRADOR"
        | "LIDER_PROYECTO"
        | "COORDINADOR_EQUIPO"
        | "COLABORADOR"
        | "OBSERVADOR"
        | "INVITADO_EXTERNO";
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

    return {
      success: true
    };
  }
}
