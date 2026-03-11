import type { FastifyInstance } from "fastify";
import type { RoleCode, ProjectExpensesQuery } from "@corelia/types";

const budgetManagerRoles = new Set<RoleCode>([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO"
]);

export class ExpenseService {
  constructor(private readonly app: FastifyInstance) {}

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private async ensureProjectAccess(actorId: string, projectId: string) {
    const [actor, project, membership] = await Promise.all([
      this.app.prisma.user.findUnique({
        where: { id: actorId },
        select: {
          baseRole: {
            select: {
              key: true
            }
          }
        }
      }),
      this.app.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, ownerId: true, name: true }
      }),
      this.app.prisma.projectMember.findFirst({
        where: { projectId, userId: actorId },
        select: {
          role: {
            select: {
              key: true
            }
          }
        }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (actor?.baseRole.key === "ADMINISTRADOR") {
      return project;
    }

    const isOwner = project.ownerId === actorId;
    const isMember = Boolean(membership);

    if (!isOwner && !isMember) {
      throw this.forbidden("No tienes acceso a este proyecto");
    }

    return project;
  }

  private async ensureManageAccess(actorId: string, projectId: string) {
    const [actor, project, membership] = await Promise.all([
      this.app.prisma.user.findUnique({
        where: { id: actorId },
        select: {
          baseRole: {
            select: {
              key: true
            }
          }
        }
      }),
      this.app.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, ownerId: true, name: true }
      }),
      this.app.prisma.projectMember.findFirst({
        where: { projectId, userId: actorId },
        select: {
          role: {
            select: {
              key: true
            }
          }
        }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    if (actor?.baseRole.key === "ADMINISTRADOR") {
      return project;
    }

    const isOwner = project.ownerId === actorId;
    const canManage = isOwner || (membership ? budgetManagerRoles.has(membership.role.key as RoleCode) : false);

    if (!canManage) {
      throw this.forbidden("No tienes permisos para gestionar el presupuesto de este proyecto");
    }

    return project;
  }

  async createDetail(
    actorId: string,
    projectId: string,
    input: { description: string; estimatedBudget: number }
  ) {
    await this.ensureManageAccess(actorId, projectId);

    return this.app.prisma.projectDetail.create({
      data: {
        projectId,
        description: input.description,
        estimatedBudget: input.estimatedBudget,
        createdById: actorId
      }
    });
  }

  async updateDetail(
    actorId: string,
    projectId: string,
    detailId: string,
    input: { description?: string; estimatedBudget?: number }
  ) {
    const detail = await this.app.prisma.projectDetail.findUnique({
      where: { id: detailId }
    });

    if (!detail || detail.projectId !== projectId) {
      throw new Error("Partida presupuestaria no encontrada");
    }

    await this.ensureManageAccess(actorId, projectId);

    return this.app.prisma.projectDetail.update({
      where: { id: detailId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.estimatedBudget !== undefined ? { estimatedBudget: input.estimatedBudget } : {})
      }
    });
  }

  async deleteDetail(actorId: string, projectId: string, detailId: string) {
    const detail = await this.app.prisma.projectDetail.findUnique({
      where: { id: detailId },
      include: {
        expenses: {
          where: { status: "APROBADO" },
          select: { id: true }
        }
      }
    });

    if (!detail || detail.projectId !== projectId) {
      throw new Error("Partida presupuestaria no encontrada");
    }

    await this.ensureManageAccess(actorId, projectId);

    if (detail.expenses.length > 0) {
      throw new Error("No se puede eliminar una partida con gastos aprobados");
    }

    await this.app.prisma.projectDetail.delete({ where: { id: detailId } });

    return { success: true };
  }

  async listDetails(actorId: string, projectId: string) {
    await this.ensureProjectAccess(actorId, projectId);

    const details = await this.app.prisma.projectDetail.findMany({
      where: { projectId },
      include: {
        expenses: {
          select: { amount: true, status: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return details.map((detail) => {
      const approvedExpenses = detail.expenses
        .filter((e) => e.status === "APROBADO")
        .reduce((sum, e) => sum + e.amount, 0);
      const pendingExpenses = detail.expenses
        .filter((e) => e.status === "PENDIENTE")
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        id: detail.id,
        projectId: detail.projectId,
        description: detail.description,
        estimatedBudget: detail.estimatedBudget,
        approvedExpenses,
        pendingExpenses,
        createdById: detail.createdById,
        createdAt: detail.createdAt.toISOString(),
        updatedAt: detail.updatedAt.toISOString()
      };
    });
  }

  async createExpense(
    actorId: string,
    projectId: string,
    input: {
      projectDetailId: string;
      description: string;
      amount: number;
      date: string;
      receiptPath?: string;
    }
  ) {
    const detail = await this.app.prisma.projectDetail.findUnique({
      where: { id: input.projectDetailId }
    });

    if (!detail || detail.projectId !== projectId) {
      throw new Error("Partida presupuestaria no encontrada en este proyecto");
    }

    await this.ensureManageAccess(actorId, projectId);

    return this.app.prisma.expense.create({
      data: {
        projectDetailId: input.projectDetailId,
        description: input.description,
        amount: input.amount,
        date: new Date(input.date),
        receiptPath: input.receiptPath ?? null,
        createdById: actorId
      }
    });
  }

  async updateExpense(
    actorId: string,
    projectId: string,
    expenseId: string,
    input: {
      description?: string;
      amount?: number;
      date?: string;
      receiptPath?: string | null;
    }
  ) {
    const expense = await this.app.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { projectDetail: { select: { projectId: true } } }
    });

    if (!expense || expense.projectDetail.projectId !== projectId) {
      throw new Error("Gasto no encontrado en este proyecto");
    }

    if (expense.status !== "PENDIENTE") {
      throw new Error("Solo se pueden editar gastos con estado PENDIENTE");
    }

    await this.ensureManageAccess(actorId, projectId);

    return this.app.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
        ...(input.receiptPath !== undefined ? { receiptPath: input.receiptPath } : {})
      }
    });
  }

  async deleteExpense(actorId: string, projectId: string, expenseId: string) {
    const expense = await this.app.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { projectDetail: { select: { projectId: true } } }
    });

    if (!expense || expense.projectDetail.projectId !== projectId) {
      throw new Error("Gasto no encontrado en este proyecto");
    }

    if (expense.status !== "PENDIENTE") {
      throw new Error("Solo se pueden eliminar gastos con estado PENDIENTE");
    }

    await this.ensureManageAccess(actorId, projectId);

    await this.app.prisma.expense.delete({ where: { id: expenseId } });

    return { success: true };
  }

  async listExpenses(actorId: string, projectId: string, query: ProjectExpensesQuery) {
    await this.ensureProjectAccess(actorId, projectId);

    const detailIds = await this.app.prisma.projectDetail.findMany({
      where: { projectId },
      select: { id: true }
    });

    const where = {
      projectDetailId: { in: detailIds.map((d) => d.id) },
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {})
    };

    const [total, items] = await Promise.all([
      this.app.prisma.expense.count({ where }),
      this.app.prisma.expense.findMany({
        where,
        include: {
          projectDetail: { select: { description: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          approvedBy: { select: { firstName: true, lastName: true } }
        },
        orderBy: { date: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      })
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: items.map((expense) => ({
        id: expense.id,
        projectDetailId: expense.projectDetailId,
        detailDescription: expense.projectDetail.description,
        description: expense.description,
        amount: expense.amount,
        date: expense.date.toISOString(),
        receiptPath: expense.receiptPath,
        status: expense.status,
        approvedById: expense.approvedById,
        approvedByName: expense.approvedBy
          ? `${expense.approvedBy.firstName} ${expense.approvedBy.lastName}`.trim()
          : null,
        approvedAt: expense.approvedAt?.toISOString() ?? null,
        createdById: expense.createdById,
        createdByName: `${expense.createdBy.firstName} ${expense.createdBy.lastName}`.trim(),
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString()
      }))
    };
  }

  async approveExpense(
    actorId: string,
    projectId: string,
    expenseId: string,
    status: "APROBADO" | "RECHAZADO"
  ) {
    const expense = await this.app.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { projectDetail: { select: { projectId: true } } }
    });

    if (!expense || expense.projectDetail.projectId !== projectId) {
      throw new Error("Gasto no encontrado en este proyecto");
    }

    if (expense.status !== "PENDIENTE") {
      throw new Error("Solo se pueden aprobar/rechazar gastos con estado PENDIENTE");
    }

    await this.ensureManageAccess(actorId, projectId);

    return this.app.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status,
        approvedById: actorId,
        approvedAt: new Date()
      }
    });
  }

  async getBudgetSummary(actorId: string, projectId: string) {
    await this.ensureProjectAccess(actorId, projectId);

    const details = await this.app.prisma.projectDetail.findMany({
      where: { projectId },
      include: {
        expenses: {
          select: { amount: true, status: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    let totalEstimated = 0;
    let totalApproved = 0;
    let totalPending = 0;

    const detailItems = details.map((detail) => {
      const approved = detail.expenses
        .filter((e) => e.status === "APROBADO")
        .reduce((sum, e) => sum + e.amount, 0);
      const pending = detail.expenses
        .filter((e) => e.status === "PENDIENTE")
        .reduce((sum, e) => sum + e.amount, 0);

      totalEstimated += detail.estimatedBudget;
      totalApproved += approved;
      totalPending += pending;

      return {
        detailId: detail.id,
        description: detail.description,
        estimatedBudget: detail.estimatedBudget,
        approvedExpenses: approved,
        pendingExpenses: pending
      };
    });

    const totalRemaining = totalEstimated - totalApproved;
    const executionPct =
      totalEstimated > 0 ? Math.round((totalApproved / totalEstimated) * 10000) / 100 : 0;

    return {
      projectId,
      totalEstimated,
      totalApproved,
      totalPending,
      totalRemaining,
      executionPct,
      details: detailItems
    };
  }
}
