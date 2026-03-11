import { describe, expect, it, vi } from "vitest";
import { CalendarService } from "../modules/calendar/service.js";
import { MessagingService } from "../modules/messaging/service.js";

vi.mock("../config/env.js", () => ({
  env: {
    GOOGLE_CALENDAR_CLIENT_ID: "",
    GOOGLE_CALENDAR_CLIENT_SECRET: "",
    GOOGLE_CALENDAR_REDIRECT_URI: "",
    MICROSOFT_CALENDAR_CLIENT_ID: "",
    MICROSOFT_CALENDAR_CLIENT_SECRET: "",
    MICROSOFT_CALENDAR_REDIRECT_URI: ""
  }
}));

const createMockApp = () =>
  ({
    prisma: {
      channel: {
        findUnique: vi.fn()
      },
      message: {
        create: vi.fn()
      },
      notification: {
        create: vi.fn()
      },
      task: {
        findMany: vi.fn()
      },
      meeting: {
        findMany: vi.fn()
      },
      availabilityBlock: {
        findMany: vi.fn()
      },
      externalCalendarEvent: {
        findMany: vi.fn()
      }
    },
    queues: {
      notifications: {
        add: vi.fn()
      }
    },
    realtime: {
      emitNotification: vi.fn(),
      emitChannelMessage: vi.fn()
    },
    media: {
      getHealth: vi.fn().mockReturnValue({
        enabled: true,
        healthy: false,
        detail: "worker mediasoup caído",
        driver: "mediasoup"
      })
    }
  }) as unknown as ConstructorParameters<typeof MessagingService>[0] &
    ConstructorParameters<typeof CalendarService>[0];

describe("Degraded mode", () => {
  it("keeps chat and calendar flows available when media is down", async () => {
    const app = createMockApp();

    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Core",
      members: [{ userId: "u-1" }, { userId: "u-2" }]
    });
    app.prisma.message.create = vi.fn().mockResolvedValue({
      id: "msg-1",
      channelId: "c-1",
      authorId: "u-1",
      content: "Hola equipo",
      mentions: []
    });
    app.prisma.notification.create = vi.fn().mockResolvedValue({
      id: "n-1",
      userId: "u-2",
      event: "MENSAJE_NUEVO_CANAL",
      channel: "IN_APP",
      title: "Nuevo mensaje",
      body: "Nuevo mensaje en Core",
      createdAt: new Date(),
      sentAt: null,
      deliveredAt: null,
      readAt: null
    });

    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      {
        id: "t-1",
        title: "Preparar demo",
        dueDate: new Date("2026-03-01T10:00:00.000Z"),
        projectId: "p-1",
        assigneeId: "u-1"
      }
    ]);
    app.prisma.meeting.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.availabilityBlock.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.externalCalendarEvent.findMany = vi.fn().mockResolvedValue([]);

    const messagingService = new MessagingService(app);
    const calendarService = new CalendarService(app);

    const message = await messagingService.createMessage({
      channelId: "c-1",
      authorId: "u-1",
      content: "Hola equipo",
      mentions: []
    });

    const calendar = await calendarService.getPersonalEvents({
      userId: "u-1",
      from: "2026-02-27T00:00:00.000Z",
      to: "2026-03-07T00:00:00.000Z"
    });

    expect(message.id).toBe("msg-1");
    expect(app.realtime!.emitChannelMessage).toHaveBeenCalledWith("c-1", expect.any(Object));
    expect(calendar).toHaveLength(1);
    expect(calendar[0]!.type).toBe("TAREA");
    expect(app.media!.getHealth()).toMatchObject({ healthy: false });
  });
});
