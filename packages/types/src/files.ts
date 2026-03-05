import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { folderScopeSchema } from "./enums.js";

export const folderSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  scope: folderScopeSchema,
  projectId: idSchema.nullable(),
  teamId: idSchema.nullable(),
  parentId: idSchema.nullable(),
  createdAt: timestampSchema
});

export const fileObjectSchema = z.object({
  id: idSchema,
  folderId: idSchema,
  ownerId: idSchema,
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().nonnegative(),
  minioPath: z.string().min(1).max(600),
  deletedAt: timestampSchema.nullable(),
  createdAt: timestampSchema
});

export const storageQuotaSchema = z.object({
  scopeType: z.enum(["USUARIO", "EQUIPO"]),
  scopeId: idSchema,
  bytesLimit: z.number().int().positive(),
  alertThresholdPct: z.number().min(0.1).max(1).default(0.8)
});

export const storageSummarySchema = z.object({
  projectId: idSchema,
  usageBytes: z.number().int().nonnegative(),
  bytesLimit: z.number().int().nonnegative(),
  remainingBytes: z.number().int().nonnegative(),
  usagePct: z.number().min(0).max(1),
  warning80: z.boolean()
});
