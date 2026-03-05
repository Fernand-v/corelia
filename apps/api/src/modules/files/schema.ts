import { fileObjectSchema, folderSchema, storageQuotaSchema, storageSummarySchema } from "@corelia/types";
import { z } from "zod";

export const fileSchemas = {
  explorerQuerySchema: z.object({
    projectId: z.string().uuid(),
    folderId: z.string().uuid().optional()
  }),
  historyQuerySchema: z.object({
    projectId: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(200).optional()
  }),
  projectQuerySchema: z.object({
    projectId: z.string().uuid()
  }),
  uploadFileBodySchema: z.object({
    folderId: z.string().uuid()
  }),
  createFolderSchema: folderSchema
    .pick({ name: true, scope: true, teamId: true, projectId: true, parentId: true })
    .extend({
      teamId: z.string().uuid().optional().nullable(),
      projectId: z.string().uuid().optional().nullable(),
      parentId: z.string().uuid().optional().nullable()
    }),
  registerFileSchema: fileObjectSchema.pick({
    folderId: true,
    originalName: true,
    mimeType: true,
    sizeBytes: true,
    minioPath: true
  }),
  fileContentQuerySchema: z.object({
    mode: z.enum(["inline", "attachment"]).default("inline")
  }),
  storageQuotaSchema,
  storageSummaryQuerySchema: z.object({
    projectId: z.string().uuid()
  }),
  storageSummarySchema,
  fileIdParamSchema: z.object({ fileId: z.string().uuid() })
};
