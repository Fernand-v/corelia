import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { createOpaqueToken, hashOpaqueToken } from "../../lib/tokens.js";
import { env } from "../../config/env.js";

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async assertAdmin(actorId: string): Promise<void> {
    const actor = await this.app.prisma.user.findUnique({
      where: { id: actorId },
      select: { baseRole: true }
    });

    if (!actor || actor.baseRole !== "ADMINISTRADOR") {
      throw this.forbidden("Solo administradores pueden restablecer contraseñas");
    }
  }

  private async createSessionTokens(user: { id: string; email: string }, rotatedFromId?: string) {
    const accessToken = await this.app.jwt.sign({
      id: user.id,
      email: user.email
    });

    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashOpaqueToken(refreshToken);

    await this.app.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        ...(rotatedFromId ? { rotatedFromId } : {})
      }
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresInSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
      userId: user.id
    };
  }

  async register(input: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    baseRole: "ADMINISTRADOR" | "LIDER_PROYECTO" | "COORDINADOR_EQUIPO" | "COLABORADOR" | "OBSERVADOR" | "INVITADO_EXTERNO";
  }) {
    const email = this.normalizeEmail(input.email);
    const exists = await this.app.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive"
        }
      },
      select: {
        id: true
      }
    });
    if (exists) {
      throw new Error("El email ya existe");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.app.prisma.user.create({
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        baseRole: input.baseRole,
        passwordHash
      }
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      baseRole: user.baseRole
    };
  }

  async login(input: { email: string; password: string }) {
    const email = this.normalizeEmail(input.email);
    const user = await this.app.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive"
        }
      }
    });

    if (!user || !user.isActive) {
      throw new Error("Credenciales inválidas");
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      throw new Error("Credenciales inválidas");
    }

    return this.createSessionTokens({
      id: user.id,
      email: user.email
    });
  }

  async changePassword(
    userId: string,
    input: {
      currentPassword: string;
      newPassword: string;
    }
  ) {
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        passwordHash: true
      }
    });

    if (!user || !user.isActive) {
      throw new Error("Usuario no encontrado");
    }

    const validPassword = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new Error("La contraseña actual no es válida");
    }

    const passwordHash = await hashPassword(input.newPassword);

    await this.app.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    await this.app.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { userId };
  }

  async adminResetPassword(
    actorId: string,
    input: {
      userId: string;
      newPassword: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const target = await this.app.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true
      }
    });

    if (!target) {
      throw new Error("Usuario objetivo no encontrado");
    }

    const passwordHash = await hashPassword(input.newPassword);

    await this.app.prisma.user.update({
      where: { id: input.userId },
      data: { passwordHash }
    });

    await this.app.prisma.refreshToken.updateMany({
      where: {
        userId: input.userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { userId: input.userId };
  }

  async refresh(input: { refreshToken: string }) {
    const refreshTokenHash = hashOpaqueToken(input.refreshToken);

    const existing = await this.app.prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!existing) {
      throw new Error("Refresh token inválido");
    }

    await this.app.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });

    const user = await this.app.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    return this.createSessionTokens(
      {
        id: user.id,
        email: user.email
      },
      existing.id
    );
  }

  async activateInternalInvite(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    const tokenHash = hashOpaqueToken(input.token);

    const invite = await this.app.prisma.internalInvite.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!invite) {
      throw new Error("Invitación inválida o expirada");
    }

    const existing = await this.app.prisma.user.findUnique({
      where: {
        email: invite.email
      },
      select: {
        id: true
      }
    });

    if (existing) {
      throw new Error("Ya existe una cuenta registrada para esta invitación");
    }

    const passwordHash = await hashPassword(input.password);

    const created = await this.app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          firstName: input.firstName,
          lastName: input.lastName,
          baseRole: invite.baseRole,
          passwordHash
        }
      });

      if (invite.teamId) {
        await tx.teamMember.create({
          data: {
            teamId: invite.teamId,
            userId: user.id
          }
        });
      }

      await tx.internalInvite.update({
        where: {
          id: invite.id
        },
        data: {
          acceptedAt: new Date()
        }
      });

      return {
        id: user.id,
        email: user.email
      };
    });

    return this.createSessionTokens({
      id: created.id,
      email: created.email
    });
  }

  async logout(input: { refreshToken: string }) {
    const refreshTokenHash = hashOpaqueToken(input.refreshToken);

    const token = await this.app.prisma.refreshToken.findFirst({
      where: { tokenHash: refreshTokenHash, revokedAt: null }
    });

    if (!token) {
      return null;
    }

    await this.app.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() }
    });

    return token.userId;
  }

  async getMembershipSummary(userId: string) {
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const [ownedProjects, projectMemberships, teamMemberships] = await Promise.all([
      this.app.prisma.project.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          template: true
        }
      }),
      this.app.prisma.projectMember.findMany({
        where: { userId },
        select: {
          role: true,
          joinedAt: true,
          project: {
            select: {
              id: true,
              name: true,
              template: true,
              ownerId: true
            }
          }
        }
      }),
      this.app.prisma.teamMember.findMany({
        where: { userId },
        select: {
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const projectsById = new Map<
      string,
      {
        id: string;
        name: string;
        template: "SOFTWARE" | "CONTENIDO" | "OPERACIONES";
        isOwner: boolean;
        role:
          | "ADMINISTRADOR"
          | "LIDER_PROYECTO"
          | "COORDINADOR_EQUIPO"
          | "COLABORADOR"
          | "OBSERVADOR"
          | "INVITADO_EXTERNO"
          | null;
        joinedAt: Date | null;
      }
    >();

    for (const project of ownedProjects) {
      projectsById.set(project.id, {
        id: project.id,
        name: project.name,
        template: project.template,
        isOwner: true,
        role: "LIDER_PROYECTO",
        joinedAt: null
      });
    }

    for (const membership of projectMemberships) {
      const current = projectsById.get(membership.project.id);
      const isOwner = membership.project.ownerId === userId;

      if (!current) {
        projectsById.set(membership.project.id, {
          id: membership.project.id,
          name: membership.project.name,
          template: membership.project.template,
          isOwner,
          role: membership.role,
          joinedAt: membership.joinedAt
        });
        continue;
      }

      projectsById.set(membership.project.id, {
        ...current,
        isOwner: current.isOwner || isOwner,
        role: current.role ?? membership.role,
        joinedAt: current.joinedAt ?? membership.joinedAt
      });
    }

    const projects = [...projectsById.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
      .map((project) => ({
        id: project.id,
        name: project.name,
        template: project.template,
        isOwner: project.isOwner,
        role: project.role,
        joinedAt: project.joinedAt ? project.joinedAt.toISOString() : null
      }));

    const teams = teamMemberships
      .sort((a, b) => a.team.name.localeCompare(b.team.name, "es", { sensitivity: "base" }))
      .map((membership) => ({
        id: membership.team.id,
        name: membership.team.name,
        description: membership.team.description,
        joinedAt: membership.createdAt.toISOString()
      }));

    return {
      userId,
      projects,
      teams
    };
  }
}
