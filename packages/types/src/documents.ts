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

export const documentCollabTokenResponseSchema = z.object({
  token: z.string().min(1),
  expiresInSeconds: z.number().int().positive()
});

export const documentCollabSessionStatusSchema = z.enum(["ACTIVE", "CLOSED"]);
export const documentCollabParticipantStatusSchema = z.enum(["ONLINE", "OFFLINE"]);
export const documentCollabSessionEventTypeSchema = z.enum([
  "JOIN",
  "LEAVE",
  "DISCONNECT",
  "RECONNECT",
  "SNAPSHOT_SAVED",
  "SAVE_VERSION",
  "ERROR",
  "MIGRATION"
]);

export const documentDiagramSessionJoinInputSchema = z.object({
  clientId: z.string().trim().min(1).max(120).optional()
});

export const documentDiagramSessionParamsSchema = z.object({
  documentId: idSchema
});

export const documentDiagramSessionParticipantSchema = z.object({
  userId: idSchema,
  clientId: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  status: documentCollabParticipantStatusSchema,
  joinedAt: timestampSchema,
  leftAt: timestampSchema.nullable(),
  lastHeartbeatAt: timestampSchema.nullable()
});

export const documentDiagramSessionJoinResponseSchema = z.object({
  sessionId: idSchema,
  roomName: z.string().min(1).max(190),
  status: documentCollabSessionStatusSchema,
  heartbeatMs: z.number().int().positive(),
  snapshotIntervalMs: z.number().int().positive(),
  startedAt: timestampSchema,
  lastActivityAt: timestampSchema,
  revision: z.number().int().nonnegative(),
  lastSnapshotAt: timestampSchema.nullable(),
  lastSnapshotHash: z.string().min(1).max(64).nullable(),
  participants: z.array(documentDiagramSessionParticipantSchema)
});

export const documentDiagramSessionHeartbeatInputSchema = z.object({
  sessionId: idSchema,
  clientId: z.string().trim().min(1).max(120)
});

export const documentDiagramSessionHeartbeatResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: idSchema,
  lastHeartbeatAt: timestampSchema,
  participantsOnline: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  lastEvent: documentCollabSessionEventTypeSchema.nullable()
});

export const documentDiagramSessionSnapshotReasonSchema = z.enum([
  "interval",
  "leave",
  "before_unload",
  "manual_save",
  "migration"
]);

export const documentDiagramSessionSnapshotInputSchema = z.object({
  sessionId: idSchema,
  clientId: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(5_000_000),
  reason: documentDiagramSessionSnapshotReasonSchema.default("interval"),
  metadata: z.record(z.string(), z.any()).optional()
});

export const documentDiagramSessionSnapshotResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: idSchema,
  deduped: z.boolean(),
  revision: z.number().int().nonnegative(),
  snapshotHash: z.string().min(1).max(64),
  snapshotAt: timestampSchema,
  eventType: documentCollabSessionEventTypeSchema
});

export const documentDiagramSessionLeaveInputSchema = z.object({
  sessionId: idSchema,
  clientId: z.string().trim().min(1).max(120)
});

export const documentDiagramSessionLeaveResponseSchema = z.object({
  ok: z.literal(true),
  sessionId: idSchema,
  leftAt: timestampSchema
});

export const documentDiagramSessionStateResponseSchema = z.object({
  sessionId: idSchema.nullable(),
  roomName: z.string().min(1).max(190).nullable(),
  status: documentCollabSessionStatusSchema.nullable(),
  heartbeatMs: z.number().int().positive(),
  snapshotIntervalMs: z.number().int().positive(),
  startedAt: timestampSchema.nullable(),
  lastActivityAt: timestampSchema.nullable(),
  revision: z.number().int().nonnegative(),
  lastSnapshotAt: timestampSchema.nullable(),
  lastSnapshotHash: z.string().min(1).max(64).nullable(),
  lastEvent: documentCollabSessionEventTypeSchema.nullable(),
  participants: z.array(documentDiagramSessionParticipantSchema),
  participantsOnline: z.number().int().nonnegative()
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

// --- Trash ---
export const listTrashQuerySchema = z.object({
  projectId: idSchema
});

export const restoreDocumentParamsSchema = z.object({
  documentId: idSchema
});

// --- Duplicate ---
export const duplicateDocumentParamsSchema = z.object({
  documentId: idSchema
});

// --- Favorites ---
export const documentFavoriteParamsSchema = z.object({
  documentId: idSchema
});

// --- Templates ---
export const documentTemplateSchema = z.object({
  id: idSchema,
  projectId: idSchema.nullable(),
  type: documentTypeSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  snapshotPath: z.string().min(1),
  createdById: idSchema,
  createdAt: timestampSchema
});

export const createTemplateInputSchema = z.object({
  documentId: idSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional()
});

export const listTemplatesQuerySchema = z.object({
  projectId: idSchema.optional(),
  type: documentTypeSchema.optional()
});

// --- Batch operations ---
export const batchDocumentIdsSchema = z.object({
  documentIds: z.array(idSchema).min(1).max(50)
});

// --- Extended create with templateId ---
export const createDocumentWithTemplateInputSchema = createDocumentInputSchema.extend({
  templateId: idSchema.optional()
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
export type DocumentCollabTokenResponse = z.infer<typeof documentCollabTokenResponseSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type DocumentDiagramSessionJoinResponse = z.infer<typeof documentDiagramSessionJoinResponseSchema>;
export type DocumentDiagramSessionStateResponse = z.infer<typeof documentDiagramSessionStateResponseSchema>;
export type DocumentDiagramSessionHeartbeatResponse = z.infer<typeof documentDiagramSessionHeartbeatResponseSchema>;
export type DocumentDiagramSessionSnapshotResponse = z.infer<typeof documentDiagramSessionSnapshotResponseSchema>;
export type DocumentCollabSessionEventType = z.infer<typeof documentCollabSessionEventTypeSchema>;

// Extended document with isFavorite for explorer
export const collaborativeDocumentWithFavoriteSchema = collaborativeDocumentSchema.extend({
  isFavorite: z.boolean().optional()
});
export type CollaborativeDocumentWithFavorite = z.infer<typeof collaborativeDocumentWithFavoriteSchema>;
