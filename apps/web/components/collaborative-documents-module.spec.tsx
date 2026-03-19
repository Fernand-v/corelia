// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { CollaborativeDocument, DocumentType } from "@corelia/types";
import { CollaborativeDocumentsModule } from "@/components/collaborative-documents-module";

type V2MockProps = {
  onCreateDocument: (type?: DocumentType) => void;
  onRequestRename: (document: CollaborativeDocument) => void;
  onRequestDelete: (document: CollaborativeDocument) => void;
  onCloseDocument: () => void;
  documents: Record<DocumentType, CollaborativeDocument[]>;
  editorNode: React.ReactNode;
  saveStatusBadge:
    | {
        label: string;
        tone: string;
      }
    | null;
};

let latestV2Props: V2MockProps | null = null;
let throwInV2Mock = false;

vi.mock("@/components/collaborative-documents-module-v2", () => ({
  CollaborativeDocumentsModuleV2: (props: V2MockProps) => {
    if (throwInV2Mock) {
      throw new Error("v2 boom");
    }
    latestV2Props = props;
    return (
      <div data-testid="documents-v2-mock">
        <button type="button" onClick={() => props.onCreateDocument("TEXTO")}>
          mock-open-create
        </button>
        <button type="button" onClick={() => props.onRequestRename(props.documents.TEXTO[0]!)}>
          mock-open-rename
        </button>
        <button type="button" onClick={() => props.onRequestDelete(props.documents.TEXTO[0]!)}>
          mock-open-delete
        </button>
        <button type="button" onClick={() => props.onCloseDocument()}>
          mock-close-document
        </button>
        <div data-testid="documents-v2-editor-slot">{props.editorNode}</div>
        {props.saveStatusBadge ? <span>{props.saveStatusBadge.label}</span> : null}
      </div>
    );
  }
}));

vi.mock("@/components/ui-modal", () => ({
  UiModal: ({
    open,
    title,
    children
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid={`ui-modal-${title}`}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
}));

vi.mock("@/components/documents-editor-diagram", () => ({
  DocumentsEditorDiagram: () => <div data-testid="documents-editor-diagram-mock" />
}));

vi.mock("@/components/documents-editor-whiteboard", () => ({
  DocumentsEditorWhiteboard: ({ onChange }: { onChange: (value: string) => void }) => (
    <button
      type="button"
      data-testid="documents-editor-whiteboard-mock-change"
      onClick={() => onChange("{\"elements\":[]}")}
    >
      mock-whiteboard-change
    </button>
  )
}));

vi.mock("@/components/onlyoffice-editor", () => ({
  OnlyOfficeEditor: () => <div data-testid="onlyoffice-editor-mock" />
}));

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

const buildModuleProps = () => {
  const docs: Record<DocumentType, CollaborativeDocument[]> = {
    TEXTO: [buildDocument("doc-text", "TEXTO", "Acta semanal")],
    DIAGRAMA: [],
    TABLA: [],
    WHITEBOARD: [buildDocument("doc-board", "WHITEBOARD", "Pizarra semanal")],
    PRESENTACION: []
  };
  const activeDocument = docs.TEXTO[0]!;
  const providerStub = {
    document: {}
  } as unknown as HocuspocusProvider;

  return {
    project: {
      id: "project-1",
      name: "Corelia"
    },
    documents: docs,
    currentUser: {
      id: "user-1",
      name: "Usuario Uno",
      color: "#4f6ef7"
    },
    activeCollaborators: [],
    activeDocument: null as CollaborativeDocument | null,
    versions: [],
    loading: false,
    errorMessage: null,
    isProviderOffline: false,
    syncState: "synced" as const,
    connectionState: "connected" as const,
    yjsProvider: providerStub,
    members: [],
    onRetry: vi.fn(),
    onCreateDocument: vi.fn().mockResolvedValue(activeDocument),
    onOpenDocument: vi.fn(),
    onCloseDocument: vi.fn(),
    onDeleteDocument: vi.fn().mockResolvedValue(undefined),
    onRenameDocument: vi.fn().mockResolvedValue(undefined),
    onSaveVersion: vi.fn().mockResolvedValue(undefined),
    onRestoreVersion: vi.fn().mockResolvedValue(undefined),
    onLoadVersions: vi.fn(),
    onPreviewVersion: vi.fn().mockResolvedValue("preview"),
    onDuplicateDocument: vi.fn().mockResolvedValue(undefined),
    onToggleFavorite: vi.fn().mockResolvedValue(undefined),
    onRestoreFromTrash: vi.fn().mockResolvedValue(undefined),
    onFetchTrash: vi.fn(),
    trashItems: [],
    trashLoading: false,
    onBatchDelete: vi.fn().mockResolvedValue(undefined),
    onBatchRestore: vi.fn().mockResolvedValue(undefined),
    onCreateTemplate: vi.fn().mockResolvedValue(undefined)
  };
};

describe("CollaborativeDocumentsModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestV2Props = null;
    throwInV2Mock = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("abre modal de creación desde V2 y crea/abre documento", async () => {
    const props = buildModuleProps();
    render(<CollaborativeDocumentsModule {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-open-create" }));

    fireEvent.change(
      screen.getByPlaceholderText("ej: Especificación técnica del módulo auth"),
      {
        target: {
          value: "Nuevo documento de pruebas"
        }
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Crear y abrir" }));

    await waitFor(() => {
      expect(props.onCreateDocument).toHaveBeenCalledWith({
        projectId: "project-1",
        type: "TEXTO",
        name: "Nuevo documento de pruebas"
      });
    });

    await waitFor(() => {
      expect(props.onOpenDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "doc-text",
          type: "TEXTO"
        })
      );
    });
  });

  it("ejecuta renombrar y eliminar desde callbacks V2", async () => {
    const props = buildModuleProps();
    render(<CollaborativeDocumentsModule {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-open-rename" }));
    fireEvent.change(screen.getByDisplayValue("Acta semanal"), {
      target: {
        value: "Acta semanal final"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(props.onRenameDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "doc-text"
        }),
        "Acta semanal final"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "mock-open-delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(props.onDeleteDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "doc-text"
        })
      );
    });
  });

  it("hace flush de cambios pendientes al cerrar documento activo", async () => {
    const props = {
      ...buildModuleProps(),
      activeDocument: buildDocument("doc-board", "WHITEBOARD", "Pizarra semanal")
    };

    render(<CollaborativeDocumentsModule {...props} />);

    fireEvent.click(screen.getByTestId("documents-editor-whiteboard-mock-change"));

    await waitFor(() => {
      expect(screen.getByText("● Cambios sin guardar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "mock-close-document" }));

    await waitFor(() => {
      expect(props.onSaveVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "doc-board"
        }),
        expect.objectContaining({
          kind: "AUTO",
          content: "{\"elements\":[]}",
          format: "json",
          mimeType: "application/json"
        })
      );
      expect(props.onCloseDocument).toHaveBeenCalledTimes(1);
    });
  });

  it("muestra fallback de seguridad si el módulo V2 falla", async () => {
    throwInV2Mock = true;
    const props = buildModuleProps();

    render(<CollaborativeDocumentsModule {...props} />);

    expect(screen.getByText("No se pudo cargar Documentos V2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(props.onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
