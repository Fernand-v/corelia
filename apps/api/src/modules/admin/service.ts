import type { FastifyInstance } from "fastify";
import type { Prisma, SystemRole } from "@prisma/client";
import { getPermissionsForRole } from "../../lib/rbac.js";
import { hashPassword } from "../../lib/password.js";
import { createOpaqueToken, hashOpaqueToken } from "../../lib/tokens.js";
import { StatusService } from "../status/service.js";

const ROLE_ORDER: SystemRole[] = [
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR",
  "INVITADO_EXTERNO"
];

const ACTIVE_TASK_STATUSES: Array<
  "BACKLOG" | "PENDIENTE" | "EN_PROGRESO" | "EN_REVISION" | "BLOQUEADA"
> = ["BACKLOG", "PENDIENTE", "EN_PROGRESO", "EN_REVISION", "BLOQUEADA"];

export class AdminService {
  constructor(private readonly app: FastifyInstance) {}

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
        await tx.teamMember.deleteMany({
          where: {
            userId
          }
        });

        if (input.teamId) {
          await tx.teamMember.create({
            data: {
              teamId: input.teamId,
              userId
            }
          });
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

    return {
      id: team.id,
      name: team.name,
      description: team.description,
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
        const currentMembers =
          input.memberIds ??
          (
            await tx.teamMember.findMany({
              where: {
                teamId
              },
              select: {
                userId: true
              }
            })
          ).map((member) => member.userId);

        const nextMembers = [...new Set(currentMembers)];

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
      }
    });

    return this.listTeams(actorId);
  }

  async dissolveTeam(actorId: string, teamId: string) {
    await this.assertAdmin(actorId);

    const now = new Date();
    const [teamMembers, activeMeetings, activeObjectives, linkedFolders, linkedChannels] = await Promise.all([
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
    const status = await statusService.getSystemStatus();

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
        take: input.pageSize
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
        name: process.env.CORELIA_ORG_NAME ?? "Corelia",
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
          userId: event.userId
        }))
      },
      pagination: {
        page: input.page,
        pageSize: input.pageSize
      }
    };
  }
}
