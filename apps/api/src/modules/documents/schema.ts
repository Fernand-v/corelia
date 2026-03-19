import {
  batchDocumentIdsSchema,
  createDocumentWithTemplateInputSchema,
  createTemplateInputSchema,
  documentAssetContentQuerySchema,
  documentFavoriteParamsSchema,
  documentIdParamsSchema,
  documentVersionContentQuerySchema,
  documentVersionParamsSchema,
  documentsPresenceQuerySchema,
  duplicateDocumentParamsSchema,
  initFoldersInputSchema,
  listDocumentVersionsQuerySchema,
  listDocumentsQuerySchema,
  listTemplatesQuerySchema,
  listTrashQuerySchema,
  presenceHeartbeatInputSchema,
  renameDocumentInputSchema,
  restoreDocumentParamsSchema,
  saveVersionInputSchema
} from "@corelia/types";
import { z } from "zod";

const documentDiagramSessionParamsSchema = documentIdParamsSchema;
const documentDiagramSessionJoinInputSchema = z.object({
  clientId: z.string().trim().min(1).max(120).optional()
});
const documentDiagramSessionHeartbeatInputSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().trim().min(1).max(120)
});
const documentDiagramSessionSnapshotInputSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(5_000_000),
  reason: z.enum(["interval", "leave", "before_unload", "manual_save", "migration"]).default("interval"),
  metadata: z.record(z.string(), z.any()).optional()
});
const documentDiagramSessionLeaveInputSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().trim().min(1).max(120)
});
const onlyOfficeSignedTokenQuerySchema = z.object({
  token: z.string().min(1)
});
const onlyOfficeCallbackBodySchema = z
  .object({
    status: z.coerce.number().int(),
    url: z.string().url().optional()
  })
  .passthrough();

export const documentSchemas = {
  initFoldersInputSchema,
  listDocumentsQuerySchema,
  createDocumentInputSchema: createDocumentWithTemplateInputSchema,
  documentIdParamsSchema,
  documentDiagramSessionParamsSchema,
  documentDiagramSessionJoinInputSchema,
  documentDiagramSessionHeartbeatInputSchema,
  documentDiagramSessionSnapshotInputSchema,
  documentDiagramSessionLeaveInputSchema,
  onlyOfficeSignedTokenQuerySchema,
  onlyOfficeCallbackBodySchema,
  renameDocumentInputSchema,
  listDocumentVersionsQuerySchema,
  saveVersionInputSchema,
  documentAssetContentQuerySchema,
  documentVersionParamsSchema,
  documentVersionContentQuerySchema,
  presenceHeartbeatInputSchema,
  documentsPresenceQuerySchema,
  listTrashQuerySchema,
  restoreDocumentParamsSchema,
  duplicateDocumentParamsSchema,
  documentFavoriteParamsSchema,
  createTemplateInputSchema,
  listTemplatesQuerySchema,
  batchDocumentIdsSchema
};
