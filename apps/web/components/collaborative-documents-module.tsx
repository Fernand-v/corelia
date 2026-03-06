"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sora } from "next/font/google";
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

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

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
    label: "Whiteboard",
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
  }) => Promise<CollaborativeDocument | null>;
  onOpenDocument: (document: CollaborativeDocument) => void;
  onCloseDocument: () => void;
  onDeleteDocument: (document: CollaborativeDocument) => Promise<void>;
  onRenameDocument: (document: CollaborativeDocument, newName: string) => Promise<void>;
  onSaveVersion: (document: CollaborativeDocument, payload: DocumentSavePayload) => Promise<void>;
  onUploadDocumentAsset?: (
    document: CollaborativeDocument,
    file: File
  ) => Promise<{ url: string } | null>;
  onRestoreVersion: (document: CollaborativeDocument, version: CollaborativeDocumentVersion) => Promise<void>;
  onLoadVersions?: (document: CollaborativeDocument) => void;
  onPreviewVersion?: (document: CollaborativeDocument, version: CollaborativeDocumentVersion) => Promise<string | null>;
};

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const initialsFromName = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "??";
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
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
  onUploadDocumentAsset,
  onRestoreVersion,
  onLoadVersions,
  onPreviewVersion
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

  const query = search.trim().toLowerCase();

  const filteredDocuments = useMemo(() => {
    if (!query) {
      return documents;
    }

    const next = {
      TEXTO: [] as CollaborativeDocument[],
      DIAGRAMA: [] as CollaborativeDocument[],
      TABLA: [] as CollaborativeDocument[],
      WHITEBOARD: [] as CollaborativeDocument[],
      PRESENTACION: [] as CollaborativeDocument[]
    };

    for (const type of DOCUMENT_TYPE_ORDER) {
      next[type] = documents[type].filter((document) =>
        document.name.toLowerCase().includes(query)
      );
    }

    return next;
  }, [documents, query]);

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

  const flushDirtyDraft = useCallback(() => {
    if (!activeDocument || isProviderOffline) {
      return;
    }

    const currentPayload = editorDrafts[activeDocument.id]?.trim() ?? "";
    const isDirty = dirtyByDocumentId[activeDocument.id] ?? false;

    if (!currentPayload || !isDirty) {
      return;
    }

    void onSaveVersion(activeDocument, buildSavePayload(activeDocument, currentPayload, "AUTO"))
      .then(() => {
        markSavedState(activeDocument.id);
        onLoadVersions?.(activeDocument);
      })
      .catch(() => undefined);
  }, [
    activeDocument,
    buildSavePayload,
    dirtyByDocumentId,
    editorDrafts,
    isProviderOffline,
    markSavedState,
    onLoadVersions,
    onSaveVersion
  ]);

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
      window.open(
        `/documents-editor?id=${encodeURIComponent(created.id)}&projectId=${encodeURIComponent(project.id)}&projectName=${encodeURIComponent(project.name)}`,
        "_blank"
      );
    }
  };

  const saveManualVersion = async () => {
    if (!activeDocument || savingVersion) {
      return;
    }

    const payload = activeDraft.trim();
    if (!payload) {
      return;
    }

    setSavingVersion(true);
    try {
      await onSaveVersion(activeDocument, buildSavePayload(activeDocument, payload, "MANUAL"));
      markSavedState(activeDocument.id);
      onLoadVersions?.(activeDocument);
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

      void onSaveVersion(activeDocument, buildSavePayload(activeDocument, currentPayload, "AUTO"))
        .then(() => {
          markSavedState(activeDocument.id);
          onLoadVersions?.(activeDocument);
        })
        .catch(() => undefined);
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    activeDocument,
    buildSavePayload,
    dirtyByDocumentId,
    editorDrafts,
    isProviderOffline,
    markSavedState,
    onLoadVersions,
    onSaveVersion
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

  const renderEditorByType = () => {
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
          provider={yjsProvider}
          currentUser={currentUser}
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
  };

  const explorerView = (
    <div className="flex h-full flex-col overflow-hidden bg-[#f5f7fa]">
      <header className="border-b border-[rgba(0,0,0,0.07)] bg-white/90 px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] backdrop-blur-sm md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-400">{project.name} · Documentos</p>
            <h1 className={`${sora.className} text-xl font-semibold text-slate-900`}>Documentos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar documento…"
                className="h-9 w-56 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white/80 pl-8 pr-3 text-sm text-slate-700 outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover active:scale-[0.97]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Nuevo documento
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={`doc-skeleton-${index}`}
                className="h-36 animate-pulse rounded-2xl border border-[#e2e8f2] bg-white"
              />
            ))}
          </div>
        ) : null}

        {!loading && errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{errorMessage}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
              >
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !errorMessage ? (
          <div className="space-y-5">
            {DOCUMENT_TYPE_ORDER.map((type) => {
              const meta = DOCUMENT_TYPE_META[type];
              const items = filteredDocuments[type];

              return (
                <section key={type}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-base shadow-sm"
                        style={{ backgroundColor: `${meta.accent}18`, border: `1px solid ${meta.accent}30` }}
                      >
                        <span aria-hidden>{meta.icon}</span>
                      </div>
                      <div>
                        <h2 className={`${sora.className} text-sm font-semibold text-slate-800`}>
                          {meta.label}
                        </h2>
                        <p className="text-[11px] text-slate-400">{meta.hint}</p>
                      </div>
                      <span className="rounded-full border border-[rgba(0,0,0,0.07)] bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm">
                        {items.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateModal(type)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.97]"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                      Nuevo
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => openCreateModal(type)}
                      className="flex h-24 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgba(0,0,0,0.12)] bg-white/60 text-sm text-slate-400 transition-colors hover:border-accent/40 hover:bg-white/90 hover:text-accent"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      Crear primer {meta.label.toLowerCase()}
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {items.map((document) => {
                        const liveCollaborators = collaboratorsByDocumentId.get(document.id) ?? [];
                        const openUrl = `/documents-editor?id=${encodeURIComponent(document.id)}&projectId=${encodeURIComponent(project.id)}&projectName=${encodeURIComponent(project.name)}`;
                        return (
                          <article
                            key={document.id}
                            className="group relative overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
                          >
                            <div
                              className="h-1.5 w-full"
                              style={{ backgroundColor: meta.accent }}
                            />
                            <div className="p-4">
                              <button
                                type="button"
                                onClick={() => window.open(openUrl, "_blank")}
                                className="w-full text-left"
                              >
                                <div className="mb-3 flex items-start justify-between gap-2">
                                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{document.name}</h3>
                                  <span className="shrink-0 rounded-full border border-[rgba(0,0,0,0.07)] bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    v{document.currentVersion}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {formatDateTime(document.updatedAt)}
                                </p>
                                {liveCollaborators.length > 0 ? (
                                  <div className="mt-3 flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                      En vivo
                                    </span>
                                    <div className="flex -space-x-2">
                                      {liveCollaborators.slice(0, 4).map((user) => (
                                        <span
                                          key={`${document.id}-${user.userId}`}
                                          title={user.name}
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-white"
                                          style={{ backgroundColor: user.color }}
                                        >
                                          {initialsFromName(user.name)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </button>

                              <div className="mt-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => window.open(openUrl, "_blank")}
                                  className="flex-1 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 py-1.5 text-center text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                >
                                  Abrir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenameTarget(document);
                                    setRenameValue(document.name);
                                  }}
                                  className="rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                                >
                                  Renombrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(document)}
                                  className="rounded-lg border border-red-100 bg-white px-2 py-1.5 text-xs font-semibold text-red-500 shadow-sm transition-colors hover:bg-red-50"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );

  const editorView = activeDocument ? (
    <div className="flex h-full flex-col overflow-hidden bg-[#f5f7fa]">
      <header className="border-b border-[rgba(0,0,0,0.07)] bg-white/95 px-5 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] backdrop-blur-sm md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onCloseDocument}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.97]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Documentos
            </button>
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-[11px] text-slate-400">
                {DOCUMENT_TYPE_META[activeDocument.type].label}
              </p>
              <button
                type="button"
                onClick={() => {
                  setRenameTarget(activeDocument);
                  setRenameValue(activeDocument.name);
                }}
                className={`${sora.className} truncate text-left text-sm font-semibold text-slate-900 hover:text-accent transition-colors`}
                title="Clic para renombrar"
              >
                {activeDocument.name}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                syncLabelByState[syncState].tone
              }`}
            >
              {syncLabelByState[syncState].label}
            </span>
            {saveStatusBadge ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${saveStatusBadge.tone}`}>
                {saveStatusBadge.label}
              </span>
            ) : null}
            <span className="rounded-full border border-[rgba(0,0,0,0.09)] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {activeDocumentCollaborators.length > 0
                ? `${activeDocumentCollaborators.length} colaborando`
                : "Sin colaboradores en vivo"}
            </span>

            <div className="flex -space-x-2">
              {activeDocumentCollaborators.map((user) => (
                <span
                  key={`active-doc-${user.userId}`}
                  title={user.name}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {initialsFromName(user.name)}
                </span>
              ))}
              {activeDocumentCollaborators.length === 0 ? (
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white"
                  style={{ backgroundColor: currentUser.color }}
                  title={currentUser.name}
                >
                  {initialsFromName(currentUser.name)}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={saveManualVersion}
              disabled={savingVersion}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {savingVersion ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setVersionPanelOpen((current) => !current);
                if (!versionPanelOpen) {
                  onLoadVersions?.(activeDocument);
                }
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-sm transition-colors active:scale-[0.97] ${
                versionPanelOpen
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-[rgba(0,0,0,0.09)] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Historial
            </button>
          </div>
        </div>
      </header>

      {connectionState === "reconnecting" ? (
        <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-2 text-xs font-medium text-yellow-800">
          🟡 Reconectando… El documento se activará en modo colaborativo al restablecer la conexión.
        </div>
      ) : null}

      {connectionState === "offline" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-800">
          🔴 Sin conexión — El documento está en modo solo lectura hasta restablecer la conexión.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{renderEditorByType()}</section>

        {versionPanelOpen ? (
          <aside className="w-72 shrink-0 border-l border-[rgba(0,0,0,0.07)] bg-white/95 p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className={`${sora.className} text-xs font-semibold uppercase tracking-wider text-slate-500`}>Historial</h3>
              <span className="rounded-full border border-[rgba(0,0,0,0.07)] bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{versions.length}</span>
            </header>
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 10rem)" }}>
              {versions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[rgba(0,0,0,0.1)] p-4 text-center text-xs text-slate-400">
                  Sin versiones registradas.
                </p>
              ) : (
                versions.map((version) => (
                  <article
                    key={version.id}
                    className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-3 text-xs text-slate-600 shadow-sm"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">v{version.versionNumber}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          version.kind === "MANUAL"
                            ? "bg-accent/10 text-accent"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {version.kind === "MANUAL" ? "Manual" : "Auto"}
                      </span>
                    </div>
                    <p className="text-slate-400">{formatDateTime(version.createdAt)}</p>
                    <p className="truncate text-slate-500">{version.createdByName ?? version.createdById}</p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onRestoreVersion(activeDocument, version)}
                        className="rounded-lg border border-[rgba(0,0,0,0.09)] bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        Restaurar
                      </button>
                      {onPreviewVersion ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const preview = await onPreviewVersion(activeDocument, version);
                            setPreviewTitle(`Preview v${version.versionNumber}`);
                            setPreviewContent(preview);
                          }}
                          className="rounded-lg border border-[rgba(0,0,0,0.09)] bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          Ver
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <section className="docs-shell h-full w-full overflow-hidden font-sans">
      {activeDocument ? editorView : explorerView}

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
