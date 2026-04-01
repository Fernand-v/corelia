import { describe, expect, it, vi } from "vitest";
import { MessagingService } from "../modules/messaging/service.js";

const createMockApp = () =>
  ({
    prisma: {
      channel: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn()
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      project: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      projectMember: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      message: {
        create: vi.fn(),
        findMany: vi.fn()
      },
      messageReceipt: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([])
      },
      meeting: {
        create: vi.fn()
      },
      channelMember: {
        findFirst: vi.fn(),
        createMany: vi.fn()
      },
      messageAttachment: {
        findUnique: vi.fn()
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: crypto.randomUUID()
        })
      }
    },
    storage: {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObjectStream: vi.fn(),
      removeObject: vi.fn().mockResolvedValue(undefined)
    },
    realtime: {
      emitNotification: vi.fn().mockResolvedValue(undefined),
      emitChannelMessage: vi.fn().mockResolvedValue(undefined)
    }
  }) as unknown as ConstructorParameters<typeof MessagingService>[0];

describe("MessagingService", () => {
  it("sends message through API flow and emits realtime event", async () => {
    const app = createMockApp();
    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Canal proyecto",
      members: [{ userId: "u-1" }, { userId: "u-2" }]
    });
    app.prisma.message.create = vi.fn().mockResolvedValue({
      id: "m-1",
      channelId: "c-1",
      authorId: "u-1",
      kind: "TEXT",
      content: "Mensaje con acento á y emoji 🚀",
      mentions: [],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const service = new MessagingService(app);
    const message = await service.createMessage({
      channelId: "c-1",
      authorId: "u-1",
      content: "Mensaje con acento á y emoji 🚀",
      mentions: []
    });

    expect(message.id).toBe("m-1");
    expect(app.prisma.message.create).toHaveBeenCalledTimes(1);
    expect(app.realtime!.emitChannelMessage).toHaveBeenCalledWith("c-1", expect.any(Object));
  });

  it("rejects empty messages after trim", async () => {
    const app = createMockApp();
    const service = new MessagingService(app);

    await expect(
      service.createMessage({
        channelId: "c-1",
        authorId: "u-1",
        content: "   ",
        mentions: []
      })
    ).rejects.toThrowError("no puede estar vacío");
  });

  it("loads channel history only for channel members", async () => {
    const app = createMockApp();
    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Canal",
      members: [{ userId: "u-1" }]
    });
    app.prisma.message.findMany = vi.fn().mockResolvedValue([
      {
        id: "m-1",
        channelId: "c-1",
        content: "Hola",
        authorId: "u-1",
        mentions: [],
        attachments: [],
        receipts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const service = new MessagingService(app);
    const messages = await service.listMessages("c-1", "u-1");

    expect(messages).toHaveLength(1);
    expect(app.prisma.message.findMany).toHaveBeenCalledWith({
      where: { channelId: "c-1" },
      include: {
        attachments: {
          orderBy: {
            createdAt: "asc"
          }
        },
        receipts: {
          select: {
            status: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  });

  it("blocks history access for non-members", async () => {
    const app = createMockApp();
    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Canal",
      members: [{ userId: "u-2" }]
    });

    const service = new MessagingService(app);

    await expect(service.listMessages("c-1", "u-1")).rejects.toThrowError(
      "No tienes acceso a este canal"
    );
  });

  it("creates a global direct channel and reuses existing one", async () => {
    const app = createMockApp();
    app.prisma.user.findMany = vi.fn().mockResolvedValue([
      { id: "u-1", firstName: "Ana", lastName: "Ruiz" },
      { id: "u-2", firstName: "Bruno", lastName: "Paz" }
    ]);
    app.prisma.channel.findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "c-existing",
        name: "Directo · Ana Ruiz / Bruno Paz",
        scope: "EQUIPO",
        projectId: null,
        teamId: null
      });
    app.prisma.channel.create = vi.fn().mockResolvedValue({
      id: "c-new",
      name: "Directo · Ana Ruiz / Bruno Paz",
      scope: "EQUIPO",
      projectId: null,
      teamId: null
    });

    const service = new MessagingService(app);
    const created = await service.createDirectChannel({
      creatorId: "u-1",
      targetUserId: "u-2"
    });
    const reused = await service.createDirectChannel({
      creatorId: "u-1",
      targetUserId: "u-2"
    });

    expect(created.id).toBe("c-new");
    expect(reused.id).toBe("c-existing");
    expect(app.prisma.channel.create).toHaveBeenCalledTimes(1);
  });

  it("stores file messages under messages/{channelId} and creates attachment metadata", async () => {
    const app = createMockApp();
    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Canal proyecto",
      projectId: null,
      teamId: null,
      members: [{ userId: "u-1" }, { userId: "u-2" }]
    });
    app.prisma.message.create = vi.fn().mockResolvedValue({
      id: "m-file-1",
      channelId: "c-1",
      authorId: "u-1",
      kind: "FILE",
      content: "Archivo adjunto: prueba.pdf",
      mentions: [],
      attachments: [
        {
          id: "a-1",
          originalName: "prueba.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10,
          minioPath: "messages/c-1/x-prueba.pdf",
          createdAt: new Date()
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const service = new MessagingService(app);
    await service.createFileMessage({
      channelId: "c-1",
      authorId: "u-1",
      originalName: "prueba.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("contenido")
    });

    expect(app.storage?.putObject).toHaveBeenCalledTimes(1);
    const [objectKey] = (app.storage?.putObject as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(objectKey.startsWith("messages/c-1/")).toBe(true);
    expect(app.prisma.message.create).toHaveBeenCalledTimes(1);
  });

  it("rejects instant calls when channel has more than 20 members", async () => {
    const app = createMockApp();
    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Canal grande",
      projectId: null,
      teamId: null,
      members: Array.from({ length: 21 }, (_, index) => ({
        userId: `u-${index + 1}`
      }))
    });

    const service = new MessagingService(app);

    await expect(
      service.createInstantCall({
        channelId: "c-1",
        authorId: "u-1"
      })
    ).rejects.toThrowError("máximo 20 participantes");
  });

  it("creates project general channel when missing and syncs owner + members", async () => {
    const app = createMockApp();
    app.prisma.project.findUnique = vi.fn().mockResolvedValue({
      id: "p-1",
      name: "Proyecto Prueba",
      ownerId: "u-owner"
    });
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({
      id: "pm-1"
    });
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: "COLABORADOR"
    });
    app.prisma.channel.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      { userId: "u-member-1" },
      { userId: "u-member-2" }
    ]);
    app.prisma.channel.create = vi.fn().mockResolvedValue({
      id: "c-general",
      name: "Proyecto Prueba · General",
      projectId: "p-1",
      members: [{ userId: "u-owner" }, { userId: "u-member-1" }, { userId: "u-member-2" }]
    });

    const service = new MessagingService(app);
    const channel = await service.ensureProjectGeneralChannel({
      projectId: "p-1",
      requesterId: "u-member-1"
    });

    expect(channel.id).toBe("c-general");
    expect(app.prisma.channel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: "PROYECTO",
          projectId: "p-1",
          name: "Proyecto Prueba · General"
        })
      })
    );
  });

  it("backfills project general channels and missing memberships idempotently", async () => {
    const app = createMockApp();
    app.prisma.project.findMany = vi.fn().mockResolvedValue([
      { id: "p-1", name: "Proyecto Uno", ownerId: "u-owner-1" },
      { id: "p-2", name: "Proyecto Dos", ownerId: "u-owner-2" }
    ]);
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      { projectId: "p-1", userId: "u-member-1" },
      { projectId: "p-2", userId: "u-member-2" }
    ]);
    app.prisma.channel.findMany = vi.fn().mockResolvedValue([
      {
        id: "c-p1",
        name: "Canal Proyecto Uno",
        projectId: "p-1",
        members: [{ userId: "u-owner-1" }]
      }
    ]);
    app.prisma.channel.create = vi.fn().mockResolvedValue({
      id: "c-p2",
      name: "Proyecto Dos · General",
      projectId: "p-2"
    });
    app.prisma.channelMember.createMany = vi.fn().mockResolvedValue({
      count: 1
    });

    const service = new MessagingService(app);

    const dryRun = await service.backfillProjectGeneralChannels({ dryRun: true });
    expect(dryRun).toEqual({
      dryRun: true,
      projectsScanned: 2,
      channelsCreated: 1,
      membershipsInserted: 3
    });
    expect(app.prisma.channel.create).not.toHaveBeenCalled();
    expect(app.prisma.channelMember.createMany).not.toHaveBeenCalled();

    const apply = await service.backfillProjectGeneralChannels({ dryRun: false });
    expect(apply).toEqual({
      dryRun: false,
      projectsScanned: 2,
      channelsCreated: 1,
      membershipsInserted: 3
    });
    expect(app.prisma.channel.create).toHaveBeenCalledTimes(1);
    expect(app.prisma.channelMember.createMany).toHaveBeenCalledTimes(1);
    expect(app.prisma.channelMember.createMany).toHaveBeenCalledWith({
      data: [{ channelId: "c-p1", userId: "u-member-1" }],
      skipDuplicates: true
    });
  });
});
