import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { roleCodeSchema } from "./rbac.js";

const reportDateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportsExecutiveQuerySchema = z
  .object({
    from: timestampSchema.optional(),
    to: timestampSchema.optional(),
    projectId: idSchema.optional(),
    teamId: idSchema.optional()
  })
  .superRefine((input, ctx) => {
    if (!input.from || !input.to) {
      return;
    }
    if (new Date(input.to).getTime() < new Date(input.from).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rango inválido: 'to' debe ser mayor o igual a 'from'",
        path: ["to"]
      });
    }
  });

export const reportsScopeItemSchema = z.object({
  id: idSchema,
  name: z.string().min(1)
});

export const reportsRangeSchema = z.object({
  from: timestampSchema,
  to: timestampSchema
});

export const reportsScopeSchema = z.object({
  projectFilter: idSchema.nullable(),
  teamFilter: idSchema.nullable(),
  projectIds: z.array(idSchema),
  teamIds: z.array(idSchema),
  projects: z.array(reportsScopeItemSchema),
  teams: z.array(reportsScopeItemSchema)
});

export const reportsProductivityBlockSchema = z.object({
  tasksCreated: z.number().int().min(0),
  tasksCompleted: z.number().int().min(0),
  completionRate: z.number().min(0).max(100),
  avgCycleHours: z.number().min(0),
  totalLoggedMinutes: z.number().int().min(0)
});

export const reportsSlaBlockSchema = z.object({
  evaluated: z.number().int().min(0),
  onTime: z.number().int().min(0),
  breached: z.number().int().min(0),
  slaPct: z.number().min(0).max(100)
});

export const reportsWorkloadByUserSchema = z.object({
  userId: idSchema,
  fullName: z.string().min(1),
  teamId: idSchema.nullable(),
  teamName: z.string().nullable(),
  activeTasksNow: z.number().int().min(0),
  capacitySlots: z.number().int().min(0),
  loadPct: z.number().min(0),
  overloaded: z.boolean()
});

export const reportsWorkloadByTeamSchema = z.object({
  teamId: idSchema,
  teamName: z.string().min(1),
  activeTasksNow: z.number().int().min(0),
  capacitySlots: z.number().int().min(0),
  loadPct: z.number().min(0),
  overloadedCount: z.number().int().min(0)
});

export const reportsWorkloadBlockSchema = z.object({
  activeTasksNow: z.number().int().min(0),
  capacitySlots: z.number().int().min(0),
  loadPct: z.number().min(0),
  overloadedCount: z.number().int().min(0),
  byUser: z.array(reportsWorkloadByUserSchema),
  byTeam: z.array(reportsWorkloadByTeamSchema)
});

export const reportsProgressByClientItemSchema = z.object({
  projectId: idSchema,
  projectName: z.string().min(1),
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  completionPct: z.number().min(0).max(100),
  overdueOpenTasks: z.number().int().min(0),
  slaPct: z.number().min(0).max(100)
});

export const reportsDailySeriesItemSchema = z.object({
  date: reportDateKeySchema,
  created: z.number().int().min(0),
  completed: z.number().int().min(0),
  due: z.number().int().min(0),
  slaOnTime: z.number().int().min(0),
  slaBreached: z.number().int().min(0),
  loggedMinutes: z.number().int().min(0)
});

export const reportsSeriesBlockSchema = z.object({
  daily: z.array(reportsDailySeriesItemSchema)
});

export const reportsBudgetByProjectItemSchema = z.object({
  projectId: idSchema,
  projectName: z.string().min(1),
  totalEstimated: z.number().min(0),
  totalApproved: z.number().min(0),
  totalPending: z.number().min(0),
  totalRemaining: z.number(),
  executionPct: z.number().min(0)
});

export const reportsBudgetBlockSchema = z.object({
  totalEstimated: z.number().min(0),
  totalApproved: z.number().min(0),
  totalPending: z.number().min(0),
  totalRemaining: z.number(),
  byProject: z.array(reportsBudgetByProjectItemSchema)
});

export const reportsExecutiveResponseSchema = z.object({
  generatedAt: timestampSchema,
  role: roleCodeSchema,
  range: reportsRangeSchema,
  scope: reportsScopeSchema,
  blocks: z.object({
    productivity: reportsProductivityBlockSchema,
    sla: reportsSlaBlockSchema,
    workload: reportsWorkloadBlockSchema,
    progressByClient: z.array(reportsProgressByClientItemSchema),
    series: reportsSeriesBlockSchema,
    budget: reportsBudgetBlockSchema.optional()
  })
});

export type ReportsExecutiveQuery = z.infer<typeof reportsExecutiveQuerySchema>;
export type ReportsExecutiveResponse = z.infer<typeof reportsExecutiveResponseSchema>;
