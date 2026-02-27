import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import {
  calendarEventTypeSchema,
  calendarScopeSchema,
  calendarViewSchema,
  externalCalendarProviderSchema
} from "./enums.js";

export const calendarRangeSchema = z
  .object({
    from: timestampSchema,
    to: timestampSchema
  })
  .superRefine((input, ctx) => {
    if (new Date(input.to) <= new Date(input.from)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rango inválido: 'to' debe ser mayor a 'from'"
      });
    }
  });

export const calendarEventSchema = z.object({
  id: z.string().min(1),
  type: calendarEventTypeSchema,
  title: z.string().min(2).max(200),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  projectId: idSchema.nullable(),
  teamId: idSchema.nullable(),
  userId: idSchema.nullable(),
  readOnly: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({})
});

export const calendarSharedQuerySchema = z.object({
  scope: calendarScopeSchema,
  scopeId: idSchema,
  view: calendarViewSchema.default("SEMANA"),
  date: timestampSchema
});

export const calendarTaskRescheduleInputSchema = z.object({
  taskId: idSchema,
  dueDate: timestampSchema,
  confirmOutOfSchedule: z.boolean().default(false),
  allowDependencyConflict: z.boolean().default(false)
});

export const externalCalendarConnectionSchema = z.object({
  id: idSchema,
  provider: externalCalendarProviderSchema,
  externalAccountId: z.string().min(1),
  createdAt: timestampSchema
});

export const externalCalendarConnectInputSchema = z
  .object({
    provider: externalCalendarProviderSchema,
    externalAccountId: z.string().min(1).optional(),
    accessToken: z.string().min(10).optional(),
    refreshToken: z.string().min(10).optional(),
    expiresAt: timestampSchema.optional(),
    authorizationCode: z.string().min(6).optional()
  })
  .superRefine((input, ctx) => {
    if (!input.accessToken && !input.authorizationCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes enviar accessToken o authorizationCode"
      });
    }
  });

export const externalCalendarSyncEventSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  projectId: idSchema.optional(),
  teamId: idSchema.optional()
});

export const externalCalendarSyncInputSchema = z.object({
  connectionId: idSchema,
  events: z.array(externalCalendarSyncEventSchema).optional(),
  from: timestampSchema.optional(),
  to: timestampSchema.optional()
});

export const calendarCapacityQuerySchema = z.object({
  teamId: idSchema,
  weekStart: timestampSchema
});

export const calendarCapacityRowSchema = z.object({
  userId: idSchema,
  fullName: z.string().min(1),
  weeklyCapacityHours: z.number().nonnegative(),
  plannedMinutes: z.number().int().nonnegative(),
  activeTasks: z.number().int().nonnegative()
});
