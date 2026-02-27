import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { actionTypeSchema, entityTypeSchema } from "./enums.js";

export const auditLogSchema = z.object({
  id: idSchema,
  entityType: entityTypeSchema,
  entityId: idSchema,
  action: actionTypeSchema,
  userId: idSchema.nullable(),
  previousData: z.record(z.string(), z.unknown()).nullable(),
  newData: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().max(500).nullable(),
  createdAt: timestampSchema
});

export const createAuditLogInputSchema = auditLogSchema
  .pick({
    entityType: true,
    entityId: true,
    action: true,
    userId: true,
    previousData: true,
    newData: true,
    reason: true
  })
  .extend({
    previousData: z.record(z.string(), z.unknown()).nullable().optional(),
    newData: z.record(z.string(), z.unknown()).nullable().optional(),
    reason: z.string().max(500).optional()
  });

export type AuditLog = z.infer<typeof auditLogSchema>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;
