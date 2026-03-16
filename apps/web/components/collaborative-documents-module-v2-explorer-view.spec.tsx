// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CollaborativeDocument, DocumentType } from "@corelia/types";

import { CollaborativeDocumentsModuleV2ExplorerView } from "@/components/collaborative-documents-module-v2-explorer-view";
import type { ExplorerRow } from "@/components/collaborative-documents-module-v2-types";
import { documentsUiPreferencesDefaults } from "@/lib/documents-ui-preferences";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
});

afterEach(() => {
  cleanup();
});

const buildDocument = (id: string, type: DocumentType, name: string): CollaborativeDocument => ({
  id,
  projectId: "project-1",
  folderId: "folder-1",
  type,
  name,
  yDocName: `ydoc-${id}`,
  currentVersion: 1,
  createdById: "user-1",
  createdByName: "Usuario Uno",
  createdAt: "2026-03-09T12:00:00.000Z",
  updatedAt: "2026-03-09T13:00:00.000Z",
  deletedAt: null,
  purgeAt: null,
  diagramEngine: null,
  diagramKind: null
});

const typeMeta = {
  TEXTO: {
    label: "Texto",
    icon: "📝",
    accent: "#4f6ef7",
    hint: "Documento de texto",
    placeholder: "Nombre texto"
  },
  DIAGRAMA: {
    label: "Diagramas",
    icon: "🔷",
    accent: "#8b5cf6",
    hint: "Flujos",
    placeholder: "Nombre diagrama"
  },
  TABLA: {
    label: "Tablas",
    icon: "📊",
    accent: "#10b981",
    hint: "Hojas de cálculo",
    placeholder: "Nombre tabla"
  },
  WHITEBOARD: {
    label: "Pizarra",
    icon: "🎨",
    accent: "#f97316",
    hint: "Pizarra colaborativa",
    placeholder: "Nombre pizarra"
  },
  PRESENTACION: {
    label: "Presentaciones",
    icon: "🎯",
    accent: "#ec4899",
    hint: "Diapositivas",
    placeholder: "Nombre presentación"
  }
} as const;

const buildRow = (document: CollaborativeDocument): ExplorerRow => ({
  id: document.id,
  type: document.type,
  typeLabel: typeMeta[document.type].label,
  typeHint: typeMeta[document.type].hint,
  typeAccent: typeMeta[document.type].accent,
  name: document.name,
  updatedAt: document.updatedAt,
  currentVersion: document.currentVersion,
  document,
  collaborators: []
});

const buildProps = () => {
  const docText = buildDocument("doc-text", "TEXTO", "Acta semanal");
  const docTable = buildDocument("doc-table", "TABLA", "Presupuesto 2026");
  const rowText = buildRow(docText);
  const rowTable = buildRow(docTable);

  return {
    project: {
      id: "project-1",
      name: "Corelia"
    },
    search: "",
    setSearch: vi.fn(),
    sortBy: "updatedDesc" as const,
    setSortBy: vi.fn(),
    preferences: {
      ...documentsUiPreferencesDefaults,
      viewMode: "list" as const,
      density: "comfortable" as const,
      sidebarCollapsed: false
    },
    setViewMode: vi.fn(),
    setDensity: vi.fn(),
    toggleSidebar: vi.fn(),
    typeFilter: "ALL" as const,
    setTypeFilter: vi.fn(),
    showTrash: false,
    setShowTrash: vi.fn(),
    showFavorites: false,
    setShowFavorites: vi.fn(),
    rows: [rowText, rowTable],
    documentTypeOrder: ["TEXTO", "DIAGRAMA", "TABLA", "WHITEBOARD", "PRESENTACION"] as DocumentType[],
    documentTypeMeta: typeMeta,
    typeCounts: {
      TEXTO: 1,
      DIAGRAMA: 0,
      TABLA: 1,
      WHITEBOARD: 0,
      PRESENTACION: 0
    },
    favoriteRows: [],
    filteredRows: [rowText, rowTable],
    recentDocs: [rowTable, rowText],
    loading: false,
    errorMessage: null,
    onRetry: vi.fn(),
    onCreateDocument: vi.fn(),
    onOpenDocument: vi.fn(),
    onRequestDocumentHistory: vi.fn(),
    onRequestRename: vi.fn(),
    onRequestDelete: vi.fn(),
    onDuplicateDocument: vi.fn().mockResolvedValue(undefined),
    onToggleFavorite: vi.fn().mockResolvedValue(undefined),
    onRestoreFromTrash: vi.fn().mockResolvedValue(undefined),
    onFetchTrash: vi.fn(),
    trashItems: [],
    trashLoading: false,
    onBatchDelete: vi.fn().mockResolvedValue(undefined),
    onBatchRestore: vi.fn().mockResolvedValue(undefined),
    selectedIds: new Set<string>(),
    toggleDocSelection: vi.fn(),
    clearSelectedIds: vi.fn(),
    selectedDocumentId: null,
    setSelectedDocumentId: vi.fn(),
    explorerDensityRowClass: "h-12 text-sm",
    renderCollaboratorAvatar: vi.fn().mockImplementation((user) => <span key={user.userId}>{user.name}</span>)
  };
};

describe("CollaborativeDocumentsModuleV2ExplorerView", () => {
  it("propaga búsqueda y abre filtro de papelera", () => {
    const props = buildProps();
    render(<CollaborativeDocumentsModuleV2ExplorerView {...props} />);

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o tipo…"), {
      target: { value: "presupuesto" }
    });
    expect(props.setSearch).toHaveBeenCalledWith("presupuesto");

    fireEvent.click(screen.getByTestId("documents-v2-filter-TRASH"));
    expect(props.setTypeFilter).toHaveBeenCalledWith("TRASH");
    expect(props.setShowTrash).toHaveBeenCalledWith(true);
    expect(props.setShowFavorites).toHaveBeenCalledWith(false);
    expect(props.onFetchTrash).toHaveBeenCalledTimes(1);
  });

  it("ejecuta acciones por fila y batch delete", async () => {
    const props = buildProps();
    props.selectedIds = new Set(["doc-text", "doc-table"]);
    render(<CollaborativeDocumentsModuleV2ExplorerView {...props} />);

    fireEvent.click(screen.getByTestId("documents-v2-action-open-doc-table"));
    expect(props.onOpenDocument).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("documents-v2-action-history-doc-table"));
    expect(props.onRequestDocumentHistory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar seleccionados" }));
    expect(props.onBatchDelete).toHaveBeenCalledWith(["doc-text", "doc-table"]);
    await waitFor(() => {
      expect(props.clearSelectedIds).toHaveBeenCalledTimes(1);
    });
  });
});
