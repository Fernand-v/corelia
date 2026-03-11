import type { Prisma } from "@prisma/client";
import { AdminCommonService } from "./common.js";

export class AdminTeamsService extends AdminCommonService {
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
                baseRole: {
                  select: {
                    key: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    const descriptionCatalogIds = [
      ...new Set(
        teams
          .map((team) => team.descriptionCatalogId)
          .filter((code): code is string => Boolean(code))
      )
    ];
    const descriptionCatalog =
      descriptionCatalogIds.length > 0
        ? await this.app.prisma.teamCodeCatalog.findMany({
            where: {
              id: {
                in: descriptionCatalogIds
              }
            },
            select: {
              id: true,
              label: true
            }
          })
        : [];
    const labels = new Map(descriptionCatalog.map((entry) => [entry.id, entry.label]));

    const items = await Promise.all(
      teams.map(async (team) => {
        const coordinator =
          team.members.find((member) => member.user.baseRole.key === "COORDINADOR_EQUIPO") ?? null;
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
          descriptionCatalogId: team.descriptionCatalogId,
          descriptionLabel: team.descriptionCatalogId ? labels.get(team.descriptionCatalogId) ?? null : null,
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
                baseRole: {
                  select: {
                    key: true
                  }
                }
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

    const coordinator = team.members.find((member) => member.user.baseRole.key === "COORDINADOR_EQUIPO");

    const descriptionLabel = team.descriptionCatalogId
      ? (
          await this.app.prisma.teamCodeCatalog.findFirst({
            where: {
              id: team.descriptionCatalogId
            },
            select: { label: true }
          })
        )?.label ?? null
      : null;

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      descriptionCatalogId: team.descriptionCatalogId,
      descriptionLabel,
      coordinatorUserId: coordinator?.userId ?? null,
      activeProjects: new Set(projectMemberships.map((membership) => membership.projectId)).size,
      members: team.members.map((member) => ({
        userId: member.userId,
        fullName: `${member.user.firstName} ${member.user.lastName}`.trim(),
        email: member.user.email,
        baseRole: member.user.baseRole.key
      }))
    };
  }

  async createTeam(
    actorId: string,
    input: {
      name: string;
      description?: string;
      descriptionCatalogId?: string;
      coordinatorUserId?: string;
      memberIds: string[];
    }
  ) {
    await this.assertAdmin(actorId);

    const memberIds = [...new Set([...(input.memberIds ?? []), ...(input.coordinatorUserId ? [input.coordinatorUserId] : [])])];
    const descriptionCatalog = input.descriptionCatalogId
      ? await this.app.prisma.teamCodeCatalog.findFirst({
          where: {
            field: "TEAM_DESCRIPTION",
            key: input.descriptionCatalogId
          },
          select: {
            id: true
          }
        })
      : null;

    if (input.descriptionCatalogId && !descriptionCatalog) {
      throw new Error("Código de catálogo de descripción de equipo inválido");
    }

    const team = await this.app.prisma.team.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        ...(descriptionCatalog
          ? {
              descriptionCatalog: {
                connect: {
                  id: descriptionCatalog.id
                }
              }
            }
          : {}),
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
      descriptionCatalogId?: string | null;
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

      if (input.descriptionCatalogId !== undefined) {
        if (input.descriptionCatalogId === null) {
          updateData.descriptionCatalog = {
            disconnect: true
          };
        } else {
          const catalog = await tx.teamCodeCatalog.findFirst({
            where: {
              field: "TEAM_DESCRIPTION",
              key: input.descriptionCatalogId
            },
            select: {
              id: true
            }
          });

          if (!catalog) {
            throw new Error("Código de catálogo de descripción de equipo inválido");
          }

          updateData.descriptionCatalog = {
            connect: {
              id: catalog.id
            }
          };
        }
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
}
