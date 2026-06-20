import { describe, expect, it, vi } from "vitest";
import { FormRequestsService } from "../modules/forms/form-requests-service.js";

type App = ConstructorParameters<typeof FormRequestsService>[0];

describe("FormRequestsService", () => {
  it("rejects an oversized request payload", async () => {
    const app = { prisma: { formRequest: { create: vi.fn() } } } as unknown as App;
    const service = new FormRequestsService(app);

    await expect(
      service.create({
        requesterId: "u-1",
        type: "VACACIONES",
        payload: { note: "x".repeat(11_000) }
      })
    ).rejects.toThrow(/tamaño máximo/);
  });

  it("creates a request with a serialized payload", async () => {
    const create = vi.fn().mockResolvedValue({ id: "fr-1" });
    const app = { prisma: { formRequest: { create } } } as unknown as App;
    const service = new FormRequestsService(app);

    await service.create({ requesterId: "u-1", type: "PERMISO", payload: { reason: "cita" } });

    expect(create).toHaveBeenCalledWith({
      data: { requesterId: "u-1", type: "PERMISO", payload: JSON.stringify({ reason: "cita" }) }
    });
  });
});
