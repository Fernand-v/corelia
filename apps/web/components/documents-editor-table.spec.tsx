// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DocumentsEditorTable } from "@/components/documents-editor-table";

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

const baseValue = JSON.stringify({
  columns: ["A", "B", "C"],
  rows: [
    { A: "", B: "", C: "" },
    { A: "10", B: "20", C: "=SUM(A2:B2)" }
  ]
});

const renderTable = () =>
  render(
    <DocumentsEditorTable
      documentId="doc-table-1"
      value={baseValue}
      readOnly={false}
      currentUser={{
        id: "user-1",
        name: "Usuario Uno",
        color: "#0a84ff"
      }}
      onChange={vi.fn()}
    />
  );

const getGridCell = (container: HTMLElement, colId: string, rowIndex = "0") => {
  return container.querySelector(
    `.ag-center-cols-container .ag-row[row-index="${rowIndex}"] .ag-cell[col-id="${colId}"]`
  ) as HTMLElement | null;
};

describe("DocumentsEditorTable", () => {
  it("renderiza ribbon tipo excel con pestañas principales", () => {
    renderTable();

    expect(screen.getByRole("button", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fórmulas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Datos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vista" })).toBeInTheDocument();
  });

  it("renderiza barra de formula y guia rapida", async () => {
    const view = renderTable();

    await waitFor(() => {
      expect(getGridCell(view.container, "A")).toBeInTheDocument();
      expect(getGridCell(view.container, "B")).toBeInTheDocument();
    });

    const formulaInput = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    expect(formulaInput).toBeInTheDocument();
    expect(formulaInput).toBeDisabled();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Formula quick guide" }));
    expect(screen.getByText(/Excel-style quick tutorial/i)).toBeInTheDocument();
  });

  it("agrega una nueva hoja desde la barra inferior", async () => {
    renderTable();

    const addSheetButton = screen.getByRole("button", { name: "+ Hoja" });
    fireEvent.click(addSheetButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sheet 2/i })).toBeInTheDocument();
    });
  });

  it("muestra opciones de pintar celda en pestaña Inicio", async () => {
    const view = renderTable();

    await waitFor(() => {
      expect(getGridCell(view.container, "A")).toBeInTheDocument();
    });

    const firstCell = getGridCell(view.container, "A");
    fireEvent.click(firstCell as HTMLElement);

    expect(screen.getByLabelText("Color de texto")).toBeInTheDocument();
    expect(screen.getByLabelText("Color de fondo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bordes" })).toBeInTheDocument();
  });

  it("expone selector de paste special y panel de formato", async () => {
    const view = renderTable();

    await waitFor(() => {
      expect(getGridCell(view.container, "A")).toBeInTheDocument();
    });

    fireEvent.click(getGridCell(view.container, "A") as HTMLElement);

    expect(screen.getByDisplayValue("Pegado: Todo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Panel formato" })).toBeInTheDocument();
  });

  it("muestra controles avanzados en pestaña Datos", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Datos" }));

    expect(screen.getByDisplayValue("Filtro avanzado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Validación lista")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar validación" })).toBeInTheDocument();
  });
});
