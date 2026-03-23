import { describe, expect, it, vi } from "vitest";
import { AutomationService } from "../modules/automations/service.js";

const createMockApp = () =>
  ({
    prisma: {
      automationRule: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    }
  }) as unknown as ConstructorParameters<typeof AutomationService>[0];

const buildRule = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  name: "Notificar al completar",
  event: "TAREA_COMPLETADA" as const,
  action: "ENVIAR_NOTIFICACION" as const,
  config: JSON.stringify({ message: "Tarea lista" }),
  enabled: true,
  createdById: crypto.randomUUID(),
  createdAt: new Date(),
  ...overrides
});

describe("AutomationService — create", () => {
  it("crea una regla y serializa config como JSON", async () => {
    const app = createMockApp();
    const rule = buildRule();
    app.prisma.automationRule.create = vi.fn().mockResolvedValue(rule);

    const service = new AutomationService(app);
    const result = await service.create({
      projectId: rule.projectId,
      name: rule.name,
      event: rule.event,
      action: rule.action,
      config: { message: "Tarea lista" },
      enabled: true,
      createdById: rule.createdById
    });

    expect(result).toMatchObject({ id: rule.id, name: rule.name });
    expect(app.prisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: JSON.stringify({ message: "Tarea lista" })
        })
      })
    );
  });
});

describe("AutomationService — list", () => {
  it("devuelve las reglas del proyecto ordenadas por fecha", async () => {
    const app = createMockApp();
    const projectId = crypto.randomUUID();
    const rules = [buildRule({ projectId }), buildRule({ projectId })];
    app.prisma.automationRule.findMany = vi.fn().mockResolvedValue(rules);

    const service = new AutomationService(app);
    const result = await service.list(projectId);

    expect(result).toHaveLength(2);
    expect(app.prisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId } })
    );
  });
});

describe("AutomationService — getById", () => {
  it("devuelve la regla cuando existe", async () => {
    const app = createMockApp();
    const rule = buildRule();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(rule);

    const service = new AutomationService(app);
    const result = await service.getById(rule.id);

    expect(result.id).toBe(rule.id);
  });

  it("lanza NotFoundError cuando la regla no existe", async () => {
    const app = createMockApp();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(null);

    const service = new AutomationService(app);

    await expect(service.getById(crypto.randomUUID())).rejects.toThrowError(
      "Regla de automatización no encontrada"
    );
  });
});

describe("AutomationService — update", () => {
  it("actualiza nombre y evento de la regla", async () => {
    const app = createMockApp();
    const rule = buildRule();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(rule);
    app.prisma.automationRule.update = vi.fn().mockResolvedValue({ ...rule, name: "Nuevo nombre" });

    const service = new AutomationService(app);
    const updated = await service.update(rule.id, { name: "Nuevo nombre" });

    expect(updated.name).toBe("Nuevo nombre");
    expect(app.prisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: rule.id } })
    );
  });

  it("serializa config como JSON al actualizar", async () => {
    const app = createMockApp();
    const rule = buildRule();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(rule);
    app.prisma.automationRule.update = vi.fn().mockResolvedValue(rule);

    const service = new AutomationService(app);
    await service.update(rule.id, { config: { target: "assignee" } });

    expect(app.prisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ config: JSON.stringify({ target: "assignee" }) })
      })
    );
  });

  it("lanza NotFoundError si la regla no existe al actualizar", async () => {
    const app = createMockApp();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(null);

    const service = new AutomationService(app);

    await expect(service.update(crypto.randomUUID(), { name: "X" })).rejects.toThrowError(
      "Regla de automatización no encontrada"
    );
  });
});

describe("AutomationService — delete", () => {
  it("elimina la regla y devuelve confirmación", async () => {
    const app = createMockApp();
    const rule = buildRule();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(rule);
    app.prisma.automationRule.delete = vi.fn().mockResolvedValue(rule);

    const service = new AutomationService(app);
    const result = await service.delete(rule.id);

    expect(result).toEqual({ id: rule.id, deleted: true });
    expect(app.prisma.automationRule.delete).toHaveBeenCalledWith({ where: { id: rule.id } });
  });

  it("lanza NotFoundError si la regla no existe al eliminar", async () => {
    const app = createMockApp();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(null);

    const service = new AutomationService(app);

    await expect(service.delete(crypto.randomUUID())).rejects.toThrowError(
      "Regla de automatización no encontrada"
    );
  });
});

describe("AutomationService — toggle", () => {
  it("activa una regla deshabilitada", async () => {
    const app = createMockApp();
    const rule = buildRule({ enabled: false });
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(rule);
    app.prisma.automationRule.update = vi.fn().mockResolvedValue({ ...rule, enabled: true });

    const service = new AutomationService(app);
    const result = await service.toggle(rule.id, true);

    expect(result.enabled).toBe(true);
    expect(app.prisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enabled: true } })
    );
  });

  it("deshabilita una regla activa", async () => {
    const app = createMockApp();
    const rule = buildRule({ enabled: true });
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(rule);
    app.prisma.automationRule.update = vi.fn().mockResolvedValue({ ...rule, enabled: false });

    const service = new AutomationService(app);
    const result = await service.toggle(rule.id, false);

    expect(result.enabled).toBe(false);
  });

  it("lanza NotFoundError si la regla no existe al hacer toggle", async () => {
    const app = createMockApp();
    app.prisma.automationRule.findUnique = vi.fn().mockResolvedValue(null);

    const service = new AutomationService(app);

    await expect(service.toggle(crypto.randomUUID(), true)).rejects.toThrowError(
      "Regla de automatización no encontrada"
    );
  });
});
