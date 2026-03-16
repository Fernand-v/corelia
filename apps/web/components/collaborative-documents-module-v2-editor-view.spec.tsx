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

import { CollaborativeDocumentsModuleV2EditorView } from "@/components/collaborative-documents-module-v2-editor-view";

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

const buildProps = () => {
  const activeDocument = buildDocument("doc-text", "TEXTO", "Acta semanal");
  const version = buildVersion("version-1", 1);

  return {
    activeDocument,
    documentTypeMeta: typeMeta,
    titleDraft: activeDocument.name,
    setTitleDraft: vi.fn(),
    commitDocumentTitle: vi.fn().mockResolvedValue(undefined),
    savingTitle: false,
    syncLabel: {
      label: "Conectado",
      tone: "bg-emerald-100 text-emerald-700"
    },
    saveStatusBadge: null,
    savingVersion: false,
    versionPanelOpen: true,
    versions: [version],
    editorNode: <div data-testid="editor-node">Editor</div>,
    onCloseDocument: vi.fn(),
    onSaveVersion: vi.fn(),
    onToggleVersionPanel: vi.fn(),
    onOpenPreview: vi.fn(),
    onPreviewVersion: vi.fn().mockResolvedValue("snapshot-payload"),
    onCreateTemplate: vi.fn().mockResolvedValue(undefined),
    onOpenTemplateSave: vi.fn(),
    activeDocumentCollaborators: [],
    currentUser: {
      id: "user-1",
      name: "Usuario Uno",
      color: "#4f6ef7"
    },
    connectionState: "connected" as const,
    renderCollaboratorAvatar: vi.fn().mockImplementation((user) => <span key={user.userId}>{user.name}</span>),
    onSetRestoreConfirm: vi.fn(),
    onSetSvgPreview: vi.fn()
  };
};

describe("CollaborativeDocumentsModuleV2EditorView", () => {
  it("dispara guardar versión y abrir creación de plantilla", () => {
    const props = buildProps();
    render(<CollaborativeDocumentsModuleV2EditorView {...props} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Guardar versión" })[0]!);
    expect(props.onSaveVersion).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Plantilla" }));
    expect(props.onOpenTemplateSave).toHaveBeenCalledWith(props.activeDocument);
  });

  it("permite restaurar y previsualizar una versión", async () => {
    const props = buildProps();
    render(<CollaborativeDocumentsModuleV2EditorView {...props} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Restaurar" })[0]!);
    expect(props.onSetRestoreConfirm).toHaveBeenCalledWith({ version: props.versions[0] });

    fireEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]!);
    await waitFor(() => {
      expect(props.onPreviewVersion).toHaveBeenCalledWith(props.activeDocument, props.versions[0]);
      expect(props.onOpenPreview).toHaveBeenCalledWith("Preview v1", "snapshot-payload");
    });
  });
});
