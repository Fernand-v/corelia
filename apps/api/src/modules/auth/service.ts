import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { createOpaqueToken, hashOpaqueToken } from "../../lib/tokens.js";
import { env } from "../../config/env.js";

import { resolveRoleKey } from "../../lib/rbac.js";

export const TOKEN_REVOCATION_PREFIX = "auth:logout:";

export function buildRevocationKey(userId: string): string {
  return `${TOKEN_REVOCATION_PREFIX}${userId}`;
}

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
      select: {
        baseRole: {
          select: {
            key: true
          }
        }
      }
    });

    const actorRoleCode =
      (actor?.baseRole as { code?: string; key?: string } | undefined)?.code ??
      (actor?.baseRole as { code?: string; key?: string } | undefined)?.key;

    if (!actor || actorRoleCode !== "ADMINISTRADOR") {
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
        baseRole: {
          connect: {
            key: input.baseRole
          }
        },
        passwordHash
      }
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      baseRoleId: user.baseRoleId,
      baseRole: input.baseRole
    };
  }

  async createSignupRequest(input: {
    email: string;
    firstName: string;
    lastName: string;
    message?: string;
  }) {
    const email = this.normalizeEmail(input.email);
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const message = input.message?.trim();

    const [existingUser, existingRequest] = await Promise.all([
      this.app.prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: "insensitive"
          }
        },
        select: {
          id: true
        }
      }),
      this.app.prisma.signupRequest.findFirst({
        where: {
          email: {
            equals: email,
            mode: "insensitive"
          },
          status: "PENDIENTE"
        },
        select: {
          id: true
        }
      })
    ]);

    if (existingUser || existingRequest) {
      throw new Error("No se pudo procesar la solicitud. Verifica los datos e intenta de nuevo.");
    }

    const created = await this.app.prisma.signupRequest.create({
      data: {
        email,
        firstName,
        lastName,
        message: message ?? null
      },
      select: {
        id: true,
        status: true,
        requestedAt: true
      }
    });

    return {
      id: created.id,
      status: created.status,
      submittedAt: created.requestedAt.toISOString()
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
      throw new Error("Credenciales inválidas");
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

    const user = await this.app.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const accessToken = await this.app.jwt.sign({
      id: user.id,
      email: user.email
    });

    const newRefreshToken = createOpaqueToken();
    const newRefreshTokenHash = hashOpaqueToken(newRefreshToken);

    await this.app.prisma.$transaction([
      this.app.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() }
      }),
      this.app.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefreshTokenHash,
          expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
          rotatedFromId: existing.id
        }
      })
    ]);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresInSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
      userId: user.id
    };
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
      throw new Error("Invitación inválida o expirada");
    }

    const passwordHash = await hashPassword(input.password);

    const created = await this.app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          firstName: input.firstName,
          lastName: input.lastName,
          baseRoleId: invite.baseRoleId,
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

    // Invalidar inmediatamente cualquier access token en vuelo
    const ttl = env.ACCESS_TOKEN_TTL_MINUTES * 60;
    await this.app.redis.set(
      buildRevocationKey(token.userId),
      String(Date.now()),
      "EX",
      ttl
    );

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
          role: {
            select: {
              id: true,
              key: true,
              code: true
            }
          },
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
        roleId: string | null;
        role: string | null;
        joinedAt: Date | null;
      }
    >();

    for (const project of ownedProjects) {
      projectsById.set(project.id, {
        id: project.id,
        name: project.name,
        template: project.template,
        isOwner: true,
        roleId: null,
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
          roleId: membership.role.id,
          role: resolveRoleKey(membership.role) ?? null,
          joinedAt: membership.joinedAt
        });
        continue;
      }

      projectsById.set(membership.project.id, {
        ...current,
        isOwner: current.isOwner || isOwner,
        roleId: current.roleId ?? membership.role.id,
        role: current.role ?? resolveRoleKey(membership.role) ?? null,
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
        roleId: project.roleId,
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
