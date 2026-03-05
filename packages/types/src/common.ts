import { z } from "zod";

export const idSchema = z.string().uuid();
export const codeValueSchema = z.string().regex(/^[A-Z0-9_]{3,50}$/);
export const colorHexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const timestampSchema = z.string().datetime();

export const contactSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(6).max(32).optional(),
  extension: z.string().max(16).optional()
});

export const windowScheduleSchema = z.object({
  timezone: z.string().min(3).max(64),
  weekDays: z.array(z.number().int().min(0).max(6)).min(1),
  startHour: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/),
  endHour: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/)
});

export const softDeleteSchema = z.object({
  deletedAt: timestampSchema.nullish()
});
