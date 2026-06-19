import { randomUUID } from "node:crypto";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DocumentType,
  DocumentVersionKind
} from "@corelia/types";
import { stripControlChars } from "../../lib/sanitize.js";

// Helpers puros (sin acceso a base de datos) extraídos de DocumentsService
// para reducir el tamaño del servicio y poder testearlos de forma aislada.

export type SpaceFolders = {
  projectId: string;
  rootFolderId: string;
  textoFolderId: string;
  diagramasFolderId: string;
  tablasFolderId: string;
  whiteboardFolderId: string;
  presentacionesFolderId: string;
};

export const mapDocument = (document: {
  id: string;
  projectId: string;
  folderId: string;
  type: DocumentType;
  name: string;
  yDocName: string;
  diagramEngine?: "EXCALIDRAW" | "REACT_FLOW" | null;
  diagramKind?:
    | "FLUJO"
    | "SECUENCIA"
    | "UML_CLASES"
    | "ENTIDAD_RELACION"
    | "ESTADO"
    | "ARQUITECTURA"
    | "BPMN"
    | null;
  currentVersion: number;
  createdById: string;
  deletedAt: Date | null;
  purgeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}): CollaborativeDocument => {
  return {
    id: document.id,
    projectId: document.projectId,
    folderId: document.folderId,
    type: document.type,
    name: document.name,
    yDocName: document.yDocName,
    diagramEngine: document.diagramEngine ?? null,
    diagramKind: document.diagramKind ?? null,
    currentVersion: document.currentVersion,
    createdById: document.createdById,
    ...(document.createdBy
      ? {
          createdByName: `${document.createdBy.firstName} ${document.createdBy.lastName}`.trim()
        }
      : {}),
    deletedAt: document.deletedAt ? document.deletedAt.toISOString() : null,
    purgeAt: document.purgeAt ? document.purgeAt.toISOString() : null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString()
  };
};

export const mapVersion = (version: {
  id: string;
  documentId: string;
  versionNumber: number;
  kind: DocumentVersionKind;
  snapshotPath: string;
  snapshotSizeBytes: number;
  createdById: string;
  createdAt: Date;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}): CollaborativeDocumentVersion => {
  return {
    id: version.id,
    documentId: version.documentId,
    versionNumber: version.versionNumber,
    kind: version.kind,
    snapshotPath: version.snapshotPath,
    snapshotSizeBytes: version.snapshotSizeBytes,
    createdById: version.createdById,
    ...(version.createdBy
      ? {
          createdByName: `${version.createdBy.firstName} ${version.createdBy.lastName}`.trim()
        }
      : {}),
    createdAt: version.createdAt.toISOString()
  };
};

export const resolveFolderIdByType = (space: SpaceFolders, type: DocumentType): string => {
  if (type === "TEXTO") {
    return space.textoFolderId;
  }
  if (type === "DIAGRAMA") {
    return space.diagramasFolderId;
  }
  if (type === "TABLA") {
    return space.tablasFolderId;
  }
  if (type === "WHITEBOARD") {
    return space.whiteboardFolderId;
  }
  return space.presentacionesFolderId;
};

export const normalizeClientId = (input?: string): string => {
  const candidate = stripControlChars((input ?? "").trim())
    .replace(/\s+/g, "-")
    .slice(0, 120);

  return candidate.length > 0 ? candidate : randomUUID();
};

export const participantDisplayName = (input: { firstName: string; lastName: string }): string =>
  `${input.firstName} ${input.lastName}`.trim() || "Usuario";

export const mapDiagramSessionParticipant = (row: {
  userId: string;
  clientId: string;
  status: "ONLINE" | "OFFLINE";
  joinedAt: Date;
  leftAt: Date | null;
  lastHeartbeatAt: Date | null;
  user: {
    firstName: string;
    lastName: string;
  };
}) => {
  return {
    userId: row.userId,
    clientId: row.clientId,
    name: participantDisplayName(row.user),
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt ? row.leftAt.toISOString() : null,
    lastHeartbeatAt: row.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null
  };
};
