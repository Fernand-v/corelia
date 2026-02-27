import {
  createTaskInputSchema,
  taskDependencyInputSchema,
  taskReassignmentInputSchema,
  taskStatusTransitionInputSchema
} from "@corelia/types";
import { z } from "zod";

export const taskSchemas = {
  createTaskInputSchema: createTaskInputSchema.extend({
    confirmOutOfSchedule: z.boolean().optional()
  }),
  projectMembersQuerySchema: z.object({
    projectId: z.string().uuid()
  }),
  taskStatusTransitionInputSchema,
  taskReassignmentInputSchema,
  taskDependencyInputSchema,
  taskIdParamsSchema: z.object({
    taskId: z.string().uuid()
  })
};
