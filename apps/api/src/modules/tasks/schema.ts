import {
  codeValueSchema,
  createTaskInputSchema,
  taskDependencyInputSchema,
  taskReassignmentInputSchema,
  taskStatusTransitionInputSchema
} from "@corelia/types";
import { z } from "zod";

const updateTaskScheduleInputSchema = z
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

const finalizeAndAdvanceInputSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().min(3).max(500).optional(),
  reasonCatalogId: codeValueSchema.optional()
});

const activateTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().min(3).max(500),
  reasonCatalogId: codeValueSchema.optional()
});

export const taskSchemas = {
  taskListQuerySchema: z
    .object({
      projectId: z.string().uuid().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional()
    })
    .superRefine((value, ctx) => {
      if (!value.dateFrom || !value.dateTo) {
        return;
      }

      if (new Date(value.dateFrom).getTime() > new Date(value.dateTo).getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "dateFrom no puede ser mayor que dateTo"
        });
      }
    }),
  createTaskInputSchema: createTaskInputSchema.extend({
    confirmOutOfSchedule: z.boolean().optional()
  }),
  projectMembersQuerySchema: z.object({
    projectId: z.string().uuid()
  }),
  taskStatusTransitionInputSchema,
  taskReassignmentInputSchema,
  updateTaskScheduleInputSchema,
  finalizeAndAdvanceInputSchema,
  activateTaskInputSchema,
  taskDependencyInputSchema,
  taskIdParamsSchema: z.object({
    taskId: z.string().uuid()
  })
};
