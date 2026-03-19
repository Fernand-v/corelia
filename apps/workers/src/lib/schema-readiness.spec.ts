import { describe, expect, it, vi } from "vitest";
import { createReadinessGate } from "./schema-readiness.js";

describe("createReadinessGate", () => {
  it("shares in-flight readiness checks and caches success", async () => {
    let attempts = 0;
    const logger = { warn: vi.fn() };
    const gate = createReadinessGate({
      name: "task lifecycle scheduler",
      timeoutMs: 50,
      retryDelayMs: 0,
      logger,
      probe: async () => {
        attempts += 1;
        return attempts >= 2
          ? { ready: true }
          : { ready: false, missing: ["Task.pendingActivatedAt"] };
      }
    });

    const [first, second] = await Promise.all([gate(), gate()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(attempts).toBe(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    await expect(gate()).resolves.toBe(true);
    expect(attempts).toBe(2);
  });

  it("returns false after timing out without throwing", async () => {
    const logger = { warn: vi.fn() };
    const gate = createReadinessGate({
      name: "documents purge scheduler",
      timeoutMs: 0,
      retryDelayMs: 0,
      logger,
      probe: async () => ({
        ready: false,
        missing: ["CollaborativeDocument.purgeAt"]
      })
    });

    await expect(gate()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "[workers] waiting for documents purge scheduler; missing schema: CollaborativeDocument.purgeAt"
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[workers] skipped documents purge scheduler; schema/database not ready after 0ms"
    );
  });
});
