import {
  createDocumentInputSchema,
  documentAssetContentQuerySchema,
  documentIdParamsSchema,
  documentVersionContentQuerySchema,
  documentVersionParamsSchema,
  documentsPresenceQuerySchema,
  initFoldersInputSchema,
  listDocumentVersionsQuerySchema,
  listDocumentsQuerySchema,
  presenceHeartbeatInputSchema,
  renameDocumentInputSchema,
  saveVersionInputSchema
} from "@corelia/types";

export const documentSchemas = {
  initFoldersInputSchema,
  listDocumentsQuerySchema,
  createDocumentInputSchema,
  documentIdParamsSchema,
  renameDocumentInputSchema,
  listDocumentVersionsQuerySchema,
  saveVersionInputSchema,
  documentAssetContentQuerySchema,
  documentVersionParamsSchema,
  documentVersionContentQuerySchema,
  presenceHeartbeatInputSchema,
  documentsPresenceQuerySchema
};
