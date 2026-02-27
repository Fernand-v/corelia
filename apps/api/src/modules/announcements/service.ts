import type { FastifyInstance } from "fastify";
import type { AnnouncementContentBlock } from "@corelia/types";
import { parseAnnouncementBody, serializeAnnouncementBody } from "./content.js";

export class AnnouncementService {
  constructor(private readonly app: FastifyInstance) {}

  private mapAnnouncementForClient(input: {
    id: string;
    title: string;
    body: string;
    allCompany: boolean;
    expiresAt: Date;
    createdById: string;
    createdAt: Date;
    teams: Array<{ teamId: string }>;
    users: Array<{ userId: string }>;
  }) {
    const parsedBody = parseAnnouncementBody(input.body);
    const audienceUserIds = [
      ...new Set(
        (input.users.length > 0
          ? input.users.map((audienceUser) => audienceUser.userId)
          : parsedBody.audienceUserIds
        ).filter(Boolean)
      )
    ];
    return {
      id: input.id,
      title: input.title,
      body: parsedBody.summary,
      ...(parsedBody.blocks.length > 0 ? { content: { blocks: parsedBody.blocks } } : {}),
      audience: {
        allCompany: input.allCompany,
        teamIds: input.teams.map((team) => team.teamId),
        userIds: audienceUserIds
      },
      expiresAt: input.expiresAt.toISOString(),
      createdById: input.createdById,
      createdAt: input.createdAt.toISOString()
    };
  }

  async create(input: {
    title: string;
    body: string;
    content?: { blocks: AnnouncementContentBlock[] };
    audience: { allCompany: boolean; teamIds: string[]; userIds: string[] };
    expiresAt: string;
    createdById: string;
  }) {
    const teamIds = [...new Set(input.audience.teamIds)];
    const userIds = [...new Set(input.audience.userIds)];

    if (!input.audience.allCompany && teamIds.length === 0 && userIds.length === 0) {
      throw new Error("Selecciona audiencia global, equipos o usuarios específicos");
    }

    const announcement = await this.app.prisma.announcement.create({
      data: {
        title: input.title,
        body: serializeAnnouncementBody({
          summary: input.body,
          blocks: input.content?.blocks ?? [],
          audienceUserIds: userIds
        }),
        allCompany: input.audience.allCompany,
        expiresAt: new Date(input.expiresAt),
        createdById: input.createdById,
        teams: {
          create: teamIds.map((teamId) => ({ teamId }))
        },
        users: {
          create: userIds.map((userId) => ({ userId }))
        }
      },
      include: {
        teams: {
          select: {
            teamId: true
          }
        },
        users: {
          select: {
            userId: true
          }
        }
      }
    });

    return this.mapAnnouncementForClient(announcement);
  }

  async listForUser(userId: string) {
    const teamMemberships = await this.app.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true }
    });
    const teamIds = teamMemberships.map((membership) => membership.teamId);

    const announcements = await this.app.prisma.announcement.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        teams: {
          select: {
            teamId: true
          }
        },
        users: {
          select: {
            userId: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const announcementsForUser = announcements
      .map((announcement) => {
        const parsedBody = parseAnnouncementBody(announcement.body);
        const inTeams = announcement.teams.some((team) => teamIds.includes(team.teamId));
        const relationUserIds = announcement.users.map((user) => user.userId);
        const inUsers =
          relationUserIds.includes(userId) || parsedBody.audienceUserIds.includes(userId);
        const isCreator = announcement.createdById === userId;

        if (!announcement.allCompany && !inTeams && !inUsers && !isCreator) {
          return null;
        }

        return this.mapAnnouncementForClient(announcement);
      })
      .filter(
        (
          item
        ): item is ReturnType<AnnouncementService["mapAnnouncementForClient"]> => Boolean(item)
      );

    return announcementsForUser;
  }
}
