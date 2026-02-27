import { fileObjectSchema, folderSchema, storageQuotaSchema } from "@corelia/types";
import { z } from "zod";

export const fileSchemas = {
  explorerQuerySchema: z.object({
    projectId: z.string().uuid(),
    folderId: z.string().uuid().optional()
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
  storageQuotaSchema,
  fileIdParamSchema: z.object({ fileId: z.string().uuid() })
};
