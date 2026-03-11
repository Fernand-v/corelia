import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";

type DbClient = FastifyInstance["prisma"] | Prisma.TransactionClient;

const SYNC_ROLE = "COLABORADOR" as const;

export class ProjectTeamSyncService {
  constructor(private readonly app: FastifyInstance) {}

  private db(tx?: Prisma.TransactionClient): DbClient {
    return tx ?? this.app.prisma;
  }

  private async addUserToProjectChannels(input: {
    db: DbClient;
    projectId: string;
    userId: string;
  }) {
    const channels = await input.db.channel.findMany({
      where: {
        scope: "PROYECTO",
        projectId: input.projectId
      },
      select: {
        id: true
      }
    });

    if (channels.length === 0) {
      return;
    }

    await input.db.channelMember.createMany({
      data: channels.map((channel) => ({
        channelId: channel.id,
        userId: input.userId
      })),
      skipDuplicates: true
    });
  }

  private async removeUserFromProjectChannels(input: {
    db: DbClient;
    projectId: string;
    userId: string;
  }) {
    const channels = await input.db.channel.findMany({
      where: {
        scope: "PROYECTO",
        projectId: input.projectId
      },
      select: {
        id: true
      }
    });

    if (channels.length === 0) {
      return;
    }

    await input.db.channelMember.deleteMany({
      where: {
        userId: input.userId,
        channelId: {
          in: channels.map((channel) => channel.id)
        }
      }
    });
  }

  private async upsertSyncedMember(input: {
    db: DbClient;
    projectId: string;
    projectOwnerId: string;
    userId: string;
  }): Promise<"created" | "updated" | "ignored"> {
    if (input.userId === input.projectOwnerId) {
      return "ignored";
    }

    const existing = await input.db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId
        }
      },
      select: {
        id: true,
        membershipSource: true,
        syncTeamsCount: true
      }
    });

    if (!existing) {
      await input.db.projectMember.create({
        data: {
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
              key: SYNC_ROLE
            }
          },
          membershipSource: "SYNC",
          syncTeamsCount: 1
        }
      });
      await this.addUserToProjectChannels({
        db: input.db,
        projectId: input.projectId,
        userId: input.userId
      });
      return "created";
    }

    if (existing.membershipSource === "MANUAL") {
      return "ignored";
    }

    await input.db.projectMember.update({
      where: { id: existing.id },
      data: {
        membershipSource: "SYNC",
        syncTeamsCount: {
          increment: 1
        }
      }
    });

    await this.addUserToProjectChannels({
      db: input.db,
      projectId: input.projectId,
      userId: input.userId
    });

    return "updated";
  }

  private async removeSyncedMember(input: {
    db: DbClient;
    projectId: string;
    projectOwnerId: string;
    userId: string;
  }): Promise<boolean> {
    if (input.userId === input.projectOwnerId) {
      return false;
    }

    const existing = await input.db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId
        }
      },
      select: {
        id: true,
        membershipSource: true,
        syncTeamsCount: true
      }
    });

    if (!existing || existing.membershipSource === "MANUAL") {
      return false;
    }

    const nextCount = Math.max(0, existing.syncTeamsCount - 1);

    if (nextCount <= 0) {
      await input.db.projectMember.delete({
        where: {
          id: existing.id
        }
      });
      await this.removeUserFromProjectChannels({
        db: input.db,
        projectId: input.projectId,
        userId: input.userId
      });
      return true;
    }

    await input.db.projectMember.update({
      where: {
        id: existing.id
      },
      data: {
        syncTeamsCount: nextCount
      }
    });

    return false;
  }

  async listProjectLinkedTeams(projectId: string, tx?: Prisma.TransactionClient) {
    const db = this.db(tx);

    const links = await db.projectTeamLink.findMany({
      where: {
        projectId
      },
      include: {
        team: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const teamIds = links.map((link) => link.teamId);

    const memberships =
      teamIds.length === 0
        ? []
        : await db.teamMember.findMany({
            where: {
              teamId: {
                in: teamIds
              }
            },
            select: {
              teamId: true,
              userId: true
            }
          });

    const userIdsByTeam = new Map<string, string[]>();
    for (const membership of memberships) {
      const current = userIdsByTeam.get(membership.teamId) ?? [];
      current.push(membership.userId);
      userIdsByTeam.set(membership.teamId, current);
    }

    const items = await Promise.all(
      links.map(async (link) => {
        const userIds = [...new Set(userIdsByTeam.get(link.teamId) ?? [])];
        const syncedMembers =
          userIds.length === 0
            ? 0
            : await db.projectMember.count({
                where: {
                  projectId,
                  userId: {
                    in: userIds
                  },
                  membershipSource: "SYNC"
                }
              });

        return {
          teamId: link.team.id,
          teamName: link.team.name,
          linkedAt: link.createdAt.toISOString(),
          totalTeamMembers: userIds.length,
          syncedMembers
        };
      })
    );

    return {
      projectId,
      items
    };
  }

  async linkTeamToProject(
    input: {
      projectId: string;
      teamId: string;
      createdById: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = this.db(tx);

    const [project, team, existingLink] = await Promise.all([
      db.project.findUnique({
        where: {
          id: input.projectId
        },
        select: {
          id: true,
          ownerId: true
        }
      }),
      db.team.findUnique({
        where: {
          id: input.teamId
        },
        select: {
          id: true,
          name: true
        }
      }),
      db.projectTeamLink.findUnique({
        where: {
          projectId_teamId: {
            projectId: input.projectId,
            teamId: input.teamId
          }
        },
        select: {
          id: true,
          createdAt: true
        }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (!team) {
      throw new Error("Equipo no encontrado");
    }

    const teamMembers = await db.teamMember.findMany({
      where: {
        teamId: input.teamId
      },
      select: {
        userId: true
      }
    });

    if (existingLink) {
      return {
        projectId: input.projectId,
        teamId: input.teamId,
        linkedAt: existingLink.createdAt.toISOString(),
        totalTeamMembers: teamMembers.length,
        syncedCreated: 0,
        syncedUpdated: 0,
        ignoredMembers: teamMembers.length
      };
    }

    const link = await db.projectTeamLink.create({
      data: {
        projectId: input.projectId,
        teamId: input.teamId,
        createdById: input.createdById
      },
      select: {
        createdAt: true
      }
    });

    let syncedCreated = 0;
    let syncedUpdated = 0;
    let ignoredMembers = 0;

    for (const member of teamMembers) {
      const result = await this.upsertSyncedMember({
        db,
        projectId: input.projectId,
        projectOwnerId: project.ownerId,
        userId: member.userId
      });

      if (result === "created") {
        syncedCreated += 1;
      } else if (result === "updated") {
        syncedUpdated += 1;
      } else {
        ignoredMembers += 1;
      }
    }

    return {
      projectId: input.projectId,
      teamId: input.teamId,
      linkedAt: link.createdAt.toISOString(),
      totalTeamMembers: teamMembers.length,
      syncedCreated,
      syncedUpdated,
      ignoredMembers
    };
  }

  async unlinkTeamFromProject(
    input: {
      projectId: string;
      teamId: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = this.db(tx);

    const [project, link, teamMembers] = await Promise.all([
      db.project.findUnique({
        where: {
          id: input.projectId
        },
        select: {
          id: true,
          ownerId: true
        }
      }),
      db.projectTeamLink.findUnique({
        where: {
          projectId_teamId: {
            projectId: input.projectId,
            teamId: input.teamId
          }
        },
        select: {
          id: true
        }
      }),
      db.teamMember.findMany({
        where: {
          teamId: input.teamId
        },
        select: {
          userId: true
        }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (!link) {
      return {
        success: true,
        projectId: input.projectId,
        teamId: input.teamId,
        removedMembers: 0
      };
    }

    await db.projectTeamLink.delete({
      where: {
        id: link.id
      }
    });

    let removedMembers = 0;

    for (const member of teamMembers) {
      const removed = await this.removeSyncedMember({
        db,
        projectId: input.projectId,
        projectOwnerId: project.ownerId,
        userId: member.userId
      });

      if (removed) {
        removedMembers += 1;
      }
    }

    return {
      success: true,
      projectId: input.projectId,
      teamId: input.teamId,
      removedMembers
    };
  }

  async markProjectMemberAsManual(
    input: {
      projectId: string;
      userId: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = this.db(tx);

    const member = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId
        }
      },
      select: {
        id: true
      }
    });

    if (!member) {
      return;
    }

    await db.projectMember.update({
      where: {
        id: member.id
      },
      data: {
        membershipSource: "MANUAL",
        syncTeamsCount: 0
      }
    });
  }

  async handleTeamMembershipAdded(
    input: {
      teamId: string;
      userId: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = this.db(tx);

    const links = await db.projectTeamLink.findMany({
      where: {
        teamId: input.teamId
      },
      select: {
        projectId: true
      }
    });

    if (links.length === 0) {
      return;
    }

    const projects = await db.project.findMany({
      where: {
        id: {
          in: links.map((link) => link.projectId)
        }
      },
      select: {
        id: true,
        ownerId: true
      }
    });

    const ownerByProject = new Map(projects.map((project) => [project.id, project.ownerId]));

    for (const link of links) {
      const ownerId = ownerByProject.get(link.projectId);
      if (!ownerId) {
        continue;
      }

      await this.upsertSyncedMember({
        db,
        projectId: link.projectId,
        projectOwnerId: ownerId,
        userId: input.userId
      });
    }
  }

  async handleTeamMembershipRemoved(
    input: {
      teamId: string;
      userId: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = this.db(tx);

    const links = await db.projectTeamLink.findMany({
      where: {
        teamId: input.teamId
      },
      select: {
        projectId: true
      }
    });

    if (links.length === 0) {
      return;
    }

    const projects = await db.project.findMany({
      where: {
        id: {
          in: links.map((link) => link.projectId)
        }
      },
      select: {
        id: true,
        ownerId: true
      }
    });

    const ownerByProject = new Map(projects.map((project) => [project.id, project.ownerId]));

    for (const link of links) {
      const ownerId = ownerByProject.get(link.projectId);
      if (!ownerId) {
        continue;
      }

      await this.removeSyncedMember({
        db,
        projectId: link.projectId,
        projectOwnerId: ownerId,
        userId: input.userId
      });
    }
  }

  async handleTeamMembershipSetChanged(
    input: {
      teamId: string;
      beforeUserIds: string[];
      afterUserIds: string[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const before = new Set(input.beforeUserIds);
    const after = new Set(input.afterUserIds);

    const added = [...after].filter((userId) => !before.has(userId));
    const removed = [...before].filter((userId) => !after.has(userId));

    if (added.length === 0 && removed.length === 0) {
      return;
    }

    for (const userId of added) {
      await this.handleTeamMembershipAdded({ teamId: input.teamId, userId }, tx);
    }

    for (const userId of removed) {
      await this.handleTeamMembershipRemoved({ teamId: input.teamId, userId }, tx);
    }
  }
}
