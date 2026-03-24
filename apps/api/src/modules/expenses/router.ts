import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { ExpenseService } from "./service.js";
import { expenseSchemas } from "./schema.js";

export const expensesRouter: FastifyPluginAsync = async (app) => {
  const service = new ExpenseService(app);

  // --- Project Details (Partidas presupuestarias) ---

  app.post(
    "/projects/:projectId/details",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(expenseSchemas.createProjectDetailInputSchema, request.body);
        const detail = await service.createDetail(request.authUser!.id, params.projectId, payload);

        request.auditEvent = {
          entityType: "GASTO",
          entityId: detail.id,
          action: "CREAR",
          newDataText: {
            projectId: params.projectId,
            description: detail.description,
            estimatedBudget: detail.estimatedBudget
          }
        };

        return reply.code(201).send(detail);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/projects/:projectId/details",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectIdParamsSchema, request.params);
        const details = await service.listDetails(request.authUser!.id, params.projectId);
        return reply.send(details);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/projects/:projectId/details/:detailId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectDetailIdParamsSchema, request.params);
        const payload = parseWithSchema(expenseSchemas.updateProjectDetailInputSchema, request.body);
        const detail = await service.updateDetail(
          request.authUser!.id,
          params.projectId,
          params.detailId,
          payload
        );
        return reply.send(detail);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/projects/:projectId/details/:detailId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectDetailIdParamsSchema, request.params);
        const result = await service.deleteDetail(
          request.authUser!.id,
          params.projectId,
          params.detailId
        );
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  // --- Expenses (Gastos) ---

  app.post(
    "/projects/:projectId/expenses",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(expenseSchemas.createExpenseInputSchema, request.body);
        const expense = await service.createExpense(
          request.authUser!.id,
          params.projectId,
          payload
        );

        request.auditEvent = {
          entityType: "GASTO",
          entityId: expense.id,
          action: "CREAR",
          newDataText: {
            projectId: params.projectId,
            description: expense.description,
            amount: expense.amount
          }
        };

        return reply.code(201).send(expense);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/projects/:projectId/expenses",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectIdParamsSchema, request.params);
        const query = parseWithSchema(
          expenseSchemas.projectExpensesQuerySchema,
          request.query ?? {}
        );
        const result = await service.listExpenses(
          request.authUser!.id,
          params.projectId,
          query
        );
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/projects/:projectId/expenses/:expenseId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.expenseIdParamsSchema, request.params);
        const payload = parseWithSchema(expenseSchemas.updateExpenseInputSchema, request.body);
        const expense = await service.updateExpense(
          request.authUser!.id,
          params.projectId,
          params.expenseId,
          payload
        );
        return reply.send(expense);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/projects/:projectId/expenses/:expenseId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.expenseIdParamsSchema, request.params);
        const result = await service.deleteExpense(
          request.authUser!.id,
          params.projectId,
          params.expenseId
        );
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/projects/:projectId/expenses/:expenseId/approve",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.expenseIdParamsSchema, request.params);
        const payload = parseWithSchema(expenseSchemas.approveExpenseInputSchema, request.body);
        const expense = await service.approveExpense(
          request.authUser!.id,
          params.projectId,
          params.expenseId,
          payload.status
        );

        request.auditEvent = {
          entityType: "GASTO",
          entityId: expense.id,
          action: "ACTUALIZAR",
          newDataText: {
            status: expense.status,
            approvedById: expense.approvedById
          }
        };

        return reply.send(expense);
      } catch (error) {
        throw error;
      }
    }
  );

  // --- Budget Summary ---

  app.get(
    "/projects/:projectId/budget-summary",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PRESUPUESTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(expenseSchemas.projectIdParamsSchema, request.params);
        const summary = await service.getBudgetSummary(request.authUser!.id, params.projectId);
        return reply.send(summary);
      } catch (error) {
        throw error;
      }
    }
  );
};
