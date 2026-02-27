import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { systemRoleSchema, taskStatusSchema } from "./enums.js";

export const taskSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(4000).nullable(),
  assigneeId: idSchema.nullable(),
  status: taskStatusSchema,
  dueDate: z.string().datetime().nullable(),
  blockedReason: z.string().max(500).nullable(),
  blockingTaskId: idSchema.nullable(),
  createdById: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createTaskInputSchema = z.object({
  projectId: idSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: idSchema.optional(),
  dueDate: z.string().datetime().optional(),
  status: taskStatusSchema.default("BACKLOG")
});

export const taskStatusTransitionInputSchema = z
  .object({
    taskId: idSchema,
    status: taskStatusSchema,
    reason: z.string().min(3).max(500),
    blockingTaskId: idSchema.optional(),
    blockedReason: z.string().min(5).max(500).optional()
  })
  .superRefine((input, ctx) => {
    if (input.status === "BLOQUEADA") {
      if (!input.blockingTaskId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bloquear tarea requiere task bloqueante"
        });
      }
      if (!input.blockedReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bloquear tarea requiere causa"
        });
      }
    }
  });

export const taskReassignmentInputSchema = z.object({
  taskId: idSchema,
  newAssigneeId: idSchema,
  reason: z.string().min(5).max(500),
  reopenIfCompleted: z.boolean().default(false)
});

export const taskDependencyInputSchema = z.object({
  taskId: idSchema,
  dependsOnTaskId: idSchema
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
  role: systemRoleSchema
});

export type Task = z.infer<typeof taskSchema>;
export type TaskStatusTransitionInput = z.infer<typeof taskStatusTransitionInputSchema>;
export type TaskReassignmentInput = z.infer<typeof taskReassignmentInputSchema>;
export type TaskProjectMemberAvailability = z.infer<typeof taskProjectMemberAvailabilitySchema>;
