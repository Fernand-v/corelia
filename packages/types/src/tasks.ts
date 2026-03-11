import { z } from "zod";
import { codeValueSchema, idSchema, timestampSchema } from "./common.js";
import { taskStatusSchema } from "./enums.js";
import { roleCodeSchema } from "./rbac.js";

export const taskSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  stageId: idSchema.nullable().optional(),
  stageCode: z.string().regex(/^([A-Z0-9_]{3,50}|\d+)$/).nullable().optional(),
  stageName: z.string().nullable().optional(),
  stageColor: z.string().nullable().optional(),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).nullable(),
  descriptionCatalogId: codeValueSchema.nullable().optional(),
  descriptionLabel: z.string().nullable().optional(),
  assigneeId: idSchema.nullable(),
  assigneeName: z.string().nullable().optional(),
  pendingActivatedAt: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable(),
  status: taskStatusSchema,
  dueDate: z.string().datetime().nullable(),
  blockedReason: z.string().max(500).nullable(),
  blockedReasonCatalogId: codeValueSchema.nullable().optional(),
  blockedReasonLabel: z.string().nullable().optional(),
  blockingTaskId: idSchema.nullable(),
  createdById: idSchema,
  createdByName: z.string().nullable().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createTaskInputSchema = z.object({
  projectId: idSchema,
  stageId: idSchema.optional(),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  descriptionCatalogId: codeValueSchema.optional(),
  assigneeId: idSchema.optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  status: taskStatusSchema.default("PENDIENTE")
});

export const taskStatusTransitionInputSchema = z.object({
  taskId: idSchema,
  status: taskStatusSchema,
  reason: z.string().min(3).max(500),
  reasonCatalogId: codeValueSchema.optional(),
  blockingTaskId: idSchema.optional(),
  blockedReason: z.string().min(5).max(500).optional(),
  blockedReasonCatalogId: codeValueSchema.optional()
});

export const taskReassignmentInputSchema = z.object({
  taskId: idSchema,
  newAssigneeId: idSchema,
  reason: z.string().min(5).max(500),
  reasonCatalogId: codeValueSchema.optional(),
  reopenIfCompleted: z.boolean().default(false)
});

export const taskDependencyInputSchema = z.object({
  taskId: idSchema,
  dependsOnTaskId: idSchema
});

export const updateTaskScheduleInputSchema = z
  .object({
    startDate: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    reason: z.string().min(3).max(500),
    reasonCatalogId: codeValueSchema.optional()
  })
  .superRefine((input, ctx) => {
    if (!input.startDate || !input.dueDate) {
      return;
    }

    if (new Date(input.startDate).getTime() > new Date(input.dueDate).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha desde no puede ser mayor que la fecha hasta",
        path: ["dueDate"]
      });
    }
  });

export const finalizeAndAdvanceInputSchema = z.object({
  taskId: idSchema,
  reason: z.string().min(3).max(500).optional(),
  reasonCatalogId: codeValueSchema.optional()
});

export const activateTaskInputSchema = z.object({
  taskId: idSchema,
  reason: z.string().min(3).max(500),
  reasonCatalogId: codeValueSchema.optional()
});

export const taskScheduleHistoryItemSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  previousStartDate: z.string().datetime().nullable(),
  previousDueDate: z.string().datetime().nullable(),
  newStartDate: z.string().datetime().nullable(),
  newDueDate: z.string().datetime().nullable(),
  reason: z.string().min(1),
  reasonCatalogId: codeValueSchema.nullable().optional(),
  reasonLabel: z.string().nullable().optional(),
  changedById: idSchema,
  changedByName: z.string().nullable().optional(),
  changedAt: timestampSchema
});

export const taskFinalizeAndAdvanceResultSchema = z.object({
  completedTask: taskSchema,
  nextTask: taskSchema.nullable(),
  notificationsSent: z.number().int().min(0)
});

export const taskStartValidationResultSchema = z.object({
  canStart: z.boolean(),
  unresolvedDependencies: z.array(idSchema),
  message: z.string().min(3)
});

export const taskProjectMemberAvailabilitySchema = z.object({
  userId: idSchema,
  fullName: z.string().min(1),
  initials: z.string().min(1).max(2),
  availability: z.enum(["DISPONIBLE", "OCUPADO", "EN_REUNION", "AUSENTE"]),
  activeTasks: z.number().int().min(0),
  maxActiveTasks: z.number().int().positive(),
  overloaded: z.boolean(),
  role: roleCodeSchema
});

export type Task = z.infer<typeof taskSchema>;
export type TaskStatusTransitionInput = z.infer<typeof taskStatusTransitionInputSchema>;
export type TaskReassignmentInput = z.infer<typeof taskReassignmentInputSchema>;
export type TaskProjectMemberAvailability = z.infer<typeof taskProjectMemberAvailabilitySchema>;
export type UpdateTaskScheduleInput = z.infer<typeof updateTaskScheduleInputSchema>;
export type FinalizeAndAdvanceInput = z.infer<typeof finalizeAndAdvanceInputSchema>;
export type TaskFinalizeAndAdvanceResult = z.infer<typeof taskFinalizeAndAdvanceResultSchema>;
export type ActivateTaskInput = z.infer<typeof activateTaskInputSchema>;
export type TaskScheduleHistoryItem = z.infer<typeof taskScheduleHistoryItemSchema>;
