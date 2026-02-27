import { z } from "zod";
import { idSchema, timestampSchema, windowScheduleSchema } from "./common.js";
import { availabilityTypeSchema } from "./enums.js";

export const availabilityBlockSchema = z.object({
  id: idSchema,
  userId: idSchema,
  type: availabilityTypeSchema,
  startAt: timestampSchema,
  endAt: timestampSchema,
  note: z.string().max(500).nullable()
});

export const createAvailabilityBlockInputSchema = z
  .object({
    userId: idSchema,
    type: availabilityTypeSchema,
    startAt: timestampSchema,
    endAt: timestampSchema,
    note: z.string().max(500).optional()
  })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    message: "La fecha de fin debe ser posterior a la fecha de inicio",
    path: ["endAt"]
  });

export const workScheduleSchema = z.object({
  userId: idSchema,
  schedule: windowScheduleSchema,
  maxActiveTasks: z.number().int().positive(),
  periodHoursCapacity: z.number().positive()
});

export const assignmentAvailabilityCheckInputSchema = z.object({
  userId: idSchema,
  assignAt: timestampSchema,
  requireOutOfScheduleConfirmation: z.boolean().default(false)
});

export const assignmentAvailabilityCheckResultSchema = z.object({
  allowed: z.boolean(),
  blocked: z.boolean(),
  warning: z.string().nullable(),
  reason: z.string().nullable()
});
