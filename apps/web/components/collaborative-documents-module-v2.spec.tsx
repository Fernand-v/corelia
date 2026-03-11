// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DocumentType
} from "@corelia/types";

import {
  type DocumentEditorSyncState
} from "@/components/collaborative-documents-module";
import { CollaborativeDocumentsModuleV2 } from "@/components/collaborative-documents-module-v2";

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

const buildVersion = (id: string, number: number): CollaborativeDocumentVersion => ({
  id,
  documentId: "doc-text",
  versionNumber: number,
  kind: "MANUAL",
  snapshotPath: `/versions/${id}.json`,
  snapshotSizeBytes: 120,
  createdById: "user-1",
  createdByName: "Usuario Uno",
  createdAt: "2026-03-09T13:30:00.000Z"
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

const buildBaseProps = () => {
  const docs: Record<DocumentType, CollaborativeDocument[]> = {
    TEXTO: [buildDocument("doc-text", "TEXTO", "Acta semanal")],
    DIAGRAMA: [],
    TABLA: [buildDocument("doc-table", "TABLA", "Presupuesto 2026")],
    WHITEBOARD: [],
    PRESENTACION: []
  };

  return {
    project: {
      id: "project-1",
      name: "Corelia"
    },
    documents: docs,
    documentTypeMeta: typeMeta,
    documentTypeOrder: ["TEXTO", "DIAGRAMA", "TABLA", "WHITEBOARD", "PRESENTACION"] as DocumentType[],
    loading: false,
    errorMessage: null,
    search: "",
    setSearch: vi.fn(),
    collaboratorsByDocumentId: new Map(),
    activeDocument: null as CollaborativeDocument | null,
    activeDocumentCollaborators: [],
    currentUser: {
      id: "user-1",
      name: "Usuario Uno",
      color: "#4f6ef7"
    },
    connectionState: "connected" as const,
    syncState: "synced" as DocumentEditorSyncState,
    syncLabel: {
      label: "Conectado",
      tone: "bg-emerald-100 text-emerald-700"
    },
    saveStatusBadge: null,
    savingVersion: false,
    versionPanelOpen: false,
    versions: [buildVersion("version-1", 1)],
    editorNode: <div data-testid="editor-node">Editor</div>,
    onRetry: vi.fn(),
    onCreateDocument: vi.fn(),
    onOpenDocument: vi.fn(),
    onRequestDocumentHistory: vi.fn(),
    onCloseDocument: vi.fn(),
    onRenameDocument: vi.fn(),
    onRequestRename: vi.fn(),
    onRequestDelete: vi.fn(),
    onSaveVersion: vi.fn(),
    onToggleVersionPanel: vi.fn(),
    onRestoreVersion: vi.fn(),
    onPreviewVersion: vi.fn(),
    onOpenPreview: vi.fn()
  };
};

describe("CollaborativeDocumentsModuleV2", () => {
  it("filtra por tipo y dispara acciones de abrir/historial", async () => {
    const props = buildBaseProps();
    render(<CollaborativeDocumentsModuleV2 {...props} />);

    expect(screen.getByTestId("documents-v2-row-doc-text")).toBeInTheDocument();
    expect(screen.getByTestId("documents-v2-row-doc-table")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("documents-v2-filter-TABLA"));

    expect(screen.queryByTestId("documents-v2-row-doc-text")).not.toBeInTheDocument();
    expect(screen.getByTestId("documents-v2-row-doc-table")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("documents-v2-action-open-doc-table"));
    expect(props.onOpenDocument).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("documents-v2-action-history-doc-table"));
    expect(props.onRequestDocumentHistory).toHaveBeenCalledTimes(1);
  });

  it("propaga cambios de búsqueda al callback externo", () => {
    const props = buildBaseProps();
    render(<CollaborativeDocumentsModuleV2 {...props} />);

    const input = screen.getByPlaceholderText("Buscar por nombre o tipo…");
    fireEvent.change(input, { target: { value: "presupuesto" } });

    expect(props.setSearch).toHaveBeenCalledWith("presupuesto");
  });

  it("renderiza shell de editor y permite renombrar/guardar", async () => {
    const baseProps = buildBaseProps();
    const activeDocument = baseProps.documents.TEXTO[0]!;
    const props = {
      ...baseProps,
      activeDocument,
      onRenameDocument: vi.fn().mockResolvedValue(undefined)
    };

    render(<CollaborativeDocumentsModuleV2 {...props} />);

    expect(screen.getByTestId("documents-v2-editor")).toBeInTheDocument();
    expect(screen.getByTestId("editor-node")).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue(activeDocument.name);
    fireEvent.change(titleInput, { target: { value: "Acta semanal actualizada" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(props.onRenameDocument).toHaveBeenCalledWith(
        activeDocument,
        "Acta semanal actualizada"
      );
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Guardar versión" })[0]!);
    expect(props.onSaveVersion).toHaveBeenCalledTimes(1);
  });

  it("abre el menú de acciones (lápiz) sin crash", async () => {
    const props = {
      ...buildBaseProps(),
      onDuplicateDocument: vi.fn().mockResolvedValue(undefined),
      onToggleFavorite: vi.fn().mockResolvedValue(undefined),
      onBatchDelete: vi.fn().mockResolvedValue(undefined),
      onBatchRestore: vi.fn().mockResolvedValue(undefined),
      onRestoreFromTrash: vi.fn().mockResolvedValue(undefined),
      onFetchTrash: vi.fn(),
      trashItems: [],
      trashLoading: false,
      onCreateTemplate: vi.fn().mockResolvedValue(undefined),
      onFetchTemplates: vi.fn(),
      templates: []
    };

    render(<CollaborativeDocumentsModuleV2 {...props} />);

    // Find the "Más acciones" button (pencil icon) for the first document row
    const actionButtons = screen.getAllByRole("button", { name: "Más acciones" });
    expect(actionButtons.length).toBeGreaterThan(0);

    // Click the pencil icon — this should open the menu without crash
    fireEvent.click(actionButtons[0]!);

    // The menu should render with "Renombrar", "Duplicar", "Eliminar"
    await waitFor(() => {
      expect(screen.getByText("Renombrar")).toBeInTheDocument();
      expect(screen.getByText("Duplicar")).toBeInTheDocument();
      expect(screen.getByText("Eliminar")).toBeInTheDocument();
    });
  });
});
