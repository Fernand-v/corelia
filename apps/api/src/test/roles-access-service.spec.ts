import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminRolesAccessService } from "../modules/admin/services/roles-access.js";

const now = new Date("2026-06-27T00:00:00.000Z");

const buildPermissionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "perm-1",
  code: 99,
  key: "REPORTE_EXPORTAR",
  displayName: "Exportar reportes",
  description: null,
  categoryId: "cat-1",
  programId: "prog-1",
  resourceId: "res-1",
  actionId: "act-1",
  isSystem: false,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  category: { id: "cat-1", key: "REPORTE", displayName: "Reportes", sortOrder: 0 },
  program: { id: "prog-1", key: "REPORTES", displayName: "Reportes", sortOrder: 0 },
  resource: { id: "res-1", key: "REPORTE", displayName: "Reportes", sortOrder: 0 },
  action: { id: "act-1", key: "EXPORTAR", displayName: "Exportar", kind: "write", sortOrder: 5 },
  ...overrides
});

const buildApp = () => {
  const app = {
    redis: { incr: vi.fn().mockResolvedValue(1) },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ baseRole: { key: "ADMINISTRADOR", code: "ADMINISTRADOR" } })
      },
      role: { findUnique: vi.fn().mockResolvedValue({ id: "role-admin" }) },
      programRole: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      permissionCategory: { findUnique: vi.fn().mockResolvedValue({ id: "cat-1" }) },
      program: { findUnique: vi.fn().mockResolvedValue({ id: "prog-1", isActive: true }) },
      resource: {
        findUnique: vi.fn().mockResolvedValue({ id: "res-1", isActive: true }),
        create: vi.fn().mockResolvedValue({
          id: "res-new",
          code: 50,
          key: "FACTURAS",
          displayName: "Facturas",
          description: null,
          sortOrder: 0,
          isSystem: false,
          isActive: true,
          createdAt: now,
          updatedAt: now
        })
      },
      action: { findUnique: vi.fn().mockResolvedValue({ id: "act-1", isActive: true }) },
      permission: { create: vi.fn().mockResolvedValue(buildPermissionRow()) }
    }
  };
  return app;
};

const buildService = (app: ReturnType<typeof buildApp>) =>
  new AdminRolesAccessService(app as never, {} as never);

describe("AdminRolesAccessService — recurso × acción normalizado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea un recurso normalizando el código desde el nombre", async () => {
    const app = buildApp();
    const service = buildService(app);

    const created = await service.createResource("admin-1", { displayName: "Facturas" });

    expect(app.prisma.resource.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: "FACTURAS", isSystem: false }) })
    );
    expect(created.code).toBe("FACTURAS");
  });

  it("crea un permiso resolviendo recurso y acción a su FK y derivando la key", async () => {
    const app = buildApp();
    const service = buildService(app);

    const created = await service.createPermission("admin-1", {
      resource: "REPORTE",
      action: "EXPORTAR",
      displayName: "Exportar reportes",
      categoryCode: "REPORTE",
      programCode: "REPORTES"
    });

    expect(app.prisma.permission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: "REPORTE_EXPORTAR",
          resourceId: "res-1",
          actionId: "act-1"
        })
      })
    );
    expect(created.resource).toBe("REPORTE");
    expect(created.action).toBe("EXPORTAR");
  });

  it("rechaza crear un permiso si el recurso no existe o está inactivo", async () => {
    const app = buildApp();
    app.prisma.resource.findUnique = vi.fn().mockResolvedValue(null);
    const service = buildService(app);

    await expect(
      service.createPermission("admin-1", {
        resource: "INEXISTENTE",
        action: "EXPORTAR",
        displayName: "x",
        categoryCode: "REPORTE",
        programCode: "REPORTES"
      })
    ).rejects.toThrow(/Recurso no encontrado/);

    expect(app.prisma.permission.create).not.toHaveBeenCalled();
  });
});
