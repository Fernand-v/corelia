import { describe, expect, it } from "vitest";

import {
  applyFillSeries,
  applyPasteSpecial,
  columnIndexFromLabel,
  createColumnLabelFromIndex,
  extractFormulaAutocompleteToken,
  insertReferenceAtCursor,
  isCellInRanges,
  migrateTableV1ToV2,
  normalizeFormulaAliases,
  parseFormulaRanges,
  parseWorkbookV2,
  serializeWorkbookV2,
  shiftFormulaReferences,
  toggleAbsoluteReference,
  validateCellAgainstRules,
  workbookToCsv,
  workbookToXlsxArrayBuffer,
  xlsxArrayBufferToWorkbookV2
} from "@/lib/table-workbook-v2";

describe("table-workbook-v2", () => {
  it("migra payload legacy v1 a workbook v2", () => {
    const workbook = migrateTableV1ToV2({
      columns: ["A", "B"],
      rows: [
        { A: "10", B: "20" },
        { A: "=SUM(A1:B1)", B: "30" }
      ]
    });

    expect(workbook.version).toBe(2);
    expect(workbook.sheets).toHaveLength(1);
    expect(workbook.sheets[0]?.rows[1]?.A?.value).toBe("=SUM(A1:B1)");
  });

  it("parsea legacy o v2 sin romper serializacion", () => {
    const fromLegacy = parseWorkbookV2(
      JSON.stringify({
        columns: ["A"],
        rows: [{ A: "hello" }]
      })
    );

    const reParsed = parseWorkbookV2(serializeWorkbookV2(fromLegacy));
    expect(reParsed.sheets[0]?.rows[0]?.A?.value).toBe("hello");
  });

  it("extrae token de autocompletado e inserta referencias", () => {
    expect(extractFormulaAutocompleteToken("=S", 2)).toBe("S");
    expect(extractFormulaAutocompleteToken("=SUM(A1, MA", 11)).toBe("MA");
    expect(extractFormulaAutocompleteToken("A1", 2)).toBeNull();

    const inserted = insertReferenceAtCursor("=SUM(", "B4", 5, 5);
    expect(inserted.value).toBe("=SUM(B4");
    expect(inserted.cursor).toBe(7);
  });

  it("parsea rangos de formula y detecta pertenencia", () => {
    const ranges = parseFormulaRanges("=SUM($A$1:B4)+$C2");
    expect(ranges).toHaveLength(2);
    expect(isCellInRanges(0, 0, ranges)).toBe(true);
    expect(isCellInRanges(3, 1, ranges)).toBe(true);
    expect(isCellInRanges(1, 5, ranges)).toBe(false);
  });

  it("convierte indices de columna Excel", () => {
    expect(createColumnLabelFromIndex(0)).toBe("A");
    expect(createColumnLabelFromIndex(27)).toBe("AB");
    expect(columnIndexFromLabel("AB")).toBe(27);
  });

  it("exporta/importa CSV y XLSX conservando formulas", () => {
    const workbook = parseWorkbookV2(
      JSON.stringify({
        columns: ["A", "B"],
        rows: [
          { A: "10", B: "20" },
          { A: "=SUM(A1:B1)", B: "" }
        ]
      })
    );

    const csv = workbookToCsv(workbook);
    expect(csv).toContain("A,B");
    expect(csv).toContain("=SUM(A1:B1)");

    const buffer = workbookToXlsxArrayBuffer(workbook);
    const parsedFromXlsx = xlsxArrayBufferToWorkbookV2(buffer);
    expect(parsedFromXlsx.sheets[0]?.rows[2]?.A?.value).toBe("=SUM(A1:B1)");
  });

  it("normaliza alias de formulas ES a EN", () => {
    expect(normalizeFormulaAliases("=SUMA(A1:A3)+SI(B1>0,1,0)")).toBe("=SUM(A1:A3)+IF(B1>0,1,0)");
    expect(normalizeFormulaAliases("plain text")).toBe("plain text");
  });

  it("alterna referencias absolutas con F4", () => {
    const one = toggleAbsoluteReference("=SUM(A1)", 6);
    expect(one.value).toBe("=SUM($A$1)");
    const two = toggleAbsoluteReference(one.value, 7);
    expect(two.value).toBe("=SUM(A$1)");
    const three = toggleAbsoluteReference(two.value, 7);
    expect(three.value).toBe("=SUM($A1)");
    const four = toggleAbsoluteReference(three.value, 7);
    expect(four.value).toBe("=SUM(A1)");
  });

  it("desplaza referencias de formulas para autofill", () => {
    expect(shiftFormulaReferences("=A1+$B$2", 2, 1)).toBe("=B3+$B$2");
  });

  it("genera series numericas y copia formulas", () => {
    expect(
      applyFillSeries({
        sourceValues: ["1", "2"],
        fillLength: 3,
        direction: "down",
        mode: "series"
      })
    ).toEqual(["3", "4", "5"]);

    expect(
      applyFillSeries({
        sourceValues: ["=A1"],
        fillLength: 2,
        direction: "down",
        mode: "copy"
      })
    ).toEqual(["=A2", "=A3"]);
  });

  it("aplica paste special por modo", () => {
    const source = {
      value: "=SUM(A1:A2)",
      style: { bold: true, numberFormat: "currency" as const }
    };
    const target = {
      value: "123",
      style: { italic: true }
    };

    expect(applyPasteSpecial({ source, target, mode: "formulas" }).value).toBe("=SUM(A1:A2)");
    expect(applyPasteSpecial({ source, target, mode: "values", computedValue: "30" }).value).toBe("30");
    expect(applyPasteSpecial({ source, target, mode: "format" }).style?.bold).toBe(true);
  });

  it("valida celdas segun reglas basicas", () => {
    expect(
      validateCellAgainstRules(
        "ACTIVO",
        [{ type: "list", column: "A", values: ["ACTIVO", "PAUSA"] }],
        "A"
      )
    ).toBeNull();
    expect(
      validateCellAgainstRules(
        "999",
        [{ type: "numberRange", column: "A", min: 0, max: 100 }],
        "A"
      )
    ).toContain("máximo");
  });
});
