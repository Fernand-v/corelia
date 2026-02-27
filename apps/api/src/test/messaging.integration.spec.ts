import { describe, expect, it, vi } from "vitest";
import { MessagingService } from "../modules/messaging/service.js";

const createMockApp = () =>
  ({
    prisma: {
      channel: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn()
      },
      user: {
        findMany: vi.fn()
      },
      message: {
        create: vi.fn(),
        findMany: vi.fn()
      },
      notification: {
        create: vi.fn().mockResolvedValue({
          id: crypto.randomUUID()
        })
      }
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
      content: "Mensaje con acento á y emoji 🚀",
      mentions: [],
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
    expect(app.realtime.emitChannelMessage).toHaveBeenCalledWith("c-1", expect.any(Object));
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
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const service = new MessagingService(app);
    const messages = await service.listMessages("c-1", "u-1");

    expect(messages).toHaveLength(1);
    expect(app.prisma.message.findMany).toHaveBeenCalledWith({
      where: { channelId: "c-1" },
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
});
