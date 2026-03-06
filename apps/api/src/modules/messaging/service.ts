import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { MessageKind } from "@prisma/client";
import { createAndDispatchNotification } from "../../lib/notifications.js";

const DEFAULT_FILE_MIME = "application/octet-stream";
const MAX_INSTANT_CALL_PARTICIPANTS = 20;

const stripControlChars = (input: string): string =>
  Array.from(input)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

const sanitizeFileName = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ");

  const safe = stripControlChars(normalized)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ");

  return safe.length > 0 ? safe.slice(0, 255) : "archivo";
};

const truncatePreview = (input: string, max = 120): string => {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max - 1)}…`;
};

const isInlinePreviewMime = (mimeType: string) => {
  const safeMime = mimeType.toLowerCase();
  return safeMime.startsWith("image/") || safeMime === "application/pdf";
};

export class MessagingService {
  constructor(private readonly app: FastifyInstance) {}

  private async listMessagingProjectsForUser(userId: string) {
    return this.app.prisma.project.findMany({
      where: {
        OR: [
          {
            ownerId: userId
          },
          {
            members: {
              some: {
                userId
              }
            }
          }
        ]
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    });
  }

  private formatUserName(input: { firstName: string; lastName: string }) {
    return `${input.firstName} ${input.lastName}`.trim();
  }

  private buildDeepLink(input: {
    channelId: string;
    messageId: string;
    projectId: string | null;
    teamId: string | null;
  }) {
    const params = new URLSearchParams({
      channelId: input.channelId,
      messageId: input.messageId
    });

    if (input.projectId) {
      params.set("projectId", input.projectId);
    }

    if (input.teamId) {
      params.set("teamId", input.teamId);
    }

    return `/messaging?${params.toString()}`;
  }

  private formatMessagePreview(input: {
    kind: MessageKind;
    content: string;
    attachmentName?: string | null;
  }) {
    if (input.kind === "FILE") {
      return input.attachmentName
        ? `Archivo compartido: ${input.attachmentName}`
        : "Archivo compartido";
    }

    if (input.kind === "CALL_INVITE") {
      return "Videollamada instantánea iniciada";
    }

    return truncatePreview(input.content);
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

  private async validateMentionsForChannel(input: {
    channelId: string;
    projectId: string | null;
    mentions: string[];
    channelMemberIds: Set<string>;
  }) {
    const dedupedMentions = [...new Set(input.mentions)];
    let validMentions = dedupedMentions.filter((userId) => input.channelMemberIds.has(userId));

    if (input.projectId && validMentions.length > 0) {
      const projectMembers = await this.app.prisma.projectMember.findMany({
        where: {
          projectId: input.projectId,
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

    return validMentions;
  }

  private async notifyChannelActivity(input: {
    channel: {
      id: string;
      name: string;
      projectId: string | null;
      teamId: string | null;
      members: Array<{ userId: string }>;
    };
    message: {
      id: string;
      authorId: string;
      kind: MessageKind;
      content: string;
      attachments: Array<{ originalName: string }>;
    };
    mentions: string[];
  }) {
    const deepLink = this.buildDeepLink({
      channelId: input.channel.id,
      messageId: input.message.id,
      projectId: input.channel.projectId,
      teamId: input.channel.teamId
    });

    const mentionRecipients = input.mentions.filter((userId) => userId !== input.message.authorId);

    if (mentionRecipients.length > 0) {
      await Promise.all(
        mentionRecipients.map((userId) =>
          createAndDispatchNotification(this.app, {
            userId,
            event: "MENCION_MENSAJE",
            title: "Te mencionaron",
            body: `Tienes una mención en ${input.channel.name}. Ruta: ${deepLink}`
          })
        )
      );
    }
  }

  private async createMessageRecord(input: {
    channel: {
      id: string;
      name: string;
      projectId: string | null;
      teamId: string | null;
      members: Array<{ userId: string }>;
    };
    authorId: string;
    kind: MessageKind;
    content: string;
    mentions: string[];
    meetingId?: string;
    attachment?: {
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      minioPath: string;
    };
  }) {
    const channelMemberIds = new Set(input.channel.members.map((member) => member.userId));
    const validMentions = await this.validateMentionsForChannel({
      channelId: input.channel.id,
      projectId: input.channel.projectId,
      mentions: input.mentions,
      channelMemberIds
    });

    const message = await this.app.prisma.message.create({
      data: {
        channelId: input.channel.id,
        authorId: input.authorId,
        kind: input.kind,
        content: input.content,
        mentions: validMentions,
        meetingId: input.meetingId,
        attachments: input.attachment
          ? {
              create: {
                originalName: input.attachment.originalName,
                mimeType: input.attachment.mimeType,
                sizeBytes: input.attachment.sizeBytes,
                minioPath: input.attachment.minioPath
              }
            }
          : undefined
      },
      include: {
        attachments: true
      }
    });

    await this.notifyChannelActivity({
      channel: input.channel,
      message: {
        id: message.id,
        authorId: message.authorId,
        kind: message.kind,
        content: message.content,
        attachments: message.attachments.map((attachment) => ({
          originalName: attachment.originalName
        }))
      },
      mentions: validMentions
    });

    await this.app.realtime?.emitChannelMessage(input.channel.id, message);

    return message;
  }

  private mapPreviewMessage(
    message: {
      id: string;
      content: string;
      kind: MessageKind;
      createdAt: Date;
      authorId: string;
      attachments?: Array<{ originalName: string }>;
    } | null
  ) {
    if (!message) {
      return null;
    }

    return {
      messageId: message.id,
      content: this.formatMessagePreview({
        kind: message.kind,
        content: message.content,
        attachmentName: message.attachments?.[0]?.originalName ?? null
      }).slice(0, 160),
      kind: message.kind,
      createdAt: message.createdAt.toISOString(),
      authorId: message.authorId
    };
  }

  private async getLatestMessagesByChannel(channelIds: string[]) {
    if (channelIds.length === 0) {
      return new Map<string, {
        id: string;
        channelId: string;
        content: string;
        kind: MessageKind;
        createdAt: Date;
        authorId: string;
        attachments: Array<{ originalName: string }>;
      }>();
    }

    const rows = await this.app.prisma.message.findMany({
      where: {
        channelId: {
          in: channelIds
        }
      },
      include: {
        attachments: {
          select: {
            originalName: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const latestByChannel = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByChannel.has(row.channelId)) {
        latestByChannel.set(row.channelId, row);
      }
    }

    return latestByChannel;
  }

  private async getProjectForUser(projectId: string, userId: string) {
    const [project, membership, user] = await Promise.all([
      this.app.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          ownerId: true
        }
      }),
      this.app.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId
        },
        select: {
          id: true
        }
      }),
      this.app.prisma.user.findUnique({
        where: { id: userId },
        select: { baseRole: true }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    const isAdmin = user?.baseRole === "ADMINISTRADOR";
    const hasAccess = Boolean(membership) || project.ownerId === userId || isAdmin;

    if (!hasAccess) {
      throw new Error("No tienes acceso al proyecto");
    }

    return project;
  }

  private pickGeneralChannel<T extends { name: string }>(channels: T[]): T | null {
    if (channels.length === 0) {
      return null;
    }

    return channels.find((channel) => /general/i.test(channel.name)) ?? channels[0] ?? null;
  }

  async createChannel(input: {
    name: string;
    scope: "EQUIPO" | "PROYECTO";
    teamId?: string;
    projectId?: string;
    memberIds: string[];
    creatorId: string;
  }) {
    const creator = await this.app.prisma.user.findUnique({
      where: { id: input.creatorId },
      select: { baseRole: true }
    });
    const creatorIsAdmin = creator?.baseRole === "ADMINISTRADOR";

    if (input.scope === "PROYECTO") {
      if (!input.projectId) {
        throw new Error("projectId es obligatorio para canales de proyecto");
      }
      if (input.teamId) {
        throw new Error("teamId debe ser nulo en canales de proyecto");
      }
    }

    if (input.scope === "EQUIPO") {
      if (!input.teamId) {
        throw new Error("teamId es obligatorio para canales de equipo");
      }
      if (input.projectId) {
        throw new Error("projectId debe ser nulo en canales de equipo");
      }
    }

    const allowedMemberIds = new Set<string>();

    if (input.scope === "PROYECTO") {
      const project = await this.app.prisma.project.findUnique({
        where: { id: input.projectId! },
        select: { id: true, ownerId: true }
      });

      if (!project) {
        throw new Error("Proyecto no encontrado");
      }

      const membership = creatorIsAdmin
        ? { id: "admin" }
        : await this.app.prisma.projectMember.findFirst({
            where: {
              projectId: input.projectId!,
              userId: input.creatorId
            },
            select: {
              id: true
            }
          });

      if (!membership && project.ownerId !== input.creatorId) {
        throw new Error("No tienes acceso a este proyecto");
      }

      const projectMembers = await this.app.prisma.projectMember.findMany({
        where: { projectId: input.projectId! },
        select: { userId: true }
      });

      allowedMemberIds.add(project.ownerId);
      for (const member of projectMembers) {
        allowedMemberIds.add(member.userId);
      }
    } else {
      const team = await this.app.prisma.team.findUnique({
        where: { id: input.teamId! },
        select: { id: true }
      });

      if (!team) {
        throw new Error("Equipo no encontrado");
      }

      if (!creatorIsAdmin) {
        const membership = await this.app.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId!,
            userId: input.creatorId
          },
          select: { id: true }
        });

        if (!membership) {
          throw new Error("No tienes acceso a este equipo");
        }
      }

      const teamMembers = await this.app.prisma.teamMember.findMany({
        where: { teamId: input.teamId! },
        select: { userId: true }
      });

      for (const member of teamMembers) {
        allowedMemberIds.add(member.userId);
      }
    }

    const requestedMemberIds = [...new Set(input.memberIds.filter((id) => id !== input.creatorId))];
    const invalidMembers = requestedMemberIds.filter((memberId) => !allowedMemberIds.has(memberId));

    if (invalidMembers.length > 0) {
      throw new Error("Uno o más miembros no pertenecen al alcance del canal");
    }

    const channel = await this.app.prisma.channel.create({
      data: {
        name: input.name,
        scope: input.scope,
        teamId: input.teamId,
        projectId: input.projectId,
        members: {
          create: [
            { userId: input.creatorId },
            ...requestedMemberIds.map((id) => ({ userId: id }))
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

    return this.createMessageRecord({
      channel,
      authorId: input.authorId,
      kind: "TEXT",
      content: normalizedContent,
      mentions: input.mentions
    });
  }

  async createFileMessage(input: {
    channelId: string;
    authorId: string;
    content?: string;
    mentions?: string[];
    originalName: string;
    mimeType: string;
    data: Buffer;
  }) {
    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    if (input.data.length <= 0) {
      throw new Error("El archivo está vacío");
    }

    const channel = await this.getChannelForMember(input.channelId, input.authorId);

    const safeName = sanitizeFileName(input.originalName);
    const safeMime = input.mimeType.trim() || DEFAULT_FILE_MIME;
    const objectKey = `messages/${input.channelId}/${Date.now()}-${randomUUID()}-${safeName}`;

    await this.app.storage.putObject(objectKey, input.data, safeMime);

    const content =
      input.content?.trim() ||
      `Archivo adjunto: ${safeName}`;

    return this.createMessageRecord({
      channel,
      authorId: input.authorId,
      kind: "FILE",
      content,
      mentions: input.mentions ?? [],
      attachment: {
        originalName: safeName,
        mimeType: safeMime,
        sizeBytes: input.data.length,
        minioPath: objectKey
      }
    });
  }

  async createInstantCall(input: {
    channelId: string;
    authorId: string;
  }) {
    const channel = await this.getChannelForMember(input.channelId, input.authorId);

    const participantIds = [...new Set(channel.members.map((member) => member.userId))];
    if (participantIds.length > MAX_INSTANT_CALL_PARTICIPANTS) {
      throw new Error(
        `La videollamada instantánea admite máximo ${MAX_INSTANT_CALL_PARTICIPANTS} participantes por canal`
      );
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const meeting = await this.app.prisma.meeting.create({
      data: {
        title: `Llamada · ${channel.name}`.slice(0, 200),
        description: "Videollamada instantánea iniciada desde mensajería",
        projectId: channel.projectId,
        teamId: channel.teamId,
        startsAt,
        endsAt,
        createdById: input.authorId,
        status: "EN_CURSO",
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            joinedAt: userId === input.authorId ? startsAt : null
          }))
        }
      }
    });

    const joinParams = new URLSearchParams({
      meetingId: meeting.id
    });

    if (channel.projectId) {
      joinParams.set("projectId", channel.projectId);
    }

    const joinUrl = `/call?${joinParams.toString()}`;

    const callInvite = await this.createMessageRecord({
      channel,
      authorId: input.authorId,
      kind: "CALL_INVITE",
      content: "Inició una videollamada instantánea",
      mentions: [],
      meetingId: meeting.id
    });

    return {
      meetingId: meeting.id,
      joinUrl,
      message: callInvite
    };
  }

  async listMessages(channelId: string, userId: string) {
    await this.getChannelForMember(channelId, userId);

    return this.app.prisma.message.findMany({
      where: { channelId },
      include: {
        attachments: {
          orderBy: {
            createdAt: "asc"
          }
        }
      },
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
    if (!filters?.teamId) {
      const projectsToEnsure = filters?.projectId
        ? [{ id: filters.projectId }]
        : await this.listMessagingProjectsForUser(userId);

      await Promise.all(
        projectsToEnsure.map((project) =>
          this.ensureProjectGeneralChannel({
            projectId: project.id,
            requesterId: userId
          })
        )
      );
    }

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

  async getConversations(userId: string) {
    const projects = await this.listMessagingProjectsForUser(userId);
    const ensuredProjectChannels = await Promise.all(
      projects.map((project) =>
        this.ensureProjectGeneralChannel({
          projectId: project.id,
          requesterId: userId
        })
      )
    );

    const projectGeneralChannelByProject = new Map(
      ensuredProjectChannels
        .filter((channel) => Boolean(channel.projectId))
        .map((channel) => [channel.projectId!, channel] as const)
    );

    const privateChannels = await this.app.prisma.channel.findMany({
      where: {
        scope: "EQUIPO",
        teamId: null,
        projectId: null,
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        members: {
          select: {
            userId: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const strictPrivateChannels = privateChannels.filter((channel) => channel.members.length === 2);

    const projectChannelIds = projects
      .map((project) => projectGeneralChannelByProject.get(project.id)?.id ?? null)
      .filter((channelId): channelId is string => Boolean(channelId));

    const privateChannelIds = strictPrivateChannels.map((channel) => channel.id);

    const latestByChannel = await this.getLatestMessagesByChannel([...projectChannelIds, ...privateChannelIds]);

    const peerIds = strictPrivateChannels
      .map((channel) => channel.members.find((member) => member.userId !== userId)?.userId ?? null)
      .filter((memberId): memberId is string => Boolean(memberId));

    const peers = peerIds.length
      ? await this.app.prisma.user.findMany({
          where: {
            id: {
              in: [...new Set(peerIds)]
            }
          },
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        })
      : [];

    const peerNameById = new Map(
      peers.map((peer) => [peer.id, this.formatUserName({ firstName: peer.firstName, lastName: peer.lastName })])
    );

    const projectItems = projects.map((project) => {
      const channel = projectGeneralChannelByProject.get(project.id) ?? null;
      const latest = channel ? latestByChannel.get(channel.id) ?? null : null;
      const lastMessage = this.mapPreviewMessage(latest ?? null);

      return {
        projectId: project.id,
        projectName: project.name,
        channelId: channel?.id ?? null,
        channelName: channel?.name ?? null,
        lastMessage,
        lastActivityAt: lastMessage?.createdAt ?? null
      };
    });

    const privateItems = strictPrivateChannels.map((channel) => {
      const peerUserId = channel.members.find((member) => member.userId !== userId)?.userId ?? null;
      const latest = latestByChannel.get(channel.id) ?? null;
      const lastMessage = this.mapPreviewMessage(latest);

      return {
        channelId: channel.id,
        channelName: channel.name,
        peerUserId,
        peerFullName: peerUserId ? peerNameById.get(peerUserId) ?? null : null,
        lastMessage,
        lastActivityAt: lastMessage?.createdAt ?? null
      };
    });

    projectItems.sort((a, b) => {
      const left = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const right = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return right - left;
    });

    privateItems.sort((a, b) => {
      const left = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const right = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return right - left;
    });

    return {
      projectItems,
      privateItems
    };
  }

  async ensureProjectGeneralChannel(input: {
    projectId: string;
    requesterId: string;
  }) {
    const project = await this.getProjectForUser(input.projectId, input.requesterId);

    const existingChannels = await this.app.prisma.channel.findMany({
      where: {
        scope: "PROYECTO",
        projectId: input.projectId
      },
      include: {
        members: {
          select: {
            userId: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const existingGeneral = this.pickGeneralChannel(existingChannels);
    const projectMembers = await this.app.prisma.projectMember.findMany({
      where: {
        projectId: input.projectId
      },
      select: {
        userId: true
      }
    });
    const memberIds = [...new Set([project.ownerId, ...projectMembers.map((member) => member.userId)])];

    if (existingGeneral) {
      const currentMemberIds = new Set(existingGeneral.members.map((member) => member.userId));
      const missingMemberIds = memberIds.filter((memberId) => !currentMemberIds.has(memberId));

      if (missingMemberIds.length === 0) {
        return existingGeneral;
      }

      try {
        return await this.app.prisma.channel.update({
          where: {
            id: existingGeneral.id
          },
          data: {
            members: {
              create: missingMemberIds.map((userId) => ({ userId }))
            }
          },
          include: {
            members: {
              select: {
                userId: true
              }
            }
          }
        });
      } catch {
        const refreshed = await this.app.prisma.channel.findUnique({
          where: {
            id: existingGeneral.id
          },
          include: {
            members: {
              select: {
                userId: true
              }
            }
          }
        });

        if (refreshed) {
          return refreshed;
        }

        throw new Error("No se pudo sincronizar el canal general del proyecto");
      }
    }

    return this.app.prisma.channel.create({
      data: {
        name: `${project.name} · General`.slice(0, 120),
        scope: "PROYECTO",
        projectId: input.projectId,
        members: {
          create: memberIds.map((userId) => ({ userId }))
        }
      },
      include: {
        members: {
          select: {
            userId: true
          }
        }
      }
    });
  }

  async backfillProjectGeneralChannels(input?: { dryRun?: boolean }) {
    const dryRun = input?.dryRun ?? true;

    const projects = await this.app.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const projectIds = projects.map((project) => project.id);
    const [projectMembers, projectChannels] = await Promise.all([
      projectIds.length
        ? this.app.prisma.projectMember.findMany({
            where: {
              projectId: {
                in: projectIds
              }
            },
            select: {
              projectId: true,
              userId: true
            }
          })
        : [],
      projectIds.length
        ? this.app.prisma.channel.findMany({
            where: {
              scope: "PROYECTO",
              projectId: {
                in: projectIds
              }
            },
            include: {
              members: {
                select: {
                  userId: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          })
        : []
    ]);

    const membersByProject = new Map<string, Set<string>>();
    for (const project of projects) {
      membersByProject.set(project.id, new Set([project.ownerId]));
    }
    for (const member of projectMembers) {
      const set = membersByProject.get(member.projectId) ?? new Set<string>();
      set.add(member.userId);
      membersByProject.set(member.projectId, set);
    }

    const channelsByProject = new Map<string, typeof projectChannels>();
    for (const channel of projectChannels) {
      if (!channel.projectId) {
        continue;
      }
      const list = channelsByProject.get(channel.projectId) ?? [];
      list.push(channel);
      channelsByProject.set(channel.projectId, list);
    }

    let channelsCreated = 0;
    let membershipsInserted = 0;

    for (const project of projects) {
      const projectMemberIds = [...(membersByProject.get(project.id) ?? new Set<string>([project.ownerId]))];
      const existingChannels = channelsByProject.get(project.id) ?? [];
      const selected = this.pickGeneralChannel(existingChannels);

      if (!selected) {
        channelsCreated += 1;
        membershipsInserted += projectMemberIds.length;

        if (dryRun) {
          continue;
        }

        await this.app.prisma.channel.create({
          data: {
            name: `${project.name} · General`.slice(0, 120),
            scope: "PROYECTO",
            projectId: project.id,
            members: {
              create: projectMemberIds.map((userId) => ({ userId }))
            }
          }
        });
        continue;
      }

      const existingMemberIds = new Set(selected.members.map((member) => member.userId));
      const missingMemberIds = projectMemberIds.filter((userId) => !existingMemberIds.has(userId));
      membershipsInserted += missingMemberIds.length;

      if (dryRun || missingMemberIds.length === 0) {
        continue;
      }

      await this.app.prisma.channelMember.createMany({
        data: missingMemberIds.map((userId) => ({
          channelId: selected.id,
          userId
        })),
        skipDuplicates: true
      });
    }

    return {
      dryRun,
      projectsScanned: projects.length,
      channelsCreated,
      membershipsInserted
    };
  }

  async getAttachmentContent(input: {
    attachmentId: string;
    userId: string;
  }) {
    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const attachment = await this.app.prisma.messageAttachment.findUnique({
      where: {
        id: input.attachmentId
      },
      include: {
        message: {
          select: {
            id: true,
            channelId: true
          }
        }
      }
    });

    if (!attachment) {
      throw new Error("Adjunto no encontrado");
    }

    const membership = await this.app.prisma.channelMember.findFirst({
      where: {
        channelId: attachment.message.channelId,
        userId: input.userId
      },
      select: {
        id: true
      }
    });

    if (!membership) {
      throw new Error("No tienes acceso a este adjunto");
    }

    const stream = await this.app.storage.getObjectStream(attachment.minioPath);

    return {
      stream,
      attachment: {
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType || DEFAULT_FILE_MIME,
        sizeBytes: attachment.sizeBytes,
        minioPath: attachment.minioPath,
        canInlinePreview: isInlinePreviewMime(attachment.mimeType || DEFAULT_FILE_MIME)
      }
    };
  }
}
