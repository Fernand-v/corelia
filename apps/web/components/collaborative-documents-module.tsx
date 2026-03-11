"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DiagramKind,
  DocumentPresenceItem,
  DocumentType
} from "@corelia/types";
import { UiModal } from "@/components/ui-modal";
import { DocumentsEditorText } from "@/components/documents-editor-text";
import { DocumentsEditorDiagram } from "@/components/documents-editor-diagram";
import { DocumentsEditorTable } from "@/components/documents-editor-table";
import { DocumentsEditorWhiteboard } from "@/components/documents-editor-whiteboard";
import { DocumentsEditorPresentation } from "@/components/documents-editor-presentation";
import { CollaborativeDocumentsModuleV2 } from "@/components/collaborative-documents-module-v2";
import { exportDiagramV3ToDrawioDocument } from "@/lib/diagram/maxgraph/diagram-collab-v3";
import { serializeMxfile } from "@/lib/diagram/maxgraph/xml-format";

type DocumentTypeMeta = {
  label: string;
  icon: string;
  accent: string;
  hint: string;
  placeholder: string;
};

const DOCUMENT_TYPE_META: Record<DocumentType, DocumentTypeMeta> = {
  TEXTO: {
    label: "Texto",
    icon: "📝",
    accent: "#4f6ef7",
    hint: "Documentos de texto enriquecido",
    placeholder: "ej: Especificación técnica del módulo auth"
  },
  DIAGRAMA: {
    label: "Diagramas",
    icon: "🔷",
    accent: "#8b5cf6",
    hint: "Flujos y diagramas colaborativos",
    placeholder: "ej: Flujo de autenticación de usuarios"
  },
  TABLA: {
    label: "Tablas",
    icon: "📊",
    accent: "#10b981",
    hint: "Hojas de cálculo colaborativas",
    placeholder: "ej: Seguimiento de presupuesto Q2"
  },
  WHITEBOARD: {
    label: "Pizarra",
    icon: "🎨",
    accent: "#f97316",
    hint: "Pizarra colaborativa en tiempo real",
    placeholder: "ej: Lluvia de ideas — Sprint 10"
  },
  PRESENTACION: {
    label: "Presentaciones",
    icon: "🎯",
    accent: "#ec4899",
    hint: "Diapositivas colaborativas",
    placeholder: "ej: Demo para cliente — Módulo auth"
  }
};

const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  "TEXTO",
  "DIAGRAMA",
  "TABLA",
  "WHITEBOARD",
  "PRESENTACION"
];

const DIAGRAM_KIND_OPTIONS: Array<{ value: DiagramKind; label: string }> = [
  { value: "FLUJO", label: "Flujo" },
  { value: "SECUENCIA", label: "Secuencia" },
  { value: "UML_CLASES", label: "UML Clases" },
  { value: "ENTIDAD_RELACION", label: "Entidad-Relación" },
  { value: "ESTADO", label: "Estado" },
  { value: "ARQUITECTURA", label: "Arquitectura" },
  { value: "BPMN", label: "BPMN" }
];

type CurrentUser = {
  id: string;
  name: string;
  color: string;
};

type CollaboratorMember = {
  id: string;
  name: string;
  color: string;
};

const DEFAULT_AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;
const DIAGRAM_AUTO_SAVE_INTERVAL_MS = 30 * 1000;
const DIAGRAM_USER_CELL_REGEX = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/i;

export type DocumentEditorSyncState = "synced" | "saving" | "reconnecting" | "offline";

export type DocumentSavePayload = {
  kind: "MANUAL" | "AUTO";
  content: string;
  fileName?: string;
  mimeType?: string;
  format?: "json" | "drawio";
};

export type CollaborativeDocumentsModuleProps = {
  project: {
    id: string;
    name: string;
  };
  documents: Record<DocumentType, CollaborativeDocument[]>;
  currentUser: CurrentUser;
  activeCollaborators: DocumentPresenceItem[];
  activeDocument: CollaborativeDocument | null;
  versions?: CollaborativeDocumentVersion[];
  loading?: boolean;
  errorMessage?: string | null;
  isProviderOffline?: boolean;
  syncState?: DocumentEditorSyncState;
  connectionState?: "connected" | "reconnecting" | "offline";
  yjsProvider?: HocuspocusProvider | null;
  members?: CollaboratorMember[];
  onRetry?: () => void;
  onCreateDocument: (input: {
    projectId: string;
    type: DocumentType;
    name: string;
    diagramKind?: DiagramKind;
    templateId?: string;
  }) => Promise<CollaborativeDocument | null>;
  onOpenDocument: (document: CollaborativeDocument) => void;
  onCloseDocument: () => void;
  onDeleteDocument: (document: CollaborativeDocument) => Promise<void>;
  onRenameDocument: (document: CollaborativeDocument, newName: string) => Promise<void>;
  onSaveVersion: (document: CollaborativeDocument, payload: DocumentSavePayload) => Promise<void>;
  onDiagramLegacyMigration?: (
    document: CollaborativeDocument,
    input: {
      droppedPageIds: string[];
      activePageId: string;
      backupSnapshot: string;
    }
  ) => Promise<void> | void;
  onUploadDocumentAsset?: (
    document: CollaborativeDocument,
    file: File
  ) => Promise<{ url: string } | null>;
  onRestoreVersion: (document: CollaborativeDocument, version: CollaborativeDocumentVersion) => Promise<void>;
  onLoadVersions?: (document: CollaborativeDocument) => void;
  onPreviewVersion?: (document: CollaborativeDocument, version: CollaborativeDocumentVersion) => Promise<string | null>;
  // New features
  onDuplicateDocument?: (document: CollaborativeDocument) => Promise<void>;
  onToggleFavorite?: (document: CollaborativeDocument) => Promise<void>;
  onRestoreFromTrash?: (documentId: string) => Promise<void>;
  onFetchTrash?: () => void;
  trashItems?: CollaborativeDocument[];
  trashLoading?: boolean;
  onBatchDelete?: (documentIds: string[]) => Promise<void>;
  onBatchRestore?: (documentIds: string[]) => Promise<void>;
  onCreateTemplate?: (input: { documentId: string; name: string; description?: string }) => Promise<void>;
  onFetchTemplates?: () => void;
  templates?: Array<{ id: string; projectId: string | null; type: DocumentType; name: string; description: string | null }>;
};

const syncLabelByState: Record<DocumentEditorSyncState, { label: string; tone: string }> = {
  synced: {
    label: "🟢 Conectado",
    tone: "bg-emerald-100 text-emerald-700"
  },
  saving: {
    label: "Guardando…",
    tone: "bg-amber-50 text-amber-600"
  },
  reconnecting: {
    label: "🟡 Reconectando",
    tone: "bg-yellow-100 text-yellow-700"
  },
  offline: {
    label: "🔴 Sin conexión",
    tone: "bg-red-100 text-red-700"
  }
};

export const CollaborativeDocumentsModule = ({
  project,
  documents,
  currentUser,
  activeCollaborators,
  activeDocument,
  versions = [],
  loading = false,
  errorMessage = null,
  isProviderOffline = false,
  syncState = "synced",
  connectionState = "connected",
  yjsProvider = null,
  members = [],
  onRetry,
  onCreateDocument,
  onOpenDocument,
  onCloseDocument,
  onDeleteDocument,
  onRenameDocument,
  onSaveVersion,
  onDiagramLegacyMigration,
  onUploadDocumentAsset,
  onRestoreVersion,
  onLoadVersions,
  onPreviewVersion,
  onDuplicateDocument,
  onToggleFavorite,
  onRestoreFromTrash,
  onFetchTrash,
  trashItems = [],
  trashLoading = false,
  onBatchDelete,
  onBatchRestore,
  onCreateTemplate,
  onFetchTemplates,
  templates = []
}: CollaborativeDocumentsModuleProps) => {
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [selectedDiagramKind, setSelectedDiagramKind] = useState<DiagramKind>("FLUJO");
  const [newDocumentName, setNewDocumentName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CollaborativeDocument | null>(null);
  const [renameTarget, setRenameTarget] = useState<CollaborativeDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
  const [dirtyByDocumentId, setDirtyByDocumentId] = useState<Record<string, boolean>>({});
  const [recentlySavedByDocumentId, setRecentlySavedByDocumentId] = useState<Record<string, boolean>>({});
  const onSaveVersionRef = useRef(onSaveVersion);
  const onLoadVersionsRef = useRef(onLoadVersions);
  const autoSaveInFlightRef = useRef<Record<string, boolean>>({});
  const lastAutoSaveFingerprintRef = useRef<Record<string, string>>({});
  const previousConnectionStateRef = useRef(connectionState);
  const editorDraftsRef = useRef(editorDrafts);
  const dirtyByDocumentIdRef = useRef(dirtyByDocumentId);
  const isProviderOfflineRef = useRef(isProviderOffline);
  const activeDocumentRef = useRef<CollaborativeDocument | null>(activeDocument);
  const previousActiveDocumentRef = useRef<CollaborativeDocument | null>(activeDocument);

  useEffect(() => {
    onSaveVersionRef.current = onSaveVersion;
  }, [onSaveVersion]);

  useEffect(() => {
    onLoadVersionsRef.current = onLoadVersions;
  }, [onLoadVersions]);

  useEffect(() => {
    editorDraftsRef.current = editorDrafts;
  }, [editorDrafts]);

  useEffect(() => {
    dirtyByDocumentIdRef.current = dirtyByDocumentId;
  }, [dirtyByDocumentId]);

  useEffect(() => {
    isProviderOfflineRef.current = isProviderOffline;
  }, [isProviderOffline]);

  useEffect(() => {
    activeDocumentRef.current = activeDocument;
  }, [activeDocument]);

  const collaboratorsByDocumentId = useMemo(() => {
    return new Map(activeCollaborators.map((entry) => [entry.documentId, entry.collaborators]));
  }, [activeCollaborators]);

  const activeDocumentCollaborators = activeDocument
    ? collaboratorsByDocumentId.get(activeDocument.id) ?? []
    : [];

  const activeDraft = activeDocument ? editorDrafts[activeDocument.id] ?? "" : "";
  const activeDocumentId = activeDocument?.id ?? null;
  const activeIsDirty = activeDocumentId ? Boolean(dirtyByDocumentId[activeDocumentId]) : false;
  const activeWasSavedRecently = activeDocumentId
    ? Boolean(recentlySavedByDocumentId[activeDocumentId])
    : false;
  const saveStatusBadge = useMemo(() => {
    if (!activeDocumentId || isProviderOffline) {
      return null;
    }

    if (syncState === "saving" || savingVersion) {
      return {
        label: "Guardando...",
        tone: "bg-amber-100 text-amber-700"
      };
    }

    if (activeIsDirty) {
      return {
        label: "● Cambios sin guardar",
        tone: "bg-blue-100 text-blue-700"
      };
    }

    if (activeWasSavedRecently) {
      return {
        label: "✓ Guardado",
        tone: "bg-emerald-100 text-emerald-700"
      };
    }

    return null;
  }, [activeDocumentId, activeIsDirty, activeWasSavedRecently, isProviderOffline, savingVersion, syncState]);

  const markSavedState = useCallback((documentId: string) => {
    setDirtyByDocumentId((current) => ({
      ...current,
      [documentId]: false
    }));

    setRecentlySavedByDocumentId((current) => ({
      ...current,
      [documentId]: true
    }));

    window.setTimeout(() => {
      setRecentlySavedByDocumentId((current) => {
        if (!current[documentId]) {
          return current;
        }
        return {
          ...current,
          [documentId]: false
        };
      });
    }, 2_000);
  }, []);

  const buildSavePayload = useCallback(
    (
      document: CollaborativeDocument,
      content: string,
      kind: "MANUAL" | "AUTO"
    ): DocumentSavePayload => {
      if (document.type === "DIAGRAMA") {
        return {
          kind,
          content,
          fileName: `${document.id}.drawio`,
          mimeType: "application/xml",
          format: "drawio"
        };
      }

      return {
        kind,
        content,
        fileName: `${document.id}.json`,
        mimeType: "application/json",
        format: "json"
      };
    },
    []
  );

  const getContentFingerprint = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "0";
    }
    const head = trimmed.slice(0, 96);
    const tail = trimmed.slice(-96);
    return `${trimmed.length}:${head}:${tail}`;
  }, []);

  const forceSyncDiagramSnapshot = useCallback((documentId: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("corelia:diagram-force-sync", {
        detail: { documentId }
      })
    );
  }, []);

  const requestLiveDiagramSnapshot = useCallback((documentId: string): string => {
    if (typeof window === "undefined") {
      return "";
    }
    let snapshot = "";
    window.dispatchEvent(
      new CustomEvent("corelia:diagram-request-snapshot", {
        detail: {
          documentId,
          capture: (payload: string) => {
            snapshot = payload.trim();
          }
        }
      })
    );
    return snapshot;
  }, []);

  const resolveCurrentDocumentPayload = useCallback(
    (document: CollaborativeDocument) => {
      if (document.type === "DIAGRAMA" && yjsProvider?.document) {
        const liveSnapshot = requestLiveDiagramSnapshot(document.id);
        if (liveSnapshot && DIAGRAM_USER_CELL_REGEX.test(liveSnapshot)) {
          return liveSnapshot;
        }

        forceSyncDiagramSnapshot(document.id);
        let v3Payload = "";
        try {
          const fallbackKind: DiagramKind = document.diagramKind ?? "FLUJO";
          const yDiagramMap = yjsProvider.document.getMap(`doc:${document.id}:diagram:v3`);
          v3Payload = serializeMxfile(
            exportDiagramV3ToDrawioDocument(yDiagramMap, fallbackKind)
          ).trim();
          if (v3Payload && DIAGRAM_USER_CELL_REGEX.test(v3Payload)) {
            return v3Payload;
          }

          const yPayload = yjsProvider.document
            .getText(`doc:${document.id}:diagram`)
            .toString()
            .trim();
          if (yPayload && DIAGRAM_USER_CELL_REGEX.test(yPayload)) {
            return yPayload;
          }

          // Do NOT return v3Payload/yPayload without user cells — it would
          // cause an empty version to be persisted on close.
        } catch {
          // noop: fallback to local draft
        }
      }

      return editorDraftsRef.current[document.id]?.trim() ?? "";
    },
    [forceSyncDiagramSnapshot, requestLiveDiagramSnapshot, yjsProvider]
  );

  const persistAutoVersion = useCallback(
    async (
      document: CollaborativeDocument,
      content: string,
      source: "interval" | "flush" | "reconnected_autosave"
    ) => {
      const payloadContent = content.trim();
      if (!payloadContent) {
        return;
      }

      const fingerprint = getContentFingerprint(payloadContent);
      if (lastAutoSaveFingerprintRef.current[document.id] === fingerprint) {
        return;
      }

      if (autoSaveInFlightRef.current[document.id]) {
        return;
      }

      autoSaveInFlightRef.current[document.id] = true;
      try {
        await onSaveVersionRef.current(
          document,
          buildSavePayload(document, payloadContent, "AUTO")
        );
        lastAutoSaveFingerprintRef.current[document.id] = fingerprint;
        markSavedState(document.id);
        onLoadVersionsRef.current?.(document);
        if (source === "reconnected_autosave" && process.env.NODE_ENV !== "test") {
          console.debug("[maxgraph-collab]", "queue_flush", {
            documentId: document.id,
            source
          });
        }
      } catch {
        // noop: autosave errors are non-blocking for editing UX
      } finally {
        autoSaveInFlightRef.current[document.id] = false;
      }
    },
    [buildSavePayload, getContentFingerprint, markSavedState]
  );

  const flushDocumentIfDirty = useCallback(
    (document: CollaborativeDocument | null) => {
      if (!document || isProviderOfflineRef.current) {
        return;
      }

      const currentPayload = resolveCurrentDocumentPayload(document);
      const isDirty = dirtyByDocumentIdRef.current[document.id] ?? false;
      if (!currentPayload || !isDirty) {
        if (document.type !== "DIAGRAMA" || !currentPayload) {
          return;
        }

        const fingerprint = getContentFingerprint(currentPayload);
        if (lastAutoSaveFingerprintRef.current[document.id] === fingerprint) {
          return;
        }
      }

      if (!currentPayload) {
        return;
      }

      // Safety guard: never persist an empty diagram snapshot.  This prevents
      // the close-race-condition (provider destroyed before the activeDocument
      // change effect flushes) from overwriting a valid version with an empty one.
      if (document.type === "DIAGRAMA" && !DIAGRAM_USER_CELL_REGEX.test(currentPayload)) {
        return;
      }

      void persistAutoVersion(document, currentPayload, "flush");
    },
    [getContentFingerprint, persistAutoVersion, resolveCurrentDocumentPayload]
  );

  const flushDirtyDraft = useCallback(() => {
    flushDocumentIfDirty(activeDocumentRef.current);
  }, [flushDocumentIfDirty]);

  useEffect(() => {
    const previous = previousActiveDocumentRef.current;
    const nextId = activeDocument?.id ?? null;

    if (previous && previous.id !== nextId) {
      flushDocumentIfDirty(previous);
    }

    previousActiveDocumentRef.current = activeDocument;
  }, [activeDocument, flushDocumentIfDirty]);

  useEffect(() => {
    return () => {
      flushDocumentIfDirty(previousActiveDocumentRef.current);
    };
  }, [flushDocumentIfDirty]);

  const handleDraftChange = useCallback(
    (value: string) => {
      if (!activeDocumentId) {
        return;
      }

      setEditorDrafts((current) => {
        if (current[activeDocumentId] === value) {
          return current;
        }
        return {
          ...current,
          [activeDocumentId]: value
        };
      });

      setDirtyByDocumentId((current) => {
        if (current[activeDocumentId]) {
          return current;
        }
        return {
          ...current,
          [activeDocumentId]: true
        };
      });

      setRecentlySavedByDocumentId((current) => {
        if (!current[activeDocumentId]) {
          return current;
        }
        return {
          ...current,
          [activeDocumentId]: false
        };
      });
    },
    [activeDocumentId]
  );

  const openCreateModal = (type?: DocumentType) => {
    setSelectedType(type ?? null);
    setSelectedDiagramKind("FLUJO");
    setNewDocumentName("");
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setSelectedType(null);
    setNewDocumentName("");
  };

  const handleCreateDocument = async () => {
    if (!selectedType) {
      return;
    }

    const name = newDocumentName.trim();
    if (!name || name.length > 80) {
      return;
    }

    const created = await onCreateDocument({
      projectId: project.id,
      type: selectedType,
      name,
      ...(selectedType === "DIAGRAMA" ? { diagramKind: selectedDiagramKind } : {})
    });

    closeCreateModal();

    if (created) {
      onOpenDocument(created);
    }
  };

  const openDocumentInV2 = useCallback(
    (document: CollaborativeDocument) => {
      const current = activeDocumentRef.current;
      if (current && current.id !== document.id) {
        flushDocumentIfDirty(current);
      }
      onOpenDocument(document);
    },
    [flushDocumentIfDirty, onOpenDocument]
  );

  const openDocumentHistoryInV2 = useCallback(
    (document: CollaborativeDocument) => {
      const current = activeDocumentRef.current;
      if (current && current.id !== document.id) {
        flushDocumentIfDirty(current);
      }
      onOpenDocument(document);
      setVersionPanelOpen(true);
      onLoadVersions?.(document);
    },
    [flushDocumentIfDirty, onLoadVersions, onOpenDocument]
  );

  const saveManualVersion = async () => {
    if (!activeDocument || savingVersion) {
      return;
    }

    const payload = resolveCurrentDocumentPayload(activeDocument);
    if (!payload) {
      return;
    }

    setSavingVersion(true);
    try {
      await onSaveVersionRef.current(activeDocument, buildSavePayload(activeDocument, payload, "MANUAL"));
      lastAutoSaveFingerprintRef.current[activeDocument.id] = getContentFingerprint(payload);
      markSavedState(activeDocument.id);
      onLoadVersionsRef.current?.(activeDocument);
    } finally {
      setSavingVersion(false);
    }
  };

  useEffect(() => {
    if (!activeDocument || isProviderOffline) {
      return;
    }

    const intervalMs =
      activeDocument.type === "DIAGRAMA" ? DIAGRAM_AUTO_SAVE_INTERVAL_MS : DEFAULT_AUTO_SAVE_INTERVAL_MS;

    const interval = window.setInterval(() => {
      const currentPayload = editorDrafts[activeDocument.id]?.trim() ?? "";
      const isDirty = dirtyByDocumentId[activeDocument.id] ?? false;

      if (!currentPayload || !isDirty) {
        return;
      }

      void persistAutoVersion(activeDocument, currentPayload, "interval");
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    activeDocument,
    dirtyByDocumentId,
    editorDrafts,
    isProviderOffline,
    persistAutoVersion
  ]);

  useEffect(() => {
    const previousState = previousConnectionStateRef.current;
    previousConnectionStateRef.current = connectionState;

    if (!activeDocument || activeDocument.type !== "DIAGRAMA") {
      return;
    }
    if (isProviderOffline || connectionState !== "connected") {
      return;
    }
    if (previousState === "connected") {
      return;
    }

    const currentPayload = editorDrafts[activeDocument.id]?.trim() ?? "";
    const isDirty = dirtyByDocumentId[activeDocument.id] ?? false;
    if (!currentPayload || !isDirty) {
      return;
    }

    void persistAutoVersion(activeDocument, currentPayload, "reconnected_autosave");
  }, [
    activeDocument,
    connectionState,
    dirtyByDocumentId,
    editorDrafts,
    isProviderOffline,
    persistAutoVersion
  ]);

  useEffect(() => {
    if (!activeDocument) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDirtyDraft();
      }
    };

    const onBeforeUnload = () => {
      flushDirtyDraft();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeDocument, flushDirtyDraft]);

  const editorNode = useMemo(() => {
    if (!activeDocument) {
      return null;
    }

    if (!isProviderOffline && !yjsProvider) {
      return (
        <div className="rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white p-6 text-sm text-slate-500 shadow-sm">
          Preparando el editor, un momento…
        </div>
      );
    }

    if (activeDocument.type === "TEXTO") {
      const uploadProps = onUploadDocumentAsset
        ? {
            onUploadImage: async (file: File) => onUploadDocumentAsset(activeDocument, file)
          }
        : {};

      return (
        <DocumentsEditorText
          key={activeDocument.id}
          documentId={activeDocument.id}
          value={activeDraft}
          readOnly={isProviderOffline}
          provider={yjsProvider}
          currentUser={currentUser}
          members={members}
          activeCollaborators={activeDocumentCollaborators}
          {...uploadProps}
          onChange={handleDraftChange}
        />
      );
    }

    if (activeDocument.type === "DIAGRAMA") {
      const diagramProps = {
        ...(activeDocument.diagramEngine !== undefined
          ? { diagramEngine: activeDocument.diagramEngine }
          : {}),
        ...(activeDocument.diagramKind !== undefined
          ? { diagramKind: activeDocument.diagramKind }
          : {})
      };

      return (
        <DocumentsEditorDiagram
          key={activeDocument.id}
          documentId={activeDocument.id}
          value={activeDraft}
          readOnly={false}
          offlineMode="queue"
          connectionState={connectionState}
          provider={yjsProvider}
          currentUser={currentUser}
          {...(onDiagramLegacyMigration
            ? {
                onLegacyMigration: async (input: {
                  droppedPageIds: string[];
                  activePageId: string;
                  backupSnapshot: string;
                }) => {
                  await onDiagramLegacyMigration(activeDocument, input);
                }
              }
            : {})}
          {...diagramProps}
          onChange={handleDraftChange}
        />
      );
    }

    if (activeDocument.type === "TABLA") {
      return (
        <DocumentsEditorTable
          key={activeDocument.id}
          documentId={activeDocument.id}
          value={activeDraft}
          readOnly={isProviderOffline}
          provider={yjsProvider}
          currentUser={currentUser}
          onChange={handleDraftChange}
        />
      );
    }

    if (activeDocument.type === "WHITEBOARD") {
      return (
        <DocumentsEditorWhiteboard
          key={activeDocument.id}
          documentId={activeDocument.id}
          value={activeDraft}
          readOnly={isProviderOffline}
          provider={yjsProvider}
          currentUser={currentUser}
          onChange={handleDraftChange}
        />
      );
    }

    return (
      <DocumentsEditorPresentation
        key={activeDocument.id}
        documentId={activeDocument.id}
        value={activeDraft}
        readOnly={isProviderOffline}
        provider={yjsProvider}
        currentUser={currentUser}
        {...(onUploadDocumentAsset
          ? {
              onUploadImage: async (file: File) => onUploadDocumentAsset(activeDocument, file)
            }
          : {})}
        onChange={handleDraftChange}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocument?.id,
    activeDocument?.type,
    activeDocument?.diagramEngine,
    activeDocument?.diagramKind,
    activeDraft,
    isProviderOffline,
    yjsProvider,
    currentUser,
    members,
    activeDocumentCollaborators,
    connectionState,
    handleDraftChange,
    onDiagramLegacyMigration,
    onUploadDocumentAsset
  ]);

  const v2View = (
    <CollaborativeDocumentsModuleV2
      project={project}
      documents={documents}
      documentTypeMeta={DOCUMENT_TYPE_META}
      documentTypeOrder={DOCUMENT_TYPE_ORDER}
      loading={loading}
      errorMessage={errorMessage}
      search={search}
      setSearch={setSearch}
      collaboratorsByDocumentId={collaboratorsByDocumentId}
      activeDocument={activeDocument}
      activeDocumentCollaborators={activeDocumentCollaborators}
      currentUser={currentUser}
      connectionState={connectionState}
      syncLabel={syncLabelByState[syncState]}
      saveStatusBadge={saveStatusBadge}
      savingVersion={savingVersion}
      versionPanelOpen={versionPanelOpen}
      versions={versions}
      editorNode={editorNode}
      onRetry={onRetry ?? (() => {})}
      onCreateDocument={openCreateModal}
      onOpenDocument={openDocumentInV2}
      onRequestDocumentHistory={openDocumentHistoryInV2}
      onCloseDocument={() => {
        flushDirtyDraft();
        // Clear dirty flag synchronously so the activeDocument change effect
        // does not attempt a redundant flush after the provider is destroyed.
        const closingId = activeDocumentRef.current?.id;
        if (closingId) {
          dirtyByDocumentIdRef.current[closingId] = false;
          setDirtyByDocumentId((current) => {
            if (!current[closingId]) return current;
            return { ...current, [closingId]: false };
          });
        }
        onCloseDocument();
      }}
      onRenameDocument={onRenameDocument}
      onRequestRename={(document) => {
        setRenameTarget(document);
        setRenameValue(document.name);
      }}
      onRequestDelete={(document) => setDeleteTarget(document)}
      onSaveVersion={saveManualVersion}
      onToggleVersionPanel={() => {
        setVersionPanelOpen((current) => !current);
        if (!versionPanelOpen && activeDocument) {
          onLoadVersions?.(activeDocument);
        }
      }}
      onRestoreVersion={onRestoreVersion}
      onPreviewVersion={onPreviewVersion ?? (async () => "")}
      onOpenPreview={(title, payload) => {
        setPreviewTitle(title);
        setPreviewContent(payload);
      }}
      onDuplicateDocument={onDuplicateDocument}
      onToggleFavorite={onToggleFavorite}
      onRestoreFromTrash={onRestoreFromTrash}
      onFetchTrash={onFetchTrash}
      trashItems={trashItems}
      trashLoading={trashLoading}
      onBatchDelete={onBatchDelete}
      onBatchRestore={onBatchRestore}
      onCreateTemplate={onCreateTemplate}
      onFetchTemplates={onFetchTemplates}
      templates={templates}
    />
  );

  return (
    <section className="docs-shell h-full w-full overflow-hidden font-sans">
      {v2View}

      <UiModal
        open={createModalOpen}
        onClose={closeCreateModal}
        title="Nuevo documento"
        widthClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">¿Qué tipo de documento quieres crear?</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DOCUMENT_TYPE_ORDER.map((type) => {
              const meta = DOCUMENT_TYPE_META[type];
              const active = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-accent/30 bg-accent/8"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-2xl" aria-hidden>
                    {meta.icon}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{meta.label}</p>
                  <p className="text-xs text-slate-500">{meta.hint}</p>
                </button>
              );
            })}
          </div>

          {selectedType ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-accent">
                ⚡ Los cambios se sincronizan en tiempo real con otros colaboradores
              </p>
              <input
                autoFocus
                value={newDocumentName}
                onChange={(event) => setNewDocumentName(event.target.value)}
                placeholder={DOCUMENT_TYPE_META[selectedType].placeholder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-accent"
                maxLength={80}
              />
              {selectedType === "DIAGRAMA" ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tipo de diagrama
                  </span>
                  <select
                    value={selectedDiagramKind}
                    onChange={(event) => setSelectedDiagramKind(event.target.value as DiagramKind)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-accent"
                  >
                    {DIAGRAM_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateDocument()}
                  disabled={!newDocumentName.trim() || newDocumentName.trim().length > 80}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Crear y abrir
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </UiModal>

      <UiModal
        open={Boolean(renameTarget)}
        onClose={() => {
          setRenameTarget(null);
          setRenameValue("");
        }}
        title="Renombrar documento"
      >
        <div className="space-y-3">
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-accent"
            maxLength={80}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRenameTarget(null);
                setRenameValue("");
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!renameTarget || !renameValue.trim()}
              onClick={async () => {
                if (!renameTarget || !renameValue.trim()) {
                  return;
                }
                await onRenameDocument(renameTarget, renameValue.trim());
                setRenameTarget(null);
                setRenameValue("");
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </div>
      </UiModal>

      <UiModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar documento"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            El documento se moverá a papelera durante 7 días antes de purgarse automáticamente.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!deleteTarget) {
                  return;
                }
                await onDeleteDocument(deleteTarget);
                setDeleteTarget(null);
                if (activeDocument?.id === deleteTarget.id) {
                  onCloseDocument();
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Confirmar
            </button>
          </div>
        </div>
      </UiModal>

      <UiModal
        open={Boolean(previewContent)}
        onClose={() => {
          setPreviewContent(null);
          setPreviewTitle("");
        }}
        title={previewTitle || "Preview versión"}
        widthClassName="max-w-3xl"
      >
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          {previewContent}
        </pre>
      </UiModal>
    </section>
  );
};
