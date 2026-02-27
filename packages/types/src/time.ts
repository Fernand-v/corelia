import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const timeEntrySchema = z.object({
  id: idSchema,
  userId: idSchema,
  taskId: idSchema,
  minutes: z.number().int().positive(),
  note: z.string().max(500).nullable(),
  loggedAt: timestampSchema
});

export const createTimeEntryInputSchema = z.object({
  taskId: idSchema,
  minutes: z.number().int().positive().max(720),
  note: z.string().max(500).optional()
});

export const timeSummarySchema = z.object({
  taskId: idSchema.optional(),
  projectId: idSchema.optional(),
  userId: idSchema.optional(),
  totalMinutes: z.number().int().nonnegative()
});
