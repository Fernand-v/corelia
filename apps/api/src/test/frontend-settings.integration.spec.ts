import { beforeEach, describe, expect, it, vi } from "vitest";
import { frontendSettingsDefaults } from "@corelia/types";
import { StatusService } from "../modules/status/service.js";
import { AdminService } from "../modules/admin/service.js";

vi.mock("../config/env.js", () => ({
  env: {
    MINIO_USE_SSL: false,
    MINIO_ENDPOINT: "127.0.0.1",
    MINIO_PORT: 9000,
    MAINTENANCE_DEFAULT_MESSAGE: "Mantenimiento"
  }
}));

const createSettingsRow = (overrides?: Partial<{
  id: number;
  organizationName: string;
  taskStatusColorPending: string;
  taskStatusColorInReview: string;
  taskStatusColorCompleted: string;
  updatedAt: Date;
}>) => ({
  id: 1,
  organizationName: frontendSettingsDefaults.organizationName,
  taskStatusColorPending: frontendSettingsDefaults.taskStatusColors.PENDIENTE,
  taskStatusColorInReview: frontendSettingsDefaults.taskStatusColors.EN_REVISION,
  taskStatusColorCompleted: frontendSettingsDefaults.taskStatusColors.COMPLETADA,
  updatedAt: new Date("2026-03-06T00:00:00.000Z"),
  ...(overrides ?? {})
});

const createMockApp = () =>
  ({
    prisma: {
      user: {
        findUnique: vi.fn()
      },
      frontendSettings: {
        findUnique: vi.fn(),
        upsert: vi.fn()
      }
    }
  }) as unknown as ConstructorParameters<typeof StatusService>[0] &
    ConstructorParameters<typeof AdminService>[0];

describe("Frontend settings flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when settings row does not exist", async () => {
    const app = createMockApp();
    app.prisma.frontendSettings.findUnique = vi.fn().mockResolvedValue(null);

    const service = new StatusService(app);
    const result = await service.getFrontendSettings();

    expect(result.organizationName).toBe(frontendSettingsDefaults.organizationName);
    expect(result.taskStatusColors).toEqual(frontendSettingsDefaults.taskStatusColors);
  });

  it("updates frontend settings with normalized values", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ baseRole: { code: "ADMINISTRADOR" } });
    app.prisma.frontendSettings.upsert = vi.fn().mockResolvedValue(
      createSettingsRow({
        organizationName: "Corilia Labs",
        taskStatusColorPending: "#AA5500",
        taskStatusColorInReview: "#2563EB",
        taskStatusColorCompleted: "#16A34A"
      })
    );

    const service = new AdminService(app);
    const result = await service.updateFrontendSettings(actorId, {
      organizationName: "  Corilia Labs  ",
      taskStatusColors: {
        PENDIENTE: "#aa5500"
      }
    });

    expect(app.prisma.frontendSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          organizationName: "Corilia Labs",
          taskStatusColorPending: "#AA5500"
        })
      })
    );
    expect(result.organizationName).toBe("Corilia Labs");
    expect(result.taskStatusColors.PENDIENTE).toBe("#AA5500");
  });

  it("hides technical service details in public system status", async () => {
    const app = createMockApp();
    const service = new StatusService(app);
    vi.spyOn(service, "getSystemStatus").mockResolvedValue({
      now: "2026-03-09T12:00:00.000Z",
      maintenance: {
        enabled: false,
        message: null
      },
      services: [
        {
          service: "api",
          status: "up",
          detail: "internal detail"
        }
      ]
    });

    const result = await service.getPublicSystemStatus();

    expect(result.services).toEqual([
      {
        service: "api",
        status: "up",
        detail: null
      }
    ]);
  });

  it("resets settings to defaults", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ baseRole: { code: "ADMINISTRADOR" } });
    app.prisma.frontendSettings.upsert = vi.fn().mockResolvedValue(createSettingsRow());

    const service = new AdminService(app);
    const result = await service.resetFrontendSettings(actorId);

    expect(result.organizationName).toBe(frontendSettingsDefaults.organizationName);
    expect(result.taskStatusColors).toEqual(frontendSettingsDefaults.taskStatusColors);
  });

  it("rejects non-admin users when attempting to update settings", async () => {
    const app = createMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ baseRole: { code: "COLABORADOR" } });

    const service = new AdminService(app);

    await expect(
      service.updateFrontendSettings(crypto.randomUUID(), {
        organizationName: "Mi Empresa"
      })
    ).rejects.toMatchObject({
      name: "Forbidden"
    });
  });
});
