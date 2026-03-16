import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DocumentType
} from "@corelia/types";

import type {
  CollaboratorPresence,
  CollaborativeDocumentsV2Props,
  ExplorerRow,
  ExplorerSort,
  ExplorerTypeFilter
} from "@/components/collaborative-documents-module-v2-types";
import {
  compareRows,
  initialsFromName
} from "@/components/collaborative-documents-module-v2-utils";
import {
  documentsUiPreferencesDefaults,
  readDocumentsUiPreferences,
  writeDocumentsUiPreferences,
  type DocumentsExplorerDensity,
  type DocumentsExplorerViewMode,
  type DocumentsUiPreferences
} from "@/lib/documents-ui-preferences";

type UseCollaborativeDocumentsV2StateParams = Pick<
  CollaborativeDocumentsV2Props,
  | "documents"
  | "documentTypeMeta"
  | "documentTypeOrder"
  | "search"
  | "collaboratorsByDocumentId"
  | "activeDocument"
  | "onRenameDocument"
>;

type UseCollaborativeDocumentsV2StateResult = {
  preferences: DocumentsUiPreferences;
  typeFilter: ExplorerTypeFilter;
  setTypeFilter: (value: ExplorerTypeFilter) => void;
  sortBy: ExplorerSort;
  setSortBy: (value: ExplorerSort) => void;
  selectedDocumentId: string | null;
  setSelectedDocumentId: (value: string | null) => void;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  savingTitle: boolean;
  showTrash: boolean;
  setShowTrash: (value: boolean) => void;
  showFavorites: boolean;
  setShowFavorites: (value: boolean) => void;
  selectedIds: Set<string>;
  toggleDocSelection: (docId: string) => void;
  clearSelectedIds: () => void;
  templateSaveTarget: CollaborativeDocument | null;
  templateName: string;
  templateDesc: string;
  setTemplateName: (value: string) => void;
  setTemplateDesc: (value: string) => void;
  openTemplateSaveModal: (document: CollaborativeDocument) => void;
  closeTemplateSaveModal: () => void;
  restoreConfirm: { version: CollaborativeDocumentVersion } | null;
  setRestoreConfirm: (value: { version: CollaborativeDocumentVersion } | null) => void;
  restoringVersion: boolean;
  setRestoringVersion: (value: boolean) => void;
  svgPreview: { title: string; svg: string } | null;
  setSvgPreview: (value: { title: string; svg: string } | null) => void;
  typeCounts: Record<DocumentType, number>;
  rows: ExplorerRow[];
  favoriteRows: ExplorerRow[];
  filteredRows: ExplorerRow[];
  recentDocs: ExplorerRow[];
  toggleSidebar: () => void;
  setViewMode: (viewMode: DocumentsExplorerViewMode) => void;
  setDensity: (density: DocumentsExplorerDensity) => void;
  commitDocumentTitle: () => Promise<void>;
  renderCollaboratorAvatar: (user: CollaboratorPresence) => ReactNode;
  explorerDensityRowClass: string;
};

export const useCollaborativeDocumentsModuleV2State = ({
  documents,
  documentTypeMeta,
  documentTypeOrder,
  search,
  collaboratorsByDocumentId,
  activeDocument,
  onRenameDocument
}: UseCollaborativeDocumentsV2StateParams): UseCollaborativeDocumentsV2StateResult => {
  const [preferences, setPreferences] = useState<DocumentsUiPreferences>(
    documentsUiPreferencesDefaults
  );
  const [typeFilter, setTypeFilter] = useState<ExplorerTypeFilter>("ALL");
  const [sortBy, setSortBy] = useState<ExplorerSort>("updatedDesc");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templateSaveTarget, setTemplateSaveTarget] = useState<CollaborativeDocument | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState<{ version: CollaborativeDocumentVersion } | null>(null);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [svgPreview, setSvgPreview] = useState<{ title: string; svg: string } | null>(null);

  useEffect(() => {
    setPreferences(readDocumentsUiPreferences());
  }, []);

  useEffect(() => {
    writeDocumentsUiPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    setTitleDraft(activeDocument?.name ?? "");
    if (!activeDocument) {
      setSelectedDocumentId(null);
    }
  }, [activeDocument?.id, activeDocument?.name, activeDocument]);

  const typeCounts = useMemo(() => {
    return documentTypeOrder.reduce(
      (acc, type) => {
        acc[type] = documents[type].length;
        return acc;
      },
      {
        TEXTO: 0,
        DIAGRAMA: 0,
        TABLA: 0,
        WHITEBOARD: 0,
        PRESENTACION: 0
      } as Record<DocumentType, number>
    );
  }, [documents, documentTypeOrder]);

  const rows = useMemo<ExplorerRow[]>(() => {
    return documentTypeOrder.flatMap((type) =>
      documents[type].map((document) => {
        const meta = documentTypeMeta[type];
        const favoriteValue = (document as CollaborativeDocument & { isFavorite?: boolean }).isFavorite;
        return {
          id: document.id,
          type,
          typeLabel: meta.label,
          typeHint: meta.hint,
          typeAccent: meta.accent,
          name: document.name,
          updatedAt: document.updatedAt,
          currentVersion: document.currentVersion,
          document,
          collaborators: collaboratorsByDocumentId.get(document.id) ?? [],
          ...(favoriteValue !== undefined ? { isFavorite: favoriteValue } : {})
        };
      })
    );
  }, [collaboratorsByDocumentId, documentTypeMeta, documentTypeOrder, documents]);

  const recentDocs = useMemo(() => {
    return [...rows]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (typeFilter === "TRASH" || typeFilter === "FAVORITES") {
      return [];
    }

    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => (typeFilter === "ALL" ? true : row.type === typeFilter))
      .filter((row) => {
        if (!query) {
          return true;
        }

        const content = `${row.name} ${row.typeLabel} ${row.typeHint}`.toLowerCase();
        return content.includes(query);
      })
      .sort((left, right) => compareRows(left, right, sortBy));
  }, [rows, search, sortBy, typeFilter]);

  const favoriteRows = useMemo(() => {
    return rows.filter((row) => row.isFavorite);
  }, [rows]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const clearSelectedIds = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openTemplateSaveModal = useCallback((document: CollaborativeDocument) => {
    setTemplateSaveTarget(document);
    setTemplateName(document.name);
    setTemplateDesc("");
  }, []);

  const closeTemplateSaveModal = useCallback(() => {
    setTemplateSaveTarget(null);
    setTemplateName("");
    setTemplateDesc("");
  }, []);

  const toggleSidebar = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      sidebarCollapsed: !current.sidebarCollapsed
    }));
  }, []);

  const setViewMode = useCallback((viewMode: DocumentsExplorerViewMode) => {
    setPreferences((current) => ({
      ...current,
      viewMode
    }));
  }, []);

  const setDensity = useCallback((density: DocumentsExplorerDensity) => {
    setPreferences((current) => ({
      ...current,
      density
    }));
  }, []);

  const commitDocumentTitle = useCallback(async () => {
    if (!activeDocument) {
      return;
    }

    const nextName = titleDraft.trim();
    if (!nextName || nextName === activeDocument.name) {
      setTitleDraft(activeDocument.name);
      return;
    }

    setSavingTitle(true);
    try {
      await onRenameDocument(activeDocument, nextName);
    } finally {
      setSavingTitle(false);
    }
  }, [activeDocument, onRenameDocument, titleDraft]);

  const renderCollaboratorAvatar = useCallback(
    (user: CollaboratorPresence) => (
      <span
        key={user.userId}
        title={user.name}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white text-[10px] font-semibold text-white"
        style={{ backgroundColor: user.color }}
      >
        {initialsFromName(user.name)}
      </span>
    ),
    []
  );

  const explorerDensityRowClass =
    preferences.density === "compact" ? "h-10 text-xs" : "h-12 text-sm";

  return {
    preferences,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    selectedDocumentId,
    setSelectedDocumentId,
    titleDraft,
    setTitleDraft,
    savingTitle,
    showTrash,
    setShowTrash,
    showFavorites,
    setShowFavorites,
    selectedIds,
    toggleDocSelection,
    clearSelectedIds,
    templateSaveTarget,
    templateName,
    templateDesc,
    setTemplateName,
    setTemplateDesc,
    openTemplateSaveModal,
    closeTemplateSaveModal,
    restoreConfirm,
    setRestoreConfirm,
    restoringVersion,
    setRestoringVersion,
    svgPreview,
    setSvgPreview,
    typeCounts,
    rows,
    favoriteRows,
    filteredRows,
    recentDocs,
    toggleSidebar,
    setViewMode,
    setDensity,
    commitDocumentTitle,
    renderCollaboratorAvatar,
    explorerDensityRowClass
  };
};
