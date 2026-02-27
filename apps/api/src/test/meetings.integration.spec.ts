import { describe, expect, it, vi } from "vitest";
import { MeetingsService } from "../modules/meetings/service.js";
import { MessagingService } from "../modules/messaging/service.js";

vi.mock("../config/env.js", () => ({
  env: {
    SLACK_WEBHOOK_URL: "",
    TEAMS_WEBHOOK_URL: ""
  }
}));

const createMockApp = () =>
  ({
    prisma: {
      projectMember: {
        findFirst: vi.fn()
      },
      teamMember: {
        findFirst: vi.fn()
      },
      user: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      availabilityBlock: {
        findMany: vi.fn()
      },
      meetingParticipant: {
        findMany: vi.fn()
      },
      meeting: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn()
      },
      meetingNote: {
        create: vi.fn()
      },
      meetingAgreement: {
        create: vi.fn(),
        findMany: vi.fn()
      },
      task: {
        findUnique: vi.fn(),
        create: vi.fn()
      },
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn()
      },
      channel: {
        findUnique: vi.fn()
      },
      message: {
        create: vi.fn()
      }
    },
    queues: {
      notifications: {
        add: vi.fn()
      }
    },
    realtime: {
      emitNotification: vi.fn(),
      emitMeetingEvent: vi.fn(),
      emitChannelMessage: vi.fn()
    },
    media: {
      getHealth: vi.fn(),
      getRoomCapabilities: vi.fn()
    }
  }) as unknown as ConstructorParameters<typeof MeetingsService>[0];

describe("Meetings integration flows", () => {
  it("creates meeting and emits realtime + queued notifications", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });
    app.prisma.user.findMany = vi.fn().mockResolvedValue([
      { id: "u-1" },
      { id: "u-2" }
    ]);
    app.prisma.availabilityBlock.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.meetingParticipant.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.meeting.create = vi.fn().mockResolvedValue({
      id: "m-1",
      title: "Daily",
      projectId: "p-1",
      teamId: null,
      startsAt: new Date("2026-03-01T10:00:00.000Z"),
      endsAt: new Date("2026-03-01T10:30:00.000Z"),
      participants: [{ userId: "u-1" }, { userId: "u-2" }],
      agendaItems: []
    });
    app.prisma.notification.create = vi.fn().mockResolvedValue({
      id: "n-1",
      userId: "u-2",
      event: "REUNION_PROGRAMADA",
      channel: "IN_APP",
      title: "Nueva reunión programada",
      body: "Daily",
      createdAt: new Date(),
      sentAt: null,
      deliveredAt: null,
      readAt: null
    });

    const service = new MeetingsService(app);
    const result = await service.createMeeting({
      title: "Daily",
      projectId: "p-1",
      startsAt: "2026-03-01T10:00:00.000Z",
      endsAt: "2026-03-01T10:30:00.000Z",
      participantIds: ["u-1", "u-2"],
      agenda: [],
      createdById: "u-1"
    });

    expect(result.meeting.id).toBe("m-1");
    expect(app.queues.notifications.add).toHaveBeenCalled();
    expect(app.realtime.emitMeetingEvent).toHaveBeenCalledWith("m-1", "meeting:created", expect.any(Object));
  });

  it("creates agreement linked to new task and notifies assignee", async () => {
    const app = createMockApp();
    app.prisma.meeting.findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: "m-1",
        createdById: "u-1",
        projectId: "p-1",
        participants: [{ userId: "u-1" }]
      })
      .mockResolvedValueOnce({
        id: "m-1",
        mediaRoomId: "m-1"
      });
    app.prisma.task.create = vi.fn().mockResolvedValue({
      id: "t-1",
      title: "Preparar informe",
      assigneeId: "u-2"
    });
    app.prisma.notification.create = vi.fn().mockResolvedValue({
      id: "n-2",
      userId: "u-2",
      event: "ACUERDO_ASIGNADO_TAREA",
      channel: "IN_APP",
      title: "Nuevo acuerdo asignado",
      body: "Se creó una tarea",
      createdAt: new Date(),
      sentAt: null,
      deliveredAt: null,
      readAt: null
    });
    app.prisma.meetingAgreement.create = vi.fn().mockResolvedValue({
      id: "a-1",
      meetingId: "m-1",
      title: "Seguimiento",
      taskId: "t-1",
      status: "VINCULADO_TAREA"
    });

    const service = new MeetingsService(app);
    const agreement = await service.createAgreement({
      meetingId: "m-1",
      userId: "u-1",
      title: "Seguimiento",
      createTask: {
        projectId: "p-1",
        title: "Preparar informe",
        assigneeId: "u-2"
      }
    });

    expect(agreement.status).toBe("VINCULADO_TAREA");
    expect(app.prisma.notification.create).toHaveBeenCalled();
    expect(app.realtime.emitMeetingEvent).toHaveBeenCalledWith(
      "m-1",
      "meeting:agreement",
      expect.any(Object)
    );
  });

  it("returns degraded media response when media health is down", async () => {
    const app = createMockApp();
    app.prisma.meeting.findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: "m-1",
        createdById: "u-1",
        projectId: null,
        participants: [{ userId: "u-1" }]
      })
      .mockResolvedValueOnce({
        id: "m-1",
        mediaRoomId: null
      });
    app.media.getHealth = vi.fn().mockReturnValue({
      enabled: true,
      healthy: false,
      detail: "worker caido",
      driver: "mediasoup"
    });

    const service = new MeetingsService(app);
    const result = await service.getMediaCapabilities("m-1", "u-1");

    expect(result.available).toBe(false);
    expect(result.message).toContain("worker");
  });
});

describe("Realtime notifications", () => {
  it("emits channel message realtime and creates mention notifications", async () => {
    const app = createMockApp();
    app.prisma.channel.findUnique = vi.fn().mockResolvedValue({
      id: "c-1",
      name: "Equipo",
      members: [{ userId: "u-1" }, { userId: "u-2" }]
    });
    app.prisma.message.create = vi.fn().mockResolvedValue({
      id: "msg-1",
      channelId: "c-1",
      authorId: "u-1",
      content: "Hola @u2",
      mentions: ["u-2"]
    });
    app.prisma.notification.create = vi.fn().mockResolvedValue({
      id: "n-3",
      userId: "u-2",
      event: "MENCION_MENSAJE",
      channel: "IN_APP",
      title: "Te mencionaron",
      body: "Tienes una nueva mención",
      createdAt: new Date(),
      sentAt: null,
      deliveredAt: null,
      readAt: null
    });

    const service = new MessagingService(app);
    await service.createMessage({
      channelId: "c-1",
      authorId: "u-1",
      content: "Hola @u2",
      mentions: ["u-2"]
    });

    expect(app.realtime.emitChannelMessage).toHaveBeenCalledWith("c-1", expect.any(Object));
    expect(app.prisma.notification.create).toHaveBeenCalled();
  });
});
