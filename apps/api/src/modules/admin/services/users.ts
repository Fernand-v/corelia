import type { Prisma } from "@prisma/client";
import type { RoleCode } from "@corelia/types";
import { hashPassword } from "../../../lib/password.js";
import { ACTIVE_TASK_STATUSES, AdminCommonService } from "./common.js";

export class AdminUsersService extends AdminCommonService {
  async listUsers(
    actorId: string,
    input: {
      search?: string;
      role?: RoleCode;
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
      where.baseRole = {
        is: {
          key: input.role
        }
      };
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
          baseRole: {
            select: {
              id: true,
              key: true
            }
          },
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
        roleId: user.baseRole.id,
        role: user.baseRole.key as RoleCode,
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
      baseRole: RoleCode;
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
          baseRole: {
            connect: {
              key: input.baseRole
            }
          },
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
        baseRoleId: user.baseRoleId,
        baseRole: input.baseRole,
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
      baseRole?: RoleCode;
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
        updateData.baseRole = {
          connect: {
            key: input.baseRole
          }
        };
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
          baseRole: {
            select: {
              id: true,
              key: true
            }
          },
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
      roleId: result?.baseRole.id ?? null,
      role: (result?.baseRole.key as RoleCode | undefined) ?? null,
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
            is: {
              key: {
                in: ["LIDER_PROYECTO", "COORDINADOR_EQUIPO"]
              }
            }
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          },
          role: {
            select: {
              key: true
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
        role: membership.role.key as RoleCode
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
        role: RoleCode;
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

    const leadershipTransferMap = new Map<string, { toUserId: string; role: RoleCode }>();
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
            is: {
              key: {
                in: ["LIDER_PROYECTO", "COORDINADOR_EQUIPO"]
              }
            }
          }
        },
        select: {
          projectId: true,
          role: {
            select: {
              key: true
            }
          }
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
              role: {
                connect: {
                  key: transfer.role
                }
              }
            },
            create: {
              project: {
                connect: {
                  id: transfer.projectId
                }
              },
              user: {
                connect: {
                  id: transfer.toUserId
                }
              },
              role: {
                connect: {
                  key: transfer.role
                }
              }
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
}
