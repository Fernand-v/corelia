import { describe, expect, it, vi } from "vitest";
import { TaskOperationsService } from "../modules/tasks/task-operations-service.js";

type App = ConstructorParameters<typeof TaskOperationsService>[0];

describe("TaskOperationsService", () => {
  it("no-ops enqueue when queues are unavailable", async () => {
    const app = { queues: undefined } as unknown as App;
    const service = new TaskOperationsService(app);

    await expect(service.enqueueWebhooks("TAREA_COMPLETADA", { taskId: "t-1" })).resolves.toBeUndefined();
    await expect(
      service.enqueueAutomation("p-1", "TAREA_COMPLETADA", { taskId: "t-1" })
    ).resolves.toBeUndefined();
  });

  it("enqueues a webhook job per enabled endpoint", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const app = {
      queues: { webhooks: { add } },
      prisma: {
        webhookEndpoint: {
          findMany: vi.fn().mockResolvedValue([{ id: "e-1" }, { id: "e-2" }])
        }
      }
    } as unknown as App;
    const service = new TaskOperationsService(app);

    await service.enqueueWebhooks("TAREA_COMPLETADA", { taskId: "t-1" });

    expect(add).toHaveBeenCalledTimes(2);
  });
});
