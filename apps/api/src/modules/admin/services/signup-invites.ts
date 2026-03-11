import type { RoleCode } from "@corelia/types";
import { createOpaqueToken, hashOpaqueToken } from "../../../lib/tokens.js";
import { AdminCommonService } from "./common.js";

export class AdminSignupInvitesService extends AdminCommonService {
  async listSignupRequests(
    actorId: string,
    input: {
      status?: "PENDIENTE" | "APROBADA" | "RECHAZADA";
    }
  ) {
    await this.assertAdmin(actorId);

    const items = await this.app.prisma.signupRequest.findMany({
      ...(input.status ? { where: { status: input.status } } : {}),
      include: {
        reviewedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        requestedAt: "desc"
      }
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        email: item.email,
        firstName: item.firstName,
        lastName: item.lastName,
        message: item.message,
        status: item.status,
        requestedAt: item.requestedAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        reviewedById: item.reviewedById,
        reviewedByName: item.reviewedBy
          ? `${item.reviewedBy.firstName} ${item.reviewedBy.lastName}`.trim()
          : null,
        decisionNote: item.decisionNote,
        inviteId: item.inviteId
      })),
      total: items.length
    };
  }

  async approveSignupRequest(
    actorId: string,
    signupRequestId: string,
    input: {
      baseRole: RoleCode;
      teamId?: string;
      expiresAt?: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const request = await this.app.prisma.signupRequest.findUnique({
      where: {
        id: signupRequestId
      }
    });

    if (!request) {
      throw new Error("Solicitud no encontrada");
    }

    if (request.status !== "PENDIENTE") {
      throw new Error("La solicitud ya fue procesada");
    }

    const fallbackExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await this.createInternalInvite(actorId, {
      email: request.email,
      baseRole: input.baseRole,
      ...(input.teamId ? { teamId: input.teamId } : {}),
      expiresAt: (input.expiresAt ? new Date(input.expiresAt) : fallbackExpiry).toISOString()
    });

    const updated = await this.app.prisma.signupRequest.update({
      where: {
        id: signupRequestId
      },
      data: {
        status: "APROBADA",
        reviewedAt: new Date(),
        reviewedById: actorId,
        inviteId: invite.id,
        decisionNote: null
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        inviteId: true
      }
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      inviteId: updated.inviteId,
      inviteLinkPreview: invite.linkPreview
    };
  }

  async rejectSignupRequest(actorId: string, signupRequestId: string, reason: string) {
    await this.assertAdmin(actorId);

    const request = await this.app.prisma.signupRequest.findUnique({
      where: {
        id: signupRequestId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!request) {
      throw new Error("Solicitud no encontrada");
    }

    if (request.status !== "PENDIENTE") {
      throw new Error("La solicitud ya fue procesada");
    }

    const updated = await this.app.prisma.signupRequest.update({
      where: {
        id: signupRequestId
      },
      data: {
        status: "RECHAZADA",
        reviewedAt: new Date(),
        reviewedById: actorId,
        decisionNote: reason.trim()
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        decisionNote: true
      }
    });

    return {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      reason: updated.decisionNote
    };
  }

  async listInternalInvites(actorId: string) {
    await this.assertAdmin(actorId);

    const invites = await this.app.prisma.internalInvite.findMany({
      where: {
        acceptedAt: null
      },
      include: {
        baseRole: {
          select: {
            id: true,
            key: true
          }
        },
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
        baseRoleId: invite.baseRole.id,
        baseRole: invite.baseRole.key as RoleCode,
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
      baseRole: RoleCode;
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
        baseRole: {
          connect: {
            key: input.baseRole
          }
        },
        ...(input.teamId
          ? {
              team: {
                connect: {
                  id: input.teamId
                }
              }
            }
          : {}),
        expiresAt,
        tokenHash,
        createdBy: {
          connect: {
            id: actorId
          }
        }
      }
    });

    return {
      id: invite.id,
      email: invite.email,
      baseRoleId: invite.baseRoleId,
      baseRole: input.baseRole,
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
      items: invites.map((invite) => {
        const resourceScopeType = invite.projectId
          ? "PROYECTO"
          : invite.fileId
            ? "ARCHIVO"
            : "DOCUMENTO";
        const resourceScopeId = invite.projectId ?? invite.fileId ?? invite.documentId;

        return {
          id: invite.id,
          email: invite.email,
          resourceScopeType,
          resourceScopeId,
          expiresAt: invite.expiresAt.toISOString(),
          revokedAt: invite.revokedAt?.toISOString() ?? null,
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          createdAt: invite.createdAt.toISOString(),
          createdByName: `${invite.createdBy.firstName} ${invite.createdBy.lastName}`.trim()
        };
      }),
      total: invites.length
    };
  }

  async createGuestInvite(
    actorId: string,
    input: {
      email: string;
      resourceScopeType: "PROYECTO" | "ARCHIVO" | "DOCUMENTO";
      resourceScopeId: string;
      expiresAt: string;
    }
  ) {
    await this.assertAdmin(actorId);

    const token = crypto.randomUUID();
    const tokenHash = await this.app.jwt.sign({ token }, { expiresIn: "15m" });

    const invite = await this.app.prisma.guestInvite.create({
      data: {
        email: input.email,
        ...(input.resourceScopeType === "PROYECTO"
          ? { projectId: input.resourceScopeId }
          : input.resourceScopeType === "ARCHIVO"
            ? { fileId: input.resourceScopeId }
            : { documentId: input.resourceScopeId }),
        expiresAt: new Date(input.expiresAt),
        tokenHash,
        createdById: actorId
      }
    });

    return {
      id: invite.id,
      email: invite.email,
      resourceScopeType: input.resourceScopeType,
      resourceScopeId: input.resourceScopeId,
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
}
