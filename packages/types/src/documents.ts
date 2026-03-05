import { z } from "zod";
import { colorHexSchema, idSchema, paginationSchema, timestampSchema } from "./common.js";

export const documentTypeSchema = z.enum([
  "TEXTO",
  "DIAGRAMA",
  "TABLA",
  "WHITEBOARD",
  "PRESENTACION"
]);

export const diagramEngineSchema = z.enum(["EXCALIDRAW", "REACT_FLOW"]);
export const diagramKindSchema = z.enum([
  "FLUJO",
  "SECUENCIA",
  "UML_CLASES",
  "ENTIDAD_RELACION",
  "ESTADO",
  "ARQUITECTURA",
  "BPMN"
]);

export const documentVersionKindSchema = z.enum(["MANUAL", "AUTO"]);

export const collaborativeDocumentSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  folderId: idSchema,
  type: documentTypeSchema,
  name: z.string().min(1).max(80),
  yDocName: z.string().min(3).max(190),
  diagramEngine: diagramEngineSchema.nullable().optional(),
  diagramKind: diagramKindSchema.nullable().optional(),
  currentVersion: z.number().int().min(0),
  createdById: idSchema,
  createdByName: z.string().min(1).max(160).optional(),
  deletedAt: timestampSchema.nullable().optional(),
  purgeAt: timestampSchema.nullable().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const collaborativeDocumentVersionSchema = z.object({
  id: idSchema,
  documentId: idSchema,
  versionNumber: z.number().int().positive(),
  kind: documentVersionKindSchema,
  snapshotPath: z.string().min(1).max(600),
  snapshotSizeBytes: z.number().int().nonnegative(),
  createdById: idSchema,
  createdByName: z.string().min(1).max(160).optional(),
  createdAt: timestampSchema
});

export const documentSpaceSchema = z.object({
  projectId: idSchema,
  rootFolderId: idSchema,
  textoFolderId: idSchema,
  diagramasFolderId: idSchema,
  tablasFolderId: idSchema,
  whiteboardFolderId: idSchema,
  presentacionesFolderId: idSchema
});

export const documentPresenceCollaboratorSchema = z.object({
  userId: idSchema,
  name: z.string().min(1).max(160),
  color: colorHexSchema,
  cursorLabel: z.string().min(1).max(80).nullable(),
  lastSeenAt: timestampSchema
});

export const documentPresenceItemSchema = z.object({
  documentId: idSchema,
  collaborators: z.array(documentPresenceCollaboratorSchema)
});

export const documentsByTypeSchema = z.object({
  TEXTO: z.array(collaborativeDocumentSchema),
  DIAGRAMA: z.array(collaborativeDocumentSchema),
  TABLA: z.array(collaborativeDocumentSchema),
  WHITEBOARD: z.array(collaborativeDocumentSchema),
  PRESENTACION: z.array(collaborativeDocumentSchema)
});

export const documentsExplorerResponseSchema = z.object({
  projectId: idSchema,
  space: documentSpaceSchema,
  documentsByType: documentsByTypeSchema,
  activeCollaborators: z.array(documentPresenceItemSchema)
});

export const initFoldersInputSchema = z.object({
  projectId: idSchema
});

export const listDocumentsQuerySchema = z.object({
  projectId: idSchema,
  q: z.string().trim().min(1).max(80).optional(),
  type: documentTypeSchema.optional()
});

export const createDocumentInputSchema = z.object({
  projectId: idSchema,
  type: documentTypeSchema,
  name: z.string().trim().min(1).max(80),
  diagramKind: diagramKindSchema.optional()
});

export const renameDocumentInputSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export const saveVersionInputSchema = z.object({
  kind: documentVersionKindSchema.default("MANUAL")
});

export const listDocumentVersionsQuerySchema = paginationSchema;

export const presenceHeartbeatInputSchema = z.object({
  color: colorHexSchema,
  cursorLabel: z.string().trim().min(1).max(80).optional()
});

export const documentIdParamsSchema = z.object({
  documentId: idSchema
});

export const documentVersionParamsSchema = z.object({
  documentId: idSchema,
  versionId: idSchema
});

export const documentVersionContentQuerySchema = z.object({
  mode: z.enum(["inline", "attachment"]).default("inline")
});

export const documentAssetContentQuerySchema = z.object({
  token: z.string().min(1),
  mode: z.enum(["inline", "attachment"]).default("inline")
});

export const documentsPresenceQuerySchema = z.object({
  projectId: idSchema
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DiagramEngine = z.infer<typeof diagramEngineSchema>;
export type DiagramKind = z.infer<typeof diagramKindSchema>;
export type DocumentVersionKind = z.infer<typeof documentVersionKindSchema>;
export type CollaborativeDocument = z.infer<typeof collaborativeDocumentSchema>;
export type CollaborativeDocumentVersion = z.infer<typeof collaborativeDocumentVersionSchema>;
export type DocumentSpace = z.infer<typeof documentSpaceSchema>;
export type DocumentPresenceItem = z.infer<typeof documentPresenceItemSchema>;
export type DocumentsExplorerResponse = z.infer<typeof documentsExplorerResponseSchema>;
