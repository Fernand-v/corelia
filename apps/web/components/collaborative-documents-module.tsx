"use client";

import { useEffect, useMemo, useState } from "react";
import { DM_Sans, Sora } from "next/font/google";
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

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"]
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
    hint: "Word / Notion style",
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
    hint: "Pizarra colaborativa estilo Miro",
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

type DocsTheme = "light" | "dark";

const DOCS_THEME_STORAGE_KEY = "corelia_docs_theme";

export type DocumentEditorSyncState = "synced" | "saving" | "reconnecting" | "offline";

export type DocumentSavePayload = {
  kind: "MANUAL" | "AUTO";
  content: string;
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
    label: "Guardando...",
    tone: "bg-amber-100 text-amber-700"
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
  const [docsTheme, setDocsTheme] = useState<DocsTheme>("light");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(DOCS_THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setDocsTheme(saved);
      return;
    }

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    setDocsTheme(systemTheme);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(DOCS_THEME_STORAGE_KEY, docsTheme);
  }, [docsTheme]);

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
      onLoadVersions?.(created);
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
      await onSaveVersion(activeDocument, {
        kind: "MANUAL",
        content: payload
      });
      setDirtyByDocumentId((current) => ({
        ...current,
        [activeDocument.id]: false
      }));
      onLoadVersions?.(activeDocument);
    } finally {
      setSavingVersion(false);
    }
  };

  useEffect(() => {
    if (!activeDocument || isProviderOffline) {
      return;
    }

    const interval = window.setInterval(() => {
      const currentPayload = editorDrafts[activeDocument.id]?.trim() ?? "";
      const isDirty = dirtyByDocumentId[activeDocument.id] ?? false;

      if (!currentPayload || !isDirty) {
        return;
      }

      void onSaveVersion(activeDocument, {
        kind: "AUTO",
        content: currentPayload
      })
        .then(() => {
          setDirtyByDocumentId((current) => ({
            ...current,
            [activeDocument.id]: false
          }));
          onLoadVersions?.(activeDocument);
        })
        .catch(() => undefined);
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeDocument, dirtyByDocumentId, editorDrafts, isProviderOffline, onLoadVersions, onSaveVersion]);

  const renderEditorByType = () => {
    if (!activeDocument) {
      return null;
    }
    const handleDraftChange = (value: string) => {
      setEditorDrafts((current) => ({
        ...current,
        [activeDocument.id]: value
      }));
      setDirtyByDocumentId((current) => ({
        ...current,
        [activeDocument.id]: true
      }));
    };

    if (activeDocument.type === "TEXTO") {
      const uploadProps = onUploadDocumentAsset
        ? {
            onUploadImage: async (file: File) => onUploadDocumentAsset(activeDocument, file)
          }
        : {};

      return (
        <DocumentsEditorText
          documentId={activeDocument.id}
          value={activeDraft}
          readOnly={isProviderOffline}
          provider={yjsProvider}
          currentUser={currentUser}
          members={members}
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
          documentId={activeDocument.id}
          value={activeDraft}
          readOnly={isProviderOffline}
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
    <div className="flex h-full flex-col overflow-hidden bg-[#f0f4f9]">
      <header className="border-b border-[#e2e8f2] bg-white px-5 py-4 shadow-sm md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Proyecto › Documentos</p>
            <h1 className={`${sora.className} text-xl font-semibold text-slate-900`}>Documentos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar documento"
              className="h-10 w-64 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => setDocsTheme((current) => (current === "light" ? "dark" : "light"))}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {docsTheme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#4f6ef7] px-4 text-sm font-semibold text-white hover:bg-[#3f60ef]"
            >
              <span aria-hidden>+</span>
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
          <div className="space-y-6">
            {DOCUMENT_TYPE_ORDER.map((type) => {
              const meta = DOCUMENT_TYPE_META[type];
              const items = filteredDocuments[type];

              return (
                <section
                  key={type}
                  className="rounded-2xl border border-[#e2e8f2] bg-white p-4 shadow-[0_2px_12px_rgba(15,27,45,0.07)] md:p-5"
                >
                  <header className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        {meta.icon}
                      </span>
                      <div>
                        <h2 className={`${sora.className} text-lg font-semibold text-slate-900`}>
                          {meta.label}
                        </h2>
                        <p className="text-xs text-slate-500">{meta.hint}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {items.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateModal(type)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-600 hover:bg-slate-50"
                    >
                      +
                    </button>
                  </header>

                  {items.length === 0 ? (
                    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      Sin documentos · Crea el primero con +
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {items.map((document, index) => {
                        const liveCollaborators = collaboratorsByDocumentId.get(document.id) ?? [];
                        return (
                          <article
                            key={document.id}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
                            style={{
                              animationDelay: `${index * 45}ms`
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onOpenDocument(document);
                                onLoadVersions?.(document);
                              }}
                              className="w-full text-left"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <span className="text-3xl" aria-hidden>
                                  {meta.icon}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  v{document.currentVersion}
                                </span>
                              </div>
                              <h3 className="truncate text-sm font-semibold text-slate-900">{document.name}</h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Modificado: {formatDateTime(document.updatedAt)}
                              </p>
                              {liveCollaborators.length > 0 ? (
                                <div className="mt-3 flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                                    En vivo
                                  </span>
                                  <div className="flex -space-x-2">
                                    {liveCollaborators.slice(0, 4).map((user) => (
                                      <span
                                        key={`${document.id}-${user.userId}`}
                                        title={user.name}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
                                        style={{ backgroundColor: user.color }}
                                      >
                                        {initialsFromName(user.name)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </button>

                            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex translate-y-2 items-center justify-end gap-1 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenDocument(document);
                                  onLoadVersions?.(document);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                              >
                                Abrir
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameTarget(document);
                                  setRenameValue(document.name);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                              >
                                Renombrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(document)}
                                className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600"
                              >
                                Eliminar
                              </button>
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
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <header className="border-b border-[#e2e8f2] bg-white px-5 py-3 shadow-sm md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onCloseDocument}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">
                Documentos › {DOCUMENT_TYPE_META[activeDocument.type].label} › {activeDocument.name}
              </p>
              <button
                type="button"
                onClick={() => {
                  setRenameTarget(activeDocument);
                  setRenameValue(activeDocument.name);
                }}
                className={`${sora.className} truncate text-left text-lg font-semibold text-slate-900`}
              >
                {activeDocument.name}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDocsTheme((current) => (current === "light" ? "dark" : "light"))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {docsTheme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                syncLabelByState[syncState].tone
              }`}
            >
              {syncLabelByState[syncState].label}
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Guardar versión
            </button>
            <button
              type="button"
              onClick={() => {
                setVersionPanelOpen((current) => !current);
                if (!versionPanelOpen) {
                  onLoadVersions?.(activeDocument);
                }
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Historial
            </button>
          </div>
        </div>
      </header>

      {connectionState === "reconnecting" ? (
        <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-2 text-xs font-medium text-yellow-800">
          🟡 Reconectando con Hocuspocus. Esperando sincronización en tiempo real.
        </div>
      ) : null}

      {connectionState === "offline" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-800">
          🔴 Modo lectura activado — Hocuspocus no disponible. El documento permanecerá en solo lectura
          hasta reconexión.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <section className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] p-4 md:p-6">{renderEditorByType()}</section>

        {versionPanelOpen ? (
          <aside className="w-full max-w-sm border-l border-slate-200 bg-white p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className={`${sora.className} text-sm font-semibold text-slate-900`}>Historial de versiones</h3>
              <span className="text-xs text-slate-500">{versions.length}</span>
            </header>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
              {versions.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  Sin versiones registradas.
                </p>
              ) : (
                versions.map((version) => (
                  <article
                    key={version.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">v{version.versionNumber}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          version.kind === "MANUAL"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {version.kind === "MANUAL" ? "Manual" : "Auto"}
                      </span>
                    </div>
                    <p>{formatDateTime(version.createdAt)}</p>
                    <p className="truncate">{version.createdByName ?? version.createdById}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onRestoreVersion(activeDocument, version)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
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
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
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
    <section
      className={`${dmSans.className} docs-shell h-full w-full overflow-hidden`}
      data-docs-theme={docsTheme}
    >
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
                      ? "border-blue-300 bg-blue-50"
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
              <p className="text-xs font-medium text-blue-700">
                ⚡ Este documento se sincroniza en tiempo real con Y.js
              </p>
              <input
                autoFocus
                value={newDocumentName}
                onChange={(event) => setNewDocumentName(event.target.value)}
                placeholder={DOCUMENT_TYPE_META[selectedType].placeholder}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
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
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
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
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
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
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
