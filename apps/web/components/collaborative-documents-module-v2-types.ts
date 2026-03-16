import type { ReactNode } from "react";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DocumentType
} from "@corelia/types";

export type DocumentTypeMeta = {
  label: string;
  icon: string;
  accent: string;
  hint: string;
  placeholder: string;
};

export type CollaboratorPresence = {
  userId: string;
  name: string;
  color: string;
  cursorLabel?: string | null;
  lastSeenAt?: string;
};

export type ExplorerSort = "updatedDesc" | "updatedAsc" | "nameAsc" | "nameDesc";
export type ExplorerTypeFilter = DocumentType | "ALL" | "TRASH" | "FAVORITES";

export type CollaborativeDocumentsV2Props = {
  project: {
    id: string;
    name: string;
  };
  documents: Record<DocumentType, CollaborativeDocument[]>;
  documentTypeMeta: Record<DocumentType, DocumentTypeMeta>;
  documentTypeOrder: DocumentType[];
  loading: boolean;
  errorMessage: string | null;
  search: string;
  setSearch: (value: string) => void;
  collaboratorsByDocumentId: Map<string, CollaboratorPresence[]>;
  activeDocument: CollaborativeDocument | null;
  activeDocumentCollaborators: CollaboratorPresence[];
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  connectionState: "connected" | "reconnecting" | "offline";
  syncLabel: {
    label: string;
    tone: string;
  };
  saveStatusBadge:
    | {
        label: string;
        tone: string;
      }
    | null;
  savingVersion: boolean;
  versionPanelOpen: boolean;
  versions: CollaborativeDocumentVersion[];
  editorNode: ReactNode;
  onRetry?: () => void;
  onCreateDocument: (type?: DocumentType) => void;
  onOpenDocument: (document: CollaborativeDocument) => void;
  onRequestDocumentHistory: (document: CollaborativeDocument) => void;
  onCloseDocument: () => void;
  onRenameDocument: (document: CollaborativeDocument, newName: string) => Promise<void>;
  onRequestRename: (document: CollaborativeDocument) => void;
  onRequestDelete: (document: CollaborativeDocument) => void;
  onSaveVersion: () => void;
  onToggleVersionPanel: () => void;
  onRestoreVersion: (
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => Promise<void>;
  onPreviewVersion?: (
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => Promise<string | null>;
  onOpenPreview: (title: string, payload: string | null) => void;
  onDuplicateDocument?: ((document: CollaborativeDocument) => Promise<void>) | undefined;
  onToggleFavorite?: ((document: CollaborativeDocument) => Promise<void>) | undefined;
  onRestoreFromTrash?: ((documentId: string) => Promise<void>) | undefined;
  onFetchTrash?: (() => void) | undefined;
  trashItems?: CollaborativeDocument[] | undefined;
  trashLoading?: boolean | undefined;
  onBatchDelete?: ((documentIds: string[]) => Promise<void>) | undefined;
  onBatchRestore?: ((documentIds: string[]) => Promise<void>) | undefined;
  onCreateTemplate?: ((input: {
    documentId: string;
    name: string;
    description?: string;
  }) => Promise<void>) | undefined;
};

export type ExplorerRow = {
  id: string;
  type: DocumentType;
  typeLabel: string;
  typeHint: string;
  typeAccent: string;
  name: string;
  updatedAt: string;
  currentVersion: number;
  document: CollaborativeDocument;
  collaborators: CollaboratorPresence[];
  isFavorite?: boolean;
};
