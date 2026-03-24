import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => ({
  Worker: vi.fn((queue: string, handler: (job: unknown) => Promise<unknown>) => ({
    queue,
    _handler: handler,
    on: vi.fn()
  })),
  Queue: vi.fn()
}));

vi.mock("ioredis", () => ({ Redis: vi.fn() }));
vi.mock("../lib/queues.js", () => ({ connection: {} }));
vi.mock("../lib/tracing.js", () => ({
  runJobWithTrace: vi.fn(async (_name: string, _ctx: unknown, fn: () => Promise<unknown>) => fn())
}));
vi.mock("../lib/env.js", () => ({
  env: { REDIS_URL: "redis://localhost:6379", REDIS_PASSWORD: "" }
}));

const mockPrisma = {
  webhookEndpoint: { findUnique: vi.fn() },
  webhookDelivery: { create: vi.fn().mockResolvedValue({ id: "delivery-1" }) }
};

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mockPrisma)
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("webhookWorker logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "delivery-1" });
  });

  it("skips delivery when endpoint is not found", async () => {
    mockPrisma.webhookEndpoint.findUnique.mockResolvedValue(null);
    const { webhookWorker } = await import("./webhook.worker.js");
    const handler = (webhookWorker as unknown as { _handler: (job: unknown) => Promise<void> })._handler;

    await handler({ data: { endpointId: "ep-1", payload: { event: "task.created" } } });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrisma.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it("skips delivery when endpoint is disabled", async () => {
    mockPrisma.webhookEndpoint.findUnique.mockResolvedValue({
      id: "ep-1",
      url: "https://example.com/hook",
      secret: "s3cret",
      enabled: false
    });
    const { webhookWorker } = await import("./webhook.worker.js");
    const handler = (webhookWorker as unknown as { _handler: (job: unknown) => Promise<void> })._handler;

    await handler({ data: { endpointId: "ep-1", payload: {} } });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends POST to webhook URL and logs successful delivery", async () => {
    mockPrisma.webhookEndpoint.findUnique.mockResolvedValue({
      id: "ep-1",
      url: "https://example.com/hook",
      secret: "s3cret",
      enabled: true
    });
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    const { webhookWorker } = await import("./webhook.worker.js");
    const handler = (webhookWorker as unknown as { _handler: (job: unknown) => Promise<void> })._handler;

    await handler({ data: { endpointId: "ep-1", payload: { event: "task.created", taskId: "t-1" } } });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-corelia-signature": "s3cret" })
      })
    );
    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: true, statusCode: 200 })
      })
    );
  });

  it("logs failed delivery when endpoint returns non-2xx", async () => {
    mockPrisma.webhookEndpoint.findUnique.mockResolvedValue({
      id: "ep-2",
      url: "https://example.com/hook",
      secret: "s3cret",
      enabled: true
    });
    mockFetch.mockResolvedValue({ status: 503, ok: false });
    const { webhookWorker } = await import("./webhook.worker.js");
    const handler = (webhookWorker as unknown as { _handler: (job: unknown) => Promise<void> })._handler;

    await handler({ data: { endpointId: "ep-2", payload: {} } });

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false, statusCode: 503 })
      })
    );
  });

  it("logs failed delivery when fetch throws a network error", async () => {
    mockPrisma.webhookEndpoint.findUnique.mockResolvedValue({
      id: "ep-3",
      url: "https://example.com/hook",
      secret: "s3cret",
      enabled: true
    });
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const { webhookWorker } = await import("./webhook.worker.js");
    const handler = (webhookWorker as unknown as { _handler: (job: unknown) => Promise<void> })._handler;

    await handler({ data: { endpointId: "ep-3", payload: {} } });

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false, statusCode: null })
      })
    );
  });
});
