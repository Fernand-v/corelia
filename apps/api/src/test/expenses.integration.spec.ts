import { describe, expect, it, vi } from "vitest";
import { ExpenseService } from "../modules/expenses/service.js";

const createMockApp = () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ baseRole: "ADMINISTRADOR" })
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "project-1",
          ownerId: "actor-1",
          name: "Test Project"
        })
      },
      projectMember: {
        findFirst: vi.fn().mockResolvedValue({ role: "LIDER_PROYECTO" })
      },
      projectDetail: {
        create: vi.fn().mockResolvedValue({
          id: "detail-1",
          projectId: "project-1",
          description: "Infraestructura",
          estimatedBudget: 10000,
          createdById: "actor-1",
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        delete: vi.fn()
      },
      expense: {
        create: vi.fn().mockResolvedValue({
          id: "expense-1",
          projectDetailId: "detail-1",
          description: "Servidor AWS",
          amount: 500,
          date: new Date(),
          receiptPath: null,
          status: "PENDIENTE",
          approvedById: null,
          approvedAt: null,
          createdById: "actor-1",
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
      }
    }
  } as unknown as ConstructorParameters<typeof ExpenseService>[0];
};

describe("Expense integration flows", () => {
  it("creates a project detail (partida)", async () => {
    const app = createMockApp();
    const service = new ExpenseService(app);

    const detail = await service.createDetail("actor-1", "project-1", {
      description: "Infraestructura",
      estimatedBudget: 10000
    });

    expect(detail).toHaveProperty("id");
    expect(app.prisma.projectDetail.create).toHaveBeenCalledTimes(1);
  });

  it("updates a project detail", async () => {
    const app = createMockApp();
    app.prisma.projectDetail.findUnique = vi.fn().mockResolvedValue({
      id: "detail-1",
      projectId: "project-1"
    });
    app.prisma.projectDetail.update = vi.fn().mockResolvedValue({
      id: "detail-1",
      description: "Updated",
      estimatedBudget: 15000
    });

    const service = new ExpenseService(app);
    const detail = await service.updateDetail("actor-1", "project-1", "detail-1", {
      description: "Updated",
      estimatedBudget: 15000
    });

    expect(detail.description).toBe("Updated");
    expect(app.prisma.projectDetail.update).toHaveBeenCalledTimes(1);
  });

  it("deletes a project detail without approved expenses", async () => {
    const app = createMockApp();
    app.prisma.projectDetail.findUnique = vi.fn().mockResolvedValue({
      id: "detail-1",
      projectId: "project-1",
      expenses: []
    });

    const service = new ExpenseService(app);
    const result = await service.deleteDetail("actor-1", "project-1", "detail-1");

    expect(result.success).toBe(true);
    expect(app.prisma.projectDetail.delete).toHaveBeenCalledTimes(1);
  });

  it("rejects deleting a detail with approved expenses", async () => {
    const app = createMockApp();
    app.prisma.projectDetail.findUnique = vi.fn().mockResolvedValue({
      id: "detail-1",
      projectId: "project-1",
      expenses: [{ id: "expense-1" }]
    });

    const service = new ExpenseService(app);

    await expect(
      service.deleteDetail("actor-1", "project-1", "detail-1")
    ).rejects.toThrowError("No se puede eliminar una partida con gastos aprobados");
  });

  it("lists project details with expense sums", async () => {
    const app = createMockApp();
    app.prisma.projectDetail.findMany = vi.fn().mockResolvedValue([
      {
        id: "detail-1",
        projectId: "project-1",
        description: "Infra",
        estimatedBudget: 10000,
        createdById: "actor-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        expenses: [
          { amount: 500, status: "APROBADO" },
          { amount: 300, status: "PENDIENTE" },
          { amount: 200, status: "RECHAZADO" }
        ]
      }
    ]);

    const service = new ExpenseService(app);
    const details = await service.listDetails("actor-1", "project-1");

    expect(details).toHaveLength(1);
    expect(details[0]!.approvedExpenses).toBe(500);
    expect(details[0]!.pendingExpenses).toBe(300);
  });

  it("creates an expense with status PENDIENTE", async () => {
    const app = createMockApp();
    app.prisma.projectDetail.findUnique = vi.fn().mockResolvedValue({
      id: "detail-1",
      projectId: "project-1"
    });

    const service = new ExpenseService(app);
    const expense = await service.createExpense("actor-1", "project-1", {
      projectDetailId: "detail-1",
      description: "Servidor AWS",
      amount: 500,
      date: "2026-03-01T00:00:00.000Z"
    });

    expect(expense).toHaveProperty("id");
    expect(expense.status).toBe("PENDIENTE");
  });

  it("rejects editing a non-PENDIENTE expense", async () => {
    const app = createMockApp();
    app.prisma.expense.findUnique = vi.fn().mockResolvedValue({
      id: "expense-1",
      status: "APROBADO",
      projectDetail: { projectId: "project-1" }
    });

    const service = new ExpenseService(app);

    await expect(
      service.updateExpense("actor-1", "project-1", "expense-1", { description: "Changed" })
    ).rejects.toThrowError("Solo se pueden editar gastos con estado PENDIENTE");
  });

  it("rejects deleting a non-PENDIENTE expense", async () => {
    const app = createMockApp();
    app.prisma.expense.findUnique = vi.fn().mockResolvedValue({
      id: "expense-1",
      status: "APROBADO",
      projectDetail: { projectId: "project-1" }
    });

    const service = new ExpenseService(app);

    await expect(
      service.deleteExpense("actor-1", "project-1", "expense-1")
    ).rejects.toThrowError("Solo se pueden eliminar gastos con estado PENDIENTE");
  });

  it("approves a PENDIENTE expense", async () => {
    const app = createMockApp();
    app.prisma.expense.findUnique = vi.fn().mockResolvedValue({
      id: "expense-1",
      status: "PENDIENTE",
      projectDetail: { projectId: "project-1" }
    });
    app.prisma.expense.update = vi.fn().mockResolvedValue({
      id: "expense-1",
      status: "APROBADO",
      approvedById: "actor-1",
      approvedAt: new Date()
    });

    const service = new ExpenseService(app);
    const expense = await service.approveExpense("actor-1", "project-1", "expense-1", "APROBADO");

    expect(expense.status).toBe("APROBADO");
    expect(app.prisma.expense.update).toHaveBeenCalledTimes(1);
  });

  it("rejects approving a non-PENDIENTE expense", async () => {
    const app = createMockApp();
    app.prisma.expense.findUnique = vi.fn().mockResolvedValue({
      id: "expense-1",
      status: "APROBADO",
      projectDetail: { projectId: "project-1" }
    });

    const service = new ExpenseService(app);

    await expect(
      service.approveExpense("actor-1", "project-1", "expense-1", "RECHAZADO")
    ).rejects.toThrowError("Solo se pueden aprobar/rechazar gastos con estado PENDIENTE");
  });

  it("computes budget summary correctly", async () => {
    const app = createMockApp();
    app.prisma.projectDetail.findMany = vi.fn().mockResolvedValue([
      {
        id: "detail-1",
        description: "Infra",
        estimatedBudget: 10000,
        expenses: [
          { amount: 3000, status: "APROBADO" },
          { amount: 1000, status: "PENDIENTE" },
          { amount: 500, status: "RECHAZADO" }
        ]
      },
      {
        id: "detail-2",
        description: "Personal",
        estimatedBudget: 5000,
        expenses: [
          { amount: 2000, status: "APROBADO" }
        ]
      }
    ]);

    const service = new ExpenseService(app);
    const summary = await service.getBudgetSummary("actor-1", "project-1");

    expect(summary.totalEstimated).toBe(15000);
    expect(summary.totalApproved).toBe(5000);
    expect(summary.totalPending).toBe(1000);
    expect(summary.totalRemaining).toBe(10000);
    expect(summary.executionPct).toBeCloseTo(33.33, 1);
    expect(summary.details).toHaveLength(2);
  });

  it("denies access to non-member without admin role", async () => {
    const app = createMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ baseRole: "COLABORADOR" });
    app.prisma.project.findUnique = vi.fn().mockResolvedValue({
      id: "project-1",
      ownerId: "other-user",
      name: "Test"
    });
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue(null);

    const service = new ExpenseService(app);

    await expect(
      service.listDetails("actor-1", "project-1")
    ).rejects.toThrowError("No tienes acceso a este proyecto");
  });

  it("denies manage access to COLABORADOR role", async () => {
    const app = createMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ baseRole: "COLABORADOR" });
    app.prisma.project.findUnique = vi.fn().mockResolvedValue({
      id: "project-1",
      ownerId: "other-user",
      name: "Test"
    });
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({ role: "COLABORADOR" });

    const service = new ExpenseService(app);

    await expect(
      service.createDetail("actor-1", "project-1", {
        description: "Test",
        estimatedBudget: 1000
      })
    ).rejects.toThrowError("No tienes permisos para gestionar el presupuesto de este proyecto");
  });
});
