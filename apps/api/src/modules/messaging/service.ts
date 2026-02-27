import type { FastifyInstance } from "fastify";
import { createAndDispatchNotification } from "../../lib/notifications.js";

export class MessagingService {
  constructor(private readonly app: FastifyInstance) {}

  private formatUserName(input: { firstName: string; lastName: string }) {
    return `${input.firstName} ${input.lastName}`.trim();
  }

  private async getChannelForMember(channelId: string, userId: string) {
    const channel = await this.app.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!channel) {
      throw new Error("Canal no encontrado");
    }

    const isMember = channel.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new Error("No tienes acceso a este canal");
    }

    return channel;
  }

  async createChannel(input: {
    name: string;
    scope: "EQUIPO" | "PROYECTO";
    teamId?: string;
    projectId?: string;
    memberIds: string[];
    creatorId: string;
  }) {
    const channel = await this.app.prisma.channel.create({
      data: {
        name: input.name,
        scope: input.scope,
        teamId: input.teamId,
        projectId: input.projectId,
        members: {
          create: [
            { userId: input.creatorId },
            ...input.memberIds.filter((id) => id !== input.creatorId).map((id) => ({ userId: id }))
          ]
        }
      },
      include: {
        members: true
      }
    });

    return channel;
  }

  async createDirectChannel(input: {
    creatorId: string;
    targetUserId: string;
  }) {
    if (input.creatorId === input.targetUserId) {
      throw new Error("No puedes crear un chat directo contigo mismo");
    }

    const users = await this.app.prisma.user.findMany({
      where: {
        id: {
          in: [input.creatorId, input.targetUserId]
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    if (users.length !== 2) {
      throw new Error("Usuario objetivo inválido o inactivo");
    }

    const existing = await this.app.prisma.channel.findFirst({
      where: {
        scope: "EQUIPO",
        projectId: null,
        teamId: null,
        AND: [
          {
            members: {
              some: {
                userId: input.creatorId
              }
            }
          },
          {
            members: {
              some: {
                userId: input.targetUserId
              }
            }
          },
          {
            members: {
              every: {
                userId: {
                  in: [input.creatorId, input.targetUserId]
                }
              }
            }
          }
        ]
      }
    });

    if (existing) {
      return existing;
    }

    const sortedNames = users.map((user) => this.formatUserName(user)).sort((a, b) => a.localeCompare(b));
    const channelName = `Directo · ${sortedNames.join(" / ")}`.slice(0, 120);

    return this.app.prisma.channel.create({
      data: {
        name: channelName,
        scope: "EQUIPO",
        members: {
          create: [{ userId: input.creatorId }, { userId: input.targetUserId }]
        }
      }
    });
  }

  async createMessage(input: {
    channelId: string;
    authorId: string;
    content: string;
    mentions: string[];
  }) {
    const normalizedContent = input.content.trim();
    if (!normalizedContent) {
      throw new Error("El mensaje no puede estar vacío");
    }

    const channel = await this.getChannelForMember(input.channelId, input.authorId);
    const channelMemberIds = new Set(channel.members.map((member) => member.userId));
    const dedupedMentions = [...new Set(input.mentions)];
    let validMentions = dedupedMentions.filter((userId) => channelMemberIds.has(userId));

    if (channel.projectId && validMentions.length > 0) {
      const projectMembers = await this.app.prisma.projectMember.findMany({
        where: {
          projectId: channel.projectId,
          userId: {
            in: validMentions
          }
        },
        select: {
          userId: true
        }
      });
      const projectMemberIds = new Set(projectMembers.map((member) => member.userId));
      validMentions = validMentions.filter((userId) => projectMemberIds.has(userId));
    }

    const message = await this.app.prisma.message.create({
      data: {
        channelId: input.channelId,
        authorId: input.authorId,
        content: normalizedContent,
        mentions: validMentions
      }
    });

    const deepLinkParams = new URLSearchParams({
      channelId: input.channelId,
      messageId: message.id
    });

    if (channel.projectId) {
      deepLinkParams.set("projectId", channel.projectId);
    }

    if (channel.teamId) {
      deepLinkParams.set("teamId", channel.teamId);
    }

    const deepLink = `/messaging?${deepLinkParams.toString()}`;

    const memberRecipients = channel.members
      .map((member) => member.userId)
      .filter((userId) => userId !== input.authorId);

    await Promise.all(
      memberRecipients.map((userId) =>
        createAndDispatchNotification(this.app, {
          userId,
          event: "MENSAJE_NUEVO_CANAL",
          title: "Nuevo mensaje en canal",
          body: `Nuevo mensaje en ${channel.name}. Ruta: ${deepLink}`
        })
      )
    );

    const mentions = validMentions.filter((userId) => userId !== input.authorId);

    if (mentions.length > 0) {
      await Promise.all(
        mentions.map((userId) =>
          createAndDispatchNotification(this.app, {
            userId,
            event: "MENCION_MENSAJE",
            title: "Te mencionaron",
            body: `Tienes una mención en ${channel.name}. Ruta: ${deepLink}`
          })
        )
      );
    }

    await this.app.realtime?.emitChannelMessage(input.channelId, message);

    return message;
  }

  async listMessages(channelId: string, userId: string) {
    await this.getChannelForMember(channelId, userId);

    return this.app.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" }
    });
  }

  async listChannels(
    userId: string,
    filters?: {
      projectId?: string;
      teamId?: string;
    }
  ) {
    return this.app.prisma.channel.findMany({
      where: {
        members: {
          some: {
            userId
          }
        },
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(filters?.teamId ? { teamId: filters.teamId } : {})
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }
}
