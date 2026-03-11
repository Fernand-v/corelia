import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { expenseStatusSchema } from "./enums.js";

export const projectDetailSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  description: z.string().min(1).max(500),
  estimatedBudget: z.number().min(0),
  createdById: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const expenseSchema = z.object({
  id: idSchema,
  projectDetailId: idSchema,
  description: z.string().min(1).max(500),
  amount: z.number().min(0),
  date: timestampSchema,
  receiptPath: z.string().nullable().optional(),
  status: expenseStatusSchema,
  approvedById: idSchema.nullable().optional(),
  approvedAt: timestampSchema.nullable().optional(),
  createdById: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createProjectDetailInputSchema = z.object({
  description: z.string().min(1).max(500),
  estimatedBudget: z.number().min(0)
});

export const updateProjectDetailInputSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  estimatedBudget: z.number().min(0).optional()
});

export const createExpenseInputSchema = z.object({
  projectDetailId: idSchema,
  description: z.string().min(1).max(500),
  amount: z.number().min(0),
  date: timestampSchema,
  receiptPath: z.string().optional()
});

export const updateExpenseInputSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z.number().min(0).optional(),
  date: timestampSchema.optional(),
  receiptPath: z.string().nullable().optional()
});

export const approveExpenseInputSchema = z.object({
  status: z.enum(["APROBADO", "RECHAZADO"])
});

export const projectDetailIdParamsSchema = z.object({
  projectId: idSchema,
  detailId: idSchema
});

export const expenseIdParamsSchema = z.object({
  projectId: idSchema,
  expenseId: idSchema
});

export const projectExpensesQuerySchema = z.object({
  status: expenseStatusSchema.optional(),
  from: timestampSchema.optional(),
  to: timestampSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const budgetDetailItemSchema = z.object({
  detailId: idSchema,
  description: z.string(),
  estimatedBudget: z.number(),
  approvedExpenses: z.number(),
  pendingExpenses: z.number()
});

export const budgetSummarySchema = z.object({
  projectId: idSchema,
  totalEstimated: z.number(),
  totalApproved: z.number(),
  totalPending: z.number(),
  totalRemaining: z.number(),
  executionPct: z.number(),
  details: z.array(budgetDetailItemSchema)
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type BudgetSummary = z.infer<typeof budgetSummarySchema>;
export type ProjectExpensesQuery = z.infer<typeof projectExpensesQuerySchema>;
