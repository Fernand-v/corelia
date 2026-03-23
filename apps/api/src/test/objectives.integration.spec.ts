import { describe, expect, it, vi } from "vitest";
import { ObjectiveService } from "../modules/objectives/service.js";

const createMockApp = () =>
  ({
    prisma: {
      objective: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([])
      },
      objectiveTask: {
        create: vi.fn()
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([])
      }
    }
  }) as unknown as ConstructorParameters<typeof ObjectiveService>[0];

describe("ObjectiveService — create", () => {
  it("crea un objetivo de equipo con fecha y progreso iniciales", async () => {
    const app = createMockApp();
    const ownerId = crypto.randomUUID();
    const teamId = crypto.randomUUID();
    const created = {
      id: crypto.randomUUID(),
      scope: "EQUIPO",
      teamId,
      projectId: null,
      title: "Mejorar cobertura",
      description: "Llegar al 80% de cobertura",
      descriptionCatalogId: "LEGACY_UNMAPPED",
      ownerId,
      targetDate: new Date("2026-06-30"),
      progressPct: 0
    };
    app.prisma.objective.create = vi.fn().mockResolvedValue(created);

    const service = new ObjectiveService(app);
    const result = await service.create({
      scope: "EQUIPO",
      teamId,
      title: "Mejorar cobertura",
      description: "Llegar al 80% de cobertura",
      ownerId,
      targetDate: "2026-06-30T00:00:00.000Z",
      progressPct: 0
    });

    expect(result).toMatchObject({ scope: "EQUIPO", teamId, progressPct: 0 });
    expect(app.prisma.objective.create).toHaveBeenCalledTimes(1);
  });

  it("usa descriptionCatalogId cuando se proporciona un código", async () => {
    const app = createMockApp();
    app.prisma.objective.create = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new ObjectiveService(app);
    await service.create({
      scope: "PROYECTO",
      title: "Objetivo con código",
      description: "Descripción",
      descriptionCatalogId: "OBJ-001",
      ownerId: crypto.randomUUID(),
      targetDate: "2026-12-31T00:00:00.000Z",
      progressPct: 10
    });

    expect(app.prisma.objective.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ descriptionCatalogId: "OBJ-001" })
      })
    );
  });

  it("convierte targetDate a objeto Date al persistir", async () => {
    const app = createMockApp();
    app.prisma.objective.create = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new ObjectiveService(app);
    await service.create({
      scope: "EQUIPO",
      title: "Test fecha",
      ownerId: crypto.randomUUID(),
      targetDate: "2026-09-15T00:00:00.000Z",
      progressPct: 0
    });

    expect(app.prisma.objective.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetDate: new Date("2026-09-15T00:00:00.000Z") })
      })
    );
  });
});

describe("ObjectiveService — updateProgress", () => {
  it("actualiza el porcentaje de progreso del objetivo", async () => {
    const app = createMockApp();
    const objectiveId = crypto.randomUUID();
    app.prisma.objective.update = vi.fn().mockResolvedValue({ id: objectiveId, progressPct: 75 });

    const service = new ObjectiveService(app);
    const result = await service.updateProgress(objectiveId, 75);

    expect(result.progressPct).toBe(75);
    expect(app.prisma.objective.update).toHaveBeenCalledWith({
      where: { id: objectiveId },
      data: { progressPct: 75 }
    });
  });
});

describe("ObjectiveService — linkTask", () => {
  it("vincula una tarea a un objetivo", async () => {
    const app = createMockApp();
    const objectiveId = crypto.randomUUID();
    const taskId = crypto.randomUUID();
    const link = { id: crypto.randomUUID(), objectiveId, taskId };
    app.prisma.objectiveTask.create = vi.fn().mockResolvedValue(link);

    const service = new ObjectiveService(app);
    const result = await service.linkTask(objectiveId, taskId);

    expect(result).toMatchObject({ objectiveId, taskId });
    expect(app.prisma.objectiveTask.create).toHaveBeenCalledWith({
      data: { objectiveId, taskId }
    });
  });
});

describe("ObjectiveService — listForUser", () => {
  it("devuelve objetivos del usuario incluyendo los de sus equipos", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const teamId = crypto.randomUUID();

    app.prisma.teamMember.findMany = vi.fn().mockResolvedValue([{ teamId }]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([
      { id: crypto.randomUUID(), scope: "EQUIPO", teamId, ownerId: userId, tasks: [] }
    ]);

    const service = new ObjectiveService(app);
    const result = await service.listForUser(userId);

    expect(result).toHaveLength(1);
    expect(app.prisma.teamMember.findMany).toHaveBeenCalledWith({
      where: { userId },
      select: { teamId: true }
    });
  });

  it("devuelve lista vacía cuando el usuario no tiene objetivos", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();

    app.prisma.teamMember.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([]);

    const service = new ObjectiveService(app);
    const result = await service.listForUser(userId);

    expect(result).toHaveLength(0);
  });
});
