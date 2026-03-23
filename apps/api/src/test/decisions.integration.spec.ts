import { describe, expect, it, vi } from "vitest";
import { DecisionService } from "../modules/decisions/service.js";

const createMockApp = () =>
  ({
    prisma: {
      decisionNote: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([])
      }
    }
  }) as unknown as ConstructorParameters<typeof DecisionService>[0];

const buildDecisionNote = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  title: "Decisión de arquitectura",
  description: "Usar microservicios",
  descriptionCatalogId: "LEGACY_UNMAPPED",
  authorId: crypto.randomUUID(),
  createdAt: new Date(),
  linkedUserId: null,
  linkedProjectId: crypto.randomUUID(),
  linkedTaskId: null,
  linkedMeetingId: null,
  linkedMeetingAgreementId: null,
  linkedMessageId: null,
  linkedFileId: null,
  linkedFormRequestId: null,
  linkedAnnouncementId: null,
  linkedObjectiveId: null,
  linkedDecisionId: null,
  linkedAutomationRuleId: null,
  linkedExpenseId: null,
  ...overrides
});

describe("DecisionService — create", () => {
  it("crea una nota de decisión vinculada a un proyecto", async () => {
    const app = createMockApp();
    const projectId = crypto.randomUUID();
    const note = buildDecisionNote({ linkedProjectId: projectId });
    app.prisma.decisionNote.create = vi.fn().mockResolvedValue(note);

    const service = new DecisionService(app);
    const result = await service.create({
      title: "Decisión de arquitectura",
      description: "Usar microservicios",
      linkedEntityType: "PROYECTO",
      linkedEntityId: projectId,
      authorId: note.authorId
    });

    expect(result).toHaveProperty("linkedEntityType", "PROYECTO");
    expect(result).toHaveProperty("linkedEntityId", projectId);
    expect(app.prisma.decisionNote.create).toHaveBeenCalledTimes(1);
  });

  it("usa descriptionCatalogId cuando se proporciona un código válido", async () => {
    const app = createMockApp();
    const projectId = crypto.randomUUID();
    const note = buildDecisionNote({ linkedProjectId: projectId, descriptionCatalogId: "DEC-001" });
    app.prisma.decisionNote.create = vi.fn().mockResolvedValue(note);

    const service = new DecisionService(app);
    await service.create({
      title: "Con código",
      description: "Descripción",
      descriptionCatalogId: "DEC-001",
      linkedEntityType: "PROYECTO",
      linkedEntityId: projectId,
      authorId: crypto.randomUUID()
    });

    expect(app.prisma.decisionNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ descriptionCatalogId: "DEC-001" })
      })
    );
  });

  it("usa LEGACY_UNMAPPED cuando solo se proporciona descripción sin código", async () => {
    const app = createMockApp();
    const projectId = crypto.randomUUID();
    const note = buildDecisionNote({ linkedProjectId: projectId });
    app.prisma.decisionNote.create = vi.fn().mockResolvedValue(note);

    const service = new DecisionService(app);
    await service.create({
      title: "Sin código",
      description: "Solo texto",
      linkedEntityType: "PROYECTO",
      linkedEntityId: projectId,
      authorId: crypto.randomUUID()
    });

    expect(app.prisma.decisionNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ descriptionCatalogId: "LEGACY_UNMAPPED" })
      })
    );
  });

  it("vincula correctamente la decisión a una tarea", async () => {
    const app = createMockApp();
    const taskId = crypto.randomUUID();
    const note = buildDecisionNote({ linkedProjectId: null, linkedTaskId: taskId });
    app.prisma.decisionNote.create = vi.fn().mockResolvedValue(note);

    const service = new DecisionService(app);
    const result = await service.create({
      title: "Decisión sobre tarea",
      description: "Cambio de prioridad",
      linkedEntityType: "TAREA",
      linkedEntityId: taskId,
      authorId: crypto.randomUUID()
    });

    expect(result).toHaveProperty("linkedEntityType", "TAREA");
    expect(result).toHaveProperty("linkedEntityId", taskId);
  });
});

describe("DecisionService — list", () => {
  it("lista notas de decisión sin filtros", async () => {
    const app = createMockApp();
    const projectId = crypto.randomUUID();
    const notes = [
      buildDecisionNote({ linkedProjectId: projectId }),
      buildDecisionNote({ linkedProjectId: projectId })
    ];
    app.prisma.decisionNote.findMany = vi.fn().mockResolvedValue(notes);

    const service = new DecisionService(app);
    const result = await service.list({});

    expect(result).toHaveLength(2);
    expect(app.prisma.decisionNote.findMany).toHaveBeenCalledTimes(1);
  });

  it("lanza error cuando el tipo de entidad vinculada es inválido", async () => {
    const app = createMockApp();
    const service = new DecisionService(app);

    await expect(
      service.list({ linkedEntityType: "ENTIDAD_INVALIDA" })
    ).rejects.toThrowError("Tipo de entidad vinculada inválido");
  });

  it("filtra notas por tipo y ID de entidad", async () => {
    const app = createMockApp();
    const projectId = crypto.randomUUID();
    const notes = [buildDecisionNote({ linkedProjectId: projectId })];
    app.prisma.decisionNote.findMany = vi.fn().mockResolvedValue(notes);

    const service = new DecisionService(app);
    const result = await service.list({ linkedEntityType: "PROYECTO", linkedEntityId: projectId });

    expect(result).toHaveLength(1);
  });
});
