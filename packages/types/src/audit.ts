import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { actionTypeSchema, entityTypeSchema } from "./enums.js";

export const auditLogSchema = z.object({
  id: idSchema,
  entityType: entityTypeSchema,
  entityId: idSchema,
  action: actionTypeSchema,
  userId: idSchema.nullable(),
  previousDataText: z.record(z.string(), z.unknown()).nullable(),
  newDataText: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().max(500).nullable(),
  reasonCatalogId: idSchema.nullable().optional(),
  createdAt: timestampSchema
});

export const createAuditLogInputSchema = auditLogSchema
  .pick({
    entityType: true,
    entityId: true,
    action: true,
    userId: true,
    previousDataText: true,
    newDataText: true,
    reason: true,
    reasonCatalogId: true
  })
  .extend({
    previousDataText: z.record(z.string(), z.unknown()).nullable().optional(),
    newDataText: z.record(z.string(), z.unknown()).nullable().optional(),
    reason: z.string().max(500).optional(),
    reasonCatalogId: idSchema.optional()
  });

export type AuditLog = z.infer<typeof auditLogSchema>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;
