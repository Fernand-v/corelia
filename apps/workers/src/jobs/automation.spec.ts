import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies before importing the module
vi.mock("bullmq", () => ({
  Worker: vi.fn(),
  Queue: vi.fn()
}));

vi.mock("ioredis", () => ({
  Redis: vi.fn()
}));

vi.mock("../lib/queues.js", () => ({
  connection: {},
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../lib/tracing.js", () => ({
  runJobWithTrace: vi.fn(async (_name: string, _ctx: unknown, fn: () => Promise<unknown>) => fn())
}));

vi.mock("../lib/schema-readiness.js", () => ({
  createPrismaSchemaGate: vi.fn(() => vi.fn().mockResolvedValue(true))
}));

const mockPrisma = {
  meeting: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({})
  },
  message: {
    create: vi.fn().mockResolvedValue({ id: "msg-1" })
  },
  task: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 })
  },
  taskStatusHistory: {
    create: vi.fn().mockResolvedValue({})
  },
  projectMember: {
    findMany: vi.fn().mockResolvedValue([])
  },
  notification: {
    create: vi.fn().mockResolvedValue({ id: "notif-1" })
  }
};

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mockPrisma)
}));

vi.mock("../lib/env.js", () => ({
  env: { REDIS_URL: "redis://localhost:6379", REDIS_PASSWORD: "" }
}));

describe("automation worker — handleMissedCallCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.message.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.meeting.update.mockResolvedValue({});
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });
  });

  it("does nothing when meeting is not found", async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue(null);
    const { handleMissedCallCheck } = await import("./automation.worker.js");

    await handleMissedCallCheck({ meetingId: "m-1", channelId: "c-1" });

    expect(mockPrisma.message.create).not.toHaveBeenCalled();
    expect(mockPrisma.meeting.update).not.toHaveBeenCalled();
  });

  it("does nothing when meeting is already FINALIZADA", async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m-1",
      status: "FINALIZADA",
      createdById: "u-1",
      participants: []
    });
    const { handleMissedCallCheck } = await import("./automation.worker.js");

    await handleMissedCallCheck({ meetingId: "m-1", channelId: "c-1" });

    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });

  it("does nothing when another participant already joined", async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m-1",
      status: "EN_CURSO",
      createdById: "u-creator",
      participants: [
        { userId: "u-creator", joinedAt: new Date() },
        { userId: "u-other", joinedAt: new Date() } // someone else joined
      ]
    });
    const { handleMissedCallCheck } = await import("./automation.worker.js");

    await handleMissedCallCheck({ meetingId: "m-1", channelId: "c-1" });

    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });

  it("creates LLAMADA_PERDIDA message when nobody joined a voice call", async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m-1",
      status: "EN_CURSO",
      createdById: "u-creator",
      participants: [{ userId: "u-creator", joinedAt: new Date() }] // only creator
    });
    const { handleMissedCallCheck } = await import("./automation.worker.js");

    await handleMissedCallCheck({ meetingId: "m-1", channelId: "c-1", callType: "VOZ" });

    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "LLAMADA_PERDIDA",
          content: "Llamada de voz perdida",
          channelId: "c-1"
        })
      })
    );
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FINALIZADA" } })
    );
  });

  it("creates LLAMADA_PERDIDA with videollamada label when callType is VIDEO", async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m-2",
      status: "EN_CURSO",
      createdById: "u-creator",
      participants: []
    });
    const { handleMissedCallCheck } = await import("./automation.worker.js");

    await handleMissedCallCheck({ meetingId: "m-2", channelId: "c-2", callType: "VIDEO" });

    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: "Videollamada perdida" })
      })
    );
  });

  it("uses VIDEO label when callType is omitted", async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: "m-3",
      status: "EN_CURSO",
      createdById: "u-creator",
      participants: []
    });
    const { handleMissedCallCheck } = await import("./automation.worker.js");

    await handleMissedCallCheck({ meetingId: "m-3", channelId: "c-3" }); // no callType

    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: "Videollamada perdida" })
      })
    );
  });
});
