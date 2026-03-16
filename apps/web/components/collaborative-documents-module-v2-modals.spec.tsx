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
  CollaborativeDocumentsModuleV2RestoreConfirmModal,
  CollaborativeDocumentsModuleV2SvgPreviewModal,
  CollaborativeDocumentsModuleV2TemplateSaveModal
} from "@/components/collaborative-documents-module-v2-modals";

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

describe("CollaborativeDocumentsModuleV2TemplateSaveModal", () => {
  it("no renderiza cuando no hay documento destino", () => {
    render(
      <CollaborativeDocumentsModuleV2TemplateSaveModal
        templateSaveTarget={null}
        templateName=""
        templateDesc=""
        setTemplateName={vi.fn()}
        setTemplateDesc={vi.fn()}
        onClose={vi.fn()}
        onCreateTemplate={vi.fn()}
      />
    );

    expect(screen.queryByText("Guardar como plantilla")).not.toBeInTheDocument();
  });

  it("guarda plantilla con valores saneados y cierra al resolver", async () => {
    const target = buildDocument("doc-text", "TEXTO", "Acta semanal");
    const onClose = vi.fn();
    const onCreateTemplate = vi.fn().mockResolvedValue(undefined);
    const setTemplateName = vi.fn();
    const setTemplateDesc = vi.fn();

    render(
      <CollaborativeDocumentsModuleV2TemplateSaveModal
        templateSaveTarget={target}
        templateName="  Plantilla base  "
        templateDesc="  Documentación estándar  "
        setTemplateName={setTemplateName}
        setTemplateDesc={setTemplateDesc}
        onClose={onClose}
        onCreateTemplate={onCreateTemplate}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Nombre de la plantilla"), {
      target: { value: "Nueva plantilla" }
    });
    expect(setTemplateName).toHaveBeenCalledWith("Nueva plantilla");

    fireEvent.change(screen.getByPlaceholderText("Descripción breve…"), {
      target: { value: "Descripción actualizada" }
    });
    expect(setTemplateDesc).toHaveBeenCalledWith("Descripción actualizada");

    fireEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));

    expect(onCreateTemplate).toHaveBeenCalledWith({
      documentId: "doc-text",
      name: "Plantilla base",
      description: "Documentación estándar"
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("omite la descripción cuando está vacía", () => {
    const target = buildDocument("doc-text", "TEXTO", "Acta semanal");
    const onCreateTemplate = vi.fn().mockResolvedValue(undefined);

    render(
      <CollaborativeDocumentsModuleV2TemplateSaveModal
        templateSaveTarget={target}
        templateName="Plantilla base"
        templateDesc="   "
        setTemplateName={vi.fn()}
        setTemplateDesc={vi.fn()}
        onClose={vi.fn()}
        onCreateTemplate={onCreateTemplate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    expect(onCreateTemplate).toHaveBeenCalledWith({
      documentId: "doc-text",
      name: "Plantilla base"
    });
  });

  it("no cierra el modal si crear plantilla falla", async () => {
    const target = buildDocument("doc-text", "TEXTO", "Acta semanal");
    const onClose = vi.fn();
    const onCreateTemplate = vi.fn().mockRejectedValue(new Error("boom"));

    render(
      <CollaborativeDocumentsModuleV2TemplateSaveModal
        templateSaveTarget={target}
        templateName="Plantilla base"
        templateDesc=""
        setTemplateName={vi.fn()}
        setTemplateDesc={vi.fn()}
        onClose={onClose}
        onCreateTemplate={onCreateTemplate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));

    await waitFor(() => {
      expect(onCreateTemplate).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CollaborativeDocumentsModuleV2RestoreConfirmModal", () => {
  it("restaura versión y cierra modal", async () => {
    const activeDocument = buildDocument("doc-text", "TEXTO", "Acta semanal");
    const version = buildVersion("version-1", 1);
    const setRestoringVersion = vi.fn();
    const onRestoreVersion = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CollaborativeDocumentsModuleV2RestoreConfirmModal
        restoreConfirm={{ version }}
        restoringVersion={false}
        setRestoringVersion={setRestoringVersion}
        activeDocument={activeDocument}
        onRestoreVersion={onRestoreVersion}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(setRestoringVersion).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(onRestoreVersion).toHaveBeenCalledWith(activeDocument, version);
      expect(setRestoringVersion).toHaveBeenCalledWith(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("no intenta restaurar si no hay documento activo", () => {
    const version = buildVersion("version-1", 1);
    const setRestoringVersion = vi.fn();
    const onRestoreVersion = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CollaborativeDocumentsModuleV2RestoreConfirmModal
        restoreConfirm={{ version }}
        restoringVersion={false}
        setRestoringVersion={setRestoringVersion}
        activeDocument={null}
        onRestoreVersion={onRestoreVersion}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onRestoreVersion).not.toHaveBeenCalled();
    expect(setRestoringVersion).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CollaborativeDocumentsModuleV2SvgPreviewModal", () => {
  it("renderiza preview, sanitiza svg y permite cerrar", () => {
    const onClose = vi.fn();

    render(
      <CollaborativeDocumentsModuleV2SvgPreviewModal
        svgPreview={{
          title: "Preview v1",
          svg: `<svg xmlns="http://www.w3.org/2000/svg"><script>alert("x")</script><circle cx="4" cy="4" r="2" /></svg>`
        }}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Preview v1")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
