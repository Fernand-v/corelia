"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { AgGridReact } from "ag-grid-react";
import { HyperFormula } from "hyperformula";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent
} from "ag-grid-community";

import {
  applyFillSeries,
  applyPasteSpecial,
  createCellLabelFromAddress,
  createColumnLabelFromIndex,
  createEmptySheetV2,
  csvToWorkbookV2,
  extractFormulaAutocompleteToken,
  getFormulaAliasEntries,
  getActiveSheet,
  getSheetById,
  insertReferenceAtCursor,
  isCellInRanges,
  migrateTableV1ToV2,
  normalizeFormulaAliases,
  parseCellFromY,
  parseFormulaRanges,
  parseWorkbookV2,
  sanitizeWorkbookV2,
  serializeWorkbookV2,
  stringifyCellForY,
  toggleAbsoluteReference,
  type TableCellV2,
  type TableDimensionV2,
  type TableFilterRuleV2,
  type TableFilterStateV2,
  type TablePasteSpecialModeV2,
  type TableRangeV2,
  type TableSelectionRangeV2,
  type TableSheetV2,
  type TableSortRuleV2,
  type TableStyleV2,
  type TableValidationRuleV2,
  type TableWorkbookV2,
  validateCellAgainstRules,
  workbookToCsv,
  workbookToXlsxArrayBuffer,
  xlsxArrayBufferToWorkbookV2
} from "@/lib/table-workbook-v2";
import { UiModal } from "@/components/ui-modal";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type FormulaFunctionHint = {
  name: string;
  signature: string;
  description: string;
};

type RemoteCellSelection = {
  userId: string;
  name: string;
  color: string;
  sheetId: string;
  rowIndex: number;
  column: string;
  ranges?: TableSelectionRangeV2[];
  editingMode?: "idle" | "editingValue" | "editingFormula";
};

type CellAddress = {
  rowIndex: number;
  column: string;
  columnIndex: number;
};

type GridRow = {
  __rowIndex: number;
};

type CellMenuState = {
  visible: boolean;
  x: number;
  y: number;
  column: string;
};

type ValidationEditorState = {
  type: TableValidationRuleV2["type"];
  column: string;
  values: string;
  min: string;
  max: string;
  message: string;
};

const TABLE_AWARENESS_KEY = "coreliaTableCell";
const Y_KEY_INITIALIZED = "initialized";
const Y_KEY_VERSION = "workbookVersion";
const Y_KEY_ACTIVE_SHEET = "activeSheetId";
const Y_KEY_SHEETS = "sheets";
const Y_VERSION = 2;

const EXCEL_BRAND_COLOR = "#217346";

const DEFAULT_FORMULA_HINTS: FormulaFunctionHint[] = [
  { name: "SUM", signature: "SUM(number1, [number2], ...)", description: "Adds numeric values." },
  { name: "AVERAGE", signature: "AVERAGE(number1, [number2], ...)", description: "Returns arithmetic mean." },
  { name: "COUNT", signature: "COUNT(value1, [value2], ...)", description: "Counts numeric cells." },
  { name: "COUNTA", signature: "COUNTA(value1, [value2], ...)", description: "Counts non-empty cells." },
  { name: "MAX", signature: "MAX(number1, [number2], ...)", description: "Returns largest value." },
  { name: "MIN", signature: "MIN(number1, [number2], ...)", description: "Returns smallest value." },
  { name: "IF", signature: "IF(logical_test, value_if_true, value_if_false)", description: "Conditional evaluation." },
  { name: "AND", signature: "AND(logical1, [logical2], ...)", description: "True when all conditions are true." },
  { name: "OR", signature: "OR(logical1, [logical2], ...)", description: "True when any condition is true." },
  { name: "VLOOKUP", signature: "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])", description: "Vertical lookup in first column." },
  { name: "XLOOKUP", signature: "XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])", description: "Lookup with flexible return range." },
  { name: "INDEX", signature: "INDEX(array, row_num, [column_num])", description: "Returns value by row/column index." },
  { name: "MATCH", signature: "MATCH(lookup_value, lookup_array, [match_type])", description: "Returns relative position in range." },
  { name: "TODAY", signature: "TODAY()", description: "Returns current date." },
  { name: "NOW", signature: "NOW()", description: "Returns current date-time." }
];

const normalizeColor = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
};

const stringifyComputedValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    return String((value as { value?: unknown }).value ?? "");
  }

  return String(value);
};

const isPrintableKey = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const isFormulaInput = (value: string) => value.trimStart().startsWith("=");
const isPotentiallyIncompleteFormula = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "=" || (trimmed.startsWith("=") && /[+\-/*^(,]$/.test(trimmed));
};

const formulaHintsByName = new Map(DEFAULT_FORMULA_HINTS.map((hint) => [hint.name, hint]));
const formulaAliasEntries = getFormulaAliasEntries();

const cloneWorkbook = (workbook: TableWorkbookV2): TableWorkbookV2 => ({
  version: 2,
  activeSheetId: workbook.activeSheetId,
  sheets: workbook.sheets.map((sheet) => ({
    id: sheet.id,
    name: sheet.name,
    columns: [...sheet.columns],
    rows: sheet.rows.map((row) =>
      Object.fromEntries(
        sheet.columns.map((column) => {
          const cell = row[column] ?? { value: "" };
          return [
            column,
            {
              value: cell.value,
              ...(cell.style ? { style: { ...cell.style } } : {})
            } satisfies TableCellV2
          ];
        })
      )
    ),
    filters: sheet.filters.map((filterRule) => ({ ...filterRule })),
    filterStates: sheet.filterStates.map((filterState) => ({
      column: filterState.column,
      selectedValues: [...filterState.selectedValues],
      ...(filterState.condition
        ? {
            condition: { ...filterState.condition }
          }
        : {})
    })),
    sort: sheet.sort ? { ...sheet.sort } : null,
    validations: sheet.validations.map((rule) => ({ ...rule })),
    dimensions: {
      columnWidths: { ...sheet.dimensions.columnWidths },
      rowHeights: { ...sheet.dimensions.rowHeights },
      hiddenColumns: [...sheet.dimensions.hiddenColumns],
      hiddenRows: [...sheet.dimensions.hiddenRows]
    },
    view: { ...sheet.view }
  }))
});

const formatCellDisplayValue = (value: string, style: TableStyleV2 | undefined): string => {
  if (!style || !style.numberFormat) {
    return value;
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  if (style.numberFormat === "number") {
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 6 }).format(numeric);
  }

  if (style.numberFormat === "currency") {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(numeric);
  }

  if (style.numberFormat === "percent") {
    return `${(numeric * 100).toFixed(2)}%`;
  }

  if (style.numberFormat === "date") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("es-ES");
    }
  }

  return value;
};

const createSheetId = () =>
  `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toCellAddressLabel = (address: CellAddress) =>
  createCellLabelFromAddress({
    rowIndex: address.rowIndex,
    columnIndex: address.columnIndex
  });

const toSelectionRange = (start: CellAddress, end: CellAddress): TableSelectionRangeV2 => ({
  start: {
    rowIndex: Math.min(start.rowIndex, end.rowIndex),
    columnIndex: Math.min(start.columnIndex, end.columnIndex)
  },
  end: {
    rowIndex: Math.max(start.rowIndex, end.rowIndex),
    columnIndex: Math.max(start.columnIndex, end.columnIndex)
  }
});

const isCellInSelectionRange = (rowIndex: number, columnIndex: number, range: TableSelectionRangeV2) => {
  return (
    rowIndex >= range.start.rowIndex &&
    rowIndex <= range.end.rowIndex &&
    columnIndex >= range.start.columnIndex &&
    columnIndex <= range.end.columnIndex
  );
};

const readSheetFromYMap = (ySheet: Y.Map<unknown>, index: number): TableSheetV2 => {
  const id =
    typeof ySheet.get("id") === "string" && (ySheet.get("id") as string).trim().length > 0
      ? (ySheet.get("id") as string)
      : `sheet-${index + 1}`;

  const name =
    typeof ySheet.get("name") === "string" && (ySheet.get("name") as string).trim().length > 0
      ? (ySheet.get("name") as string)
      : `Sheet ${index + 1}`;

  const yColumns = ySheet.get("columns");
  const columns =
    yColumns instanceof Y.Array && yColumns.length > 0
      ? yColumns
          .toArray()
          .map((column) => String(column).trim().toUpperCase())
          .filter((column, idx, all) => column.length > 0 && all.indexOf(column) === idx)
      : createEmptySheetV2().columns;

  const yRows = ySheet.get("rows");
  const rows: Array<Record<string, TableCellV2>> =
    yRows instanceof Y.Array && yRows.length > 0
      ? yRows.toArray().map((row) => {
          if (!(row instanceof Y.Map)) {
            return Object.fromEntries(columns.map((column) => [column, { value: "" }])) as Record<
              string,
              TableCellV2
            >;
          }

          return Object.fromEntries(
            columns.map((column) => [column, parseCellFromY(row.get(column))])
          ) as Record<string, TableCellV2>;
        })
      : createEmptySheetV2().rows;

  const filters = parseJson<TableFilterRuleV2[]>(ySheet.get("filters"), []);
  const filterStates = parseJson<TableFilterStateV2[]>(ySheet.get("filterStates"), []);
  const sort = parseJson<TableSortRuleV2 | null>(ySheet.get("sort"), null);
  const validations = parseJson<TableValidationRuleV2[]>(ySheet.get("validations"), []);
  const dimensions = parseJson<TableDimensionV2>(
    ySheet.get("dimensions"),
    createEmptySheetV2().dimensions
  );
  const view = parseJson<TableSheetV2["view"]>(ySheet.get("view"), createEmptySheetV2().view);

  return {
    id,
    name,
    columns,
    rows,
    filters,
    filterStates,
    sort,
    validations,
    dimensions,
    view
  };
};

const buildYSheetMap = (sheet: TableSheetV2): Y.Map<unknown> => {
  const ySheet = new Y.Map<unknown>();
  const yColumns = new Y.Array<string>();
  yColumns.push(sheet.columns);

  const yRows = new Y.Array<Y.Map<string>>();
  sheet.rows.forEach((row) => {
    const yRow = new Y.Map<string>();
    sheet.columns.forEach((column) => {
      yRow.set(column, stringifyCellForY(row[column] ?? { value: "" }));
    });
    yRows.push([yRow]);
  });

  ySheet.set("id", sheet.id);
  ySheet.set("name", sheet.name);
  ySheet.set("columns", yColumns);
  ySheet.set("rows", yRows);
  ySheet.set("filters", JSON.stringify(sheet.filters));
  ySheet.set("filterStates", JSON.stringify(sheet.filterStates));
  ySheet.set("sort", JSON.stringify(sheet.sort));
  ySheet.set("validations", JSON.stringify(sheet.validations));
  ySheet.set("dimensions", JSON.stringify(sheet.dimensions));
  ySheet.set("view", JSON.stringify(sheet.view));

  return ySheet;
};

const readLegacyV1FromY = (yRoot: Y.Map<unknown>): { columns: string[]; rows: Array<Record<string, string>> } | null => {
  const yColumns = yRoot.get("columns");
  const yRows = yRoot.get("rows");

  if (!(yColumns instanceof Y.Array) || !(yRows instanceof Y.Array)) {
    return null;
  }

  const columns = yColumns
    .toArray()
    .map((column) => String(column).trim().toUpperCase())
    .filter(Boolean);

  const rows = yRows.toArray().map((row) => {
    if (!(row instanceof Y.Map)) {
      return Object.fromEntries(columns.map((column) => [column, ""]));
    }
    return Object.fromEntries(columns.map((column) => [column, String(row.get(column) ?? "")]));
  });

  return {
    columns,
    rows
  };
};

const useFormulaHints = () => {
  return useMemo<FormulaFunctionHint[]>(() => {
    try {
      const available = new Set(HyperFormula.getRegisteredFunctionNames("enGB"));
      const defaults = DEFAULT_FORMULA_HINTS.filter((hint) => available.has(hint.name));

      if (defaults.length > 0) {
        return defaults;
      }

      return HyperFormula.getRegisteredFunctionNames("enGB")
        .slice(0, 120)
        .map((name) => ({
          name,
          signature: `${name}(...)`,
          description: "Built-in function"
        }));
    } catch {
      return DEFAULT_FORMULA_HINTS;
    }
  }, []);
};

export const DocumentsEditorTable = ({
  documentId,
  value,
  readOnly,
  provider,
  currentUser,
  onChange
}: {
  documentId: string;
  value: string;
  readOnly: boolean;
  provider?: HocuspocusProvider | null;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  onChange: (value: string) => void;
}) => {
  const fallbackDocRef = useRef<Y.Doc | null>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const yRoot = useMemo(() => yDoc.getMap<unknown>(`doc:${documentId}:table:state`), [documentId, yDoc]);
  const yLegacyText = useMemo(() => yDoc.getText(`doc:${documentId}:table`), [documentId, yDoc]);

  const formulaHints = useFormulaHints();
  const formulaBarRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const hfRef = useRef<HyperFormula | null>(null);
  const localIncrementalMutationRef = useRef(false);

  const initialWorkbook = useMemo(
    () => parseWorkbookV2(value || yLegacyText.toString()),
    [value, yLegacyText]
  );

  const [workbook, setWorkbook] = useState<TableWorkbookV2>(initialWorkbook);
  const [selectedCell, setSelectedCell] = useState<CellAddress | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: CellAddress; end: CellAddress } | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<TableSelectionRangeV2[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<CellAddress | null>(null);
  const [formulaEditMode, setFormulaEditMode] = useState<"idle" | "editingValue" | "editingFormula">("idle");
  const [formulaAnchorCell, setFormulaAnchorCell] = useState<CellAddress | null>(null);
  const [formulaDraft, setFormulaDraft] = useState("");
  const [formulaQuery, setFormulaQuery] = useState<string | null>(null);
  const [formulaDropdownIndex, setFormulaDropdownIndex] = useState(0);
  const [formulaGuideVisible, setFormulaGuideVisible] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<"INICIO" | "FORMULAS" | "DATOS" | "VISTA">(
    "INICIO"
  );
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [sortColumn, setSortColumn] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pasteSpecialMode, setPasteSpecialMode] = useState<TablePasteSpecialModeV2>("all");
  const [formatPanelOpen, setFormatPanelOpen] = useState(true);
  const [formatPainterArmed, setFormatPainterArmed] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState<CellMenuState>({
    visible: false,
    x: 0,
    y: 0,
    column: ""
  });
  const [activeFilterStateColumn, setActiveFilterStateColumn] = useState("");
  const [filterStateSearch, setFilterStateSearch] = useState("");
  const [validationEditor, setValidationEditor] = useState<ValidationEditorState>({
    type: "list",
    column: "",
    values: "",
    min: "",
    max: "",
    message: ""
  });
  const [remoteSelections, setRemoteSelections] = useState<RemoteCellSelection[]>([]);
  const [calcRevision, setCalcRevision] = useState(0);
  const [undoRevision, setUndoRevision] = useState(0);
  const [sheetRenameModalOpen, setSheetRenameModalOpen] = useState(false);
  const [sheetRenameValue, setSheetRenameValue] = useState("");
  const [sheetRenameTargetId, setSheetRenameTargetId] = useState<string | null>(null);

  const workbookRef = useRef(workbook);
  const onChangeRef = useRef(onChange);
  const lastSerializedRef = useRef(serializeWorkbookV2(workbook));
  const lastNotifiedRef = useRef("");
  const copiedCellsRef = useRef<TableCellV2[][]>([]);
  const formatPainterStyleRef = useRef<TableStyleV2 | null>(null);
  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSelectionRef = useRef(false);
  const isDraggingFormulaReferenceRef = useRef(false);
  const draggedRangeEndRef = useRef<CellAddress | null>(null);
  const fillDragStateRef = useRef<{
    active: boolean;
    sourceRange: TableSelectionRangeV2 | null;
    targetCell: CellAddress | null;
  }>({
    active: false,
    sourceRange: null,
    targetCell: null
  });
  const [fillHandlePosition, setFillHandlePosition] = useState<{
    visible: boolean;
    left: number;
    top: number;
  }>({
    visible: false,
    left: 0,
    top: 0
  });

  useEffect(() => {
    workbookRef.current = workbook;
  }, [workbook]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const canUndo = useMemo(() => {
    const manager = undoManagerRef.current as unknown as { undoStack?: unknown[] } | null;
    return (manager?.undoStack?.length ?? 0) > 0;
  }, [undoRevision]);

  const canRedo = useMemo(() => {
    const manager = undoManagerRef.current as unknown as { redoStack?: unknown[] } | null;
    return (manager?.redoStack?.length ?? 0) > 0;
  }, [undoRevision]);

  const activeSheet = useMemo(() => getActiveSheet(workbook), [workbook]);

  useEffect(() => {
    if (!activeSheet || activeSheet.columns.length === 0) {
      setSelectedCell(null);
      setFormulaAnchorCell(null);
      return;
    }

    if (!selectedCell) {
      return;
    }

    const validColumnIndex = activeSheet.columns.indexOf(selectedCell.column);
    if (
      validColumnIndex === -1 ||
      selectedCell.rowIndex >= activeSheet.rows.length ||
      activeSheet.dimensions.hiddenColumns.includes(selectedCell.column)
    ) {
      setSelectedCell(null);
      setFormulaAnchorCell(null);
      setFormulaEditMode("idle");
    }
  }, [activeSheet, selectedCell]);

  const readWorkbookFromY = useCallback((): TableWorkbookV2 => {
    const version = yRoot.get(Y_KEY_VERSION);
    const ySheets = yRoot.get(Y_KEY_SHEETS);

    if (version === Y_VERSION && ySheets instanceof Y.Array && ySheets.length > 0) {
      const sheets = ySheets
        .toArray()
        .map((entry, index) => (entry instanceof Y.Map ? readSheetFromYMap(entry, index) : null))
        .filter((sheet): sheet is TableSheetV2 => Boolean(sheet));

      const activeSheetId =
        typeof yRoot.get(Y_KEY_ACTIVE_SHEET) === "string"
          ? (yRoot.get(Y_KEY_ACTIVE_SHEET) as string)
          : sheets[0]?.id;

      return sanitizeWorkbookV2({
        version: 2,
        activeSheetId,
        sheets
      });
    }

    const legacy = readLegacyV1FromY(yRoot);
    if (legacy) {
      return migrateTableV1ToV2(legacy);
    }

    return parseWorkbookV2(value || yLegacyText.toString());
  }, [value, yLegacyText, yRoot]);

  const writeWorkbookToY = useCallback(
    (nextWorkbook: TableWorkbookV2) => {
      const safeWorkbook = sanitizeWorkbookV2(nextWorkbook);
      const serialized = serializeWorkbookV2(safeWorkbook);

      yDoc.transact(() => {
        const ySheets = new Y.Array<Y.Map<unknown>>();
        safeWorkbook.sheets.forEach((sheet) => {
          ySheets.push([buildYSheetMap(sheet)]);
        });

        yRoot.set(Y_KEY_VERSION, Y_VERSION);
        yRoot.set(Y_KEY_ACTIVE_SHEET, safeWorkbook.activeSheetId);
        yRoot.set(Y_KEY_SHEETS, ySheets);
        yRoot.set(Y_KEY_INITIALIZED, true);

        if (yLegacyText.toString() !== serialized) {
          yLegacyText.delete(0, yLegacyText.length);
          yLegacyText.insert(0, serialized);
        }
      });
    },
    [yDoc, yLegacyText, yRoot]
  );

  const ensureInitialized = useCallback(() => {
    const initialized = yRoot.get(Y_KEY_INITIALIZED);
    if (initialized === true) {
      return;
    }

    const seed = readWorkbookFromY();
    writeWorkbookToY(seed);
  }, [readWorkbookFromY, writeWorkbookToY, yRoot]);

  const syncFromY = useCallback(() => {
    const nextWorkbook = readWorkbookFromY();
    const payload = serializeWorkbookV2(nextWorkbook);

    setWorkbook(nextWorkbook);
    lastSerializedRef.current = payload;

    if (lastNotifiedRef.current !== payload) {
      lastNotifiedRef.current = payload;
      onChangeRef.current(payload);
    }

    if (yLegacyText.toString() !== payload) {
      yLegacyText.delete(0, yLegacyText.length);
      yLegacyText.insert(0, payload);
    }
  }, [readWorkbookFromY, yLegacyText]);

  useEffect(() => {
    ensureInitialized();
    syncFromY();

    const handleYChange = () => {
      syncFromY();
    };

    yRoot.observeDeep(handleYChange);
    return () => {
      yRoot.unobserveDeep(handleYChange);
    };
  }, [ensureInitialized, syncFromY, yRoot]);

  useEffect(() => {
    if (!value.trim() || value === lastSerializedRef.current) {
      return;
    }

    writeWorkbookToY(parseWorkbookV2(value));
  }, [value, writeWorkbookToY]);

  useEffect(() => {
    const undoManager = new Y.UndoManager([yRoot], {
      trackedOrigins: new Set([null, "table-editor"])
    });

    undoManagerRef.current = undoManager;

    const refreshUndoState = () => {
      setUndoRevision((current) => current + 1);
    };

    undoManager.on("stack-item-added", refreshUndoState);
    undoManager.on("stack-item-popped", refreshUndoState);
    undoManager.on("stack-item-updated", refreshUndoState);

    return () => {
      undoManager.off("stack-item-added", refreshUndoState);
      undoManager.off("stack-item-popped", refreshUndoState);
      undoManager.off("stack-item-updated", refreshUndoState);
      undoManager.destroy();
      undoManagerRef.current = null;
    };
  }, [yRoot]);

  const rebuildHyperFormula = useCallback((nextWorkbook: TableWorkbookV2) => {
    const currentHF = hfRef.current;
    if (currentHF) {
      currentHF.destroy();
    }

    const sheetsPayload: Record<string, Array<Array<string | null>>> = {};

    nextWorkbook.sheets.forEach((sheet) => {
      sheetsPayload[sheet.id] = sheet.rows.map((row) =>
        sheet.columns.map((column) => {
          const raw = row[column]?.value ?? "";
          return raw.trim().length > 0 ? raw : null;
        })
      );
    });

    hfRef.current = HyperFormula.buildFromSheets(sheetsPayload, {
      licenseKey: "gpl-v3"
    });

    setCalcRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    if (localIncrementalMutationRef.current) {
      localIncrementalMutationRef.current = false;
      return;
    }

    rebuildHyperFormula(workbook);
  }, [rebuildHyperFormula, workbook]);

  useEffect(() => {
    return () => {
      const currentHF = hfRef.current;
      if (currentHF) {
        currentHF.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      setRemoteSelections([]);
      return;
    }

    const refreshRemoteSelections = () => {
      const next: RemoteCellSelection[] = [];
      awareness.getStates().forEach((state: unknown) => {
        const source = state as Record<string, unknown>;
        const selection = source?.[TABLE_AWARENESS_KEY] as
          | (RemoteCellSelection & { documentId?: string })
          | null
          | undefined;

        if (!selection || selection.documentId !== documentId || selection.userId === currentUser.id) {
          return;
        }

        next.push(selection);
      });

      setRemoteSelections(next);
    };

    refreshRemoteSelections();
    awareness.on("change", refreshRemoteSelections);

    return () => {
      awareness.off("change", refreshRemoteSelections);
    };
  }, [currentUser.id, documentId, provider]);

  const localSelectionRanges = useMemo<TableSelectionRangeV2[]>(() => {
    const fromMainRange = selectedRange
      ? [
          {
            start: {
              rowIndex: Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
              columnIndex: Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
            },
            end: {
              rowIndex: Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
              columnIndex: Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
            }
          }
        ]
      : [];

    const fromAdditional = selectedRanges.map((range) => ({
      start: {
        rowIndex: Math.min(range.start.rowIndex, range.end.rowIndex),
        columnIndex: Math.min(range.start.columnIndex, range.end.columnIndex)
      },
      end: {
        rowIndex: Math.max(range.start.rowIndex, range.end.rowIndex),
        columnIndex: Math.max(range.start.columnIndex, range.end.columnIndex)
      }
    }));

    if (fromMainRange.length > 0 || fromAdditional.length > 0) {
      return [...fromMainRange, ...fromAdditional];
    }

    if (!selectedCell) {
      return [];
    }

    return [
      {
        start: {
          rowIndex: selectedCell.rowIndex,
          columnIndex: selectedCell.columnIndex
        },
        end: {
          rowIndex: selectedCell.rowIndex,
          columnIndex: selectedCell.columnIndex
        }
      }
    ];
  }, [selectedCell, selectedRange, selectedRanges]);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      return;
    }

    if (!selectedCell) {
      awareness.setLocalStateField(TABLE_AWARENESS_KEY, null);
      return;
    }

    awareness.setLocalStateField(TABLE_AWARENESS_KEY, {
      documentId,
      userId: currentUser.id,
      name: currentUser.name,
      color: currentUser.color,
      sheetId: activeSheet.id,
      rowIndex: selectedCell.rowIndex,
      column: selectedCell.column,
      ranges: localSelectionRanges,
      editingMode: formulaEditMode
    });
  }, [
    activeSheet.id,
    currentUser.color,
    currentUser.id,
    currentUser.name,
    documentId,
    formulaEditMode,
    localSelectionRanges,
    provider,
    selectedCell
  ]);

  const commitWorkbookMutation = useCallback(
    (updater: (current: TableWorkbookV2) => TableWorkbookV2) => {
      if (readOnly) {
        return;
      }

      const next = sanitizeWorkbookV2(updater(cloneWorkbook(workbookRef.current)));
      writeWorkbookToY(next);
    },
    [readOnly, writeWorkbookToY]
  );

  const getComputedCellValue = useCallback(
    (sheetId: string, rowIndex: number, columnIndex: number, fallbackRaw: string) => {
      const hf = hfRef.current;
      if (!hf) {
        return fallbackRaw;
      }

      const hfSheetId = hf.getSheetId(sheetId);
      if (hfSheetId === undefined) {
        return fallbackRaw;
      }

      try {
        const computed = hf.getCellValue({
          sheet: hfSheetId,
          row: rowIndex,
          col: columnIndex
        });
        return stringifyComputedValue(computed);
      } catch {
        return fallbackRaw;
      }
    },
    []
  );

  const applySheetFilter = useCallback(
    (rows: number[]) => {
      if (!activeSheet.filters.length && !activeSheet.filterStates.length) {
        return rows;
      }

      return rows.filter((rowIndex) => {
        const legacyMatches = activeSheet.filters.every((rule) => {
          const columnIndex = activeSheet.columns.indexOf(rule.column);
          if (columnIndex < 0) {
            return true;
          }

          const cellRaw = activeSheet.rows[rowIndex]?.[rule.column]?.value ?? "";
          const cellValue = getComputedCellValue(activeSheet.id, rowIndex, columnIndex, cellRaw);
          const normalized = cellValue.toLowerCase();
          const query = rule.value.toLowerCase();

          if (!query) {
            return true;
          }

          if (rule.operator === "equals") {
            return normalized === query;
          }

          return normalized.includes(query);
        });

        if (!legacyMatches) {
          return false;
        }

        return activeSheet.filterStates.every((filterState) => {
          const columnIndex = activeSheet.columns.indexOf(filterState.column);
          if (columnIndex < 0) {
            return true;
          }

          const cellRaw = activeSheet.rows[rowIndex]?.[filterState.column]?.value ?? "";
          const cellValue = getComputedCellValue(activeSheet.id, rowIndex, columnIndex, cellRaw);
          const normalized = cellValue.toLowerCase();

          if (filterState.selectedValues.length > 0) {
            const selected = new Set(filterState.selectedValues.map((entry) => entry.toLowerCase()));
            if (!selected.has(normalized)) {
              return false;
            }
          }

          if (!filterState.condition || !filterState.condition.value.trim()) {
            return true;
          }

          const query = filterState.condition.value.toLowerCase();
          if (filterState.condition.mode === "contains") {
            return normalized.includes(query);
          }
          if (filterState.condition.mode === "equals") {
            return normalized === query;
          }
          if (filterState.condition.mode === "number_gt" || filterState.condition.mode === "number_lt") {
            const current = Number(cellValue);
            const expected = Number(filterState.condition.value);
            if (Number.isNaN(current) || Number.isNaN(expected)) {
              return false;
            }
            return filterState.condition.mode === "number_gt" ? current > expected : current < expected;
          }
          if (filterState.condition.mode === "date_after" || filterState.condition.mode === "date_before") {
            const currentDate = new Date(cellValue);
            const expectedDate = new Date(filterState.condition.value);
            if (Number.isNaN(currentDate.getTime()) || Number.isNaN(expectedDate.getTime())) {
              return false;
            }
            return filterState.condition.mode === "date_after"
              ? currentDate.getTime() > expectedDate.getTime()
              : currentDate.getTime() < expectedDate.getTime();
          }

          return true;
        });
      });
    },
    [activeSheet, getComputedCellValue]
  );

  const applySheetSort = useCallback(
    (rows: number[]) => {
      const sortRule = activeSheet.sort;
      if (!sortRule) {
        return rows;
      }

      const columnIndex = activeSheet.columns.indexOf(sortRule.column);
      if (columnIndex < 0) {
        return rows;
      }

      const multiplier = sortRule.direction === "asc" ? 1 : -1;
      return [...rows].sort((left, right) => {
        const leftRaw = activeSheet.rows[left]?.[sortRule.column]?.value ?? "";
        const rightRaw = activeSheet.rows[right]?.[sortRule.column]?.value ?? "";
        const leftValue = getComputedCellValue(activeSheet.id, left, columnIndex, leftRaw);
        const rightValue = getComputedCellValue(activeSheet.id, right, columnIndex, rightRaw);

        const leftNumber = Number(leftValue);
        const rightNumber = Number(rightValue);

        if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
          return (leftNumber - rightNumber) * multiplier;
        }

        return leftValue.localeCompare(rightValue, "es", { sensitivity: "base" }) * multiplier;
      });
    },
    [activeSheet, getComputedCellValue]
  );

  const displayedRowIndexes = useMemo(() => {
    const hiddenRows = new Set(activeSheet.dimensions.hiddenRows);
    const base = activeSheet.rows
      .map((_, index) => index)
      .filter((rowIndex) => !hiddenRows.has(rowIndex));
    const filtered = applySheetFilter(base);
    return applySheetSort(filtered);
  }, [activeSheet.dimensions.hiddenRows, activeSheet.rows, applySheetFilter, applySheetSort, calcRevision]);

  const gridRows = useMemo<GridRow[]>(() => {
    return displayedRowIndexes.map((rowIndex) => ({ __rowIndex: rowIndex }));
  }, [displayedRowIndexes]);

  const freezeRows = Math.min(activeSheet.view.freezeRows, gridRows.length);
  const pinnedTopRowData = freezeRows > 0 ? gridRows.slice(0, freezeRows) : [];
  const bodyRowData = freezeRows > 0 ? gridRows.slice(freezeRows) : gridRows;

  const activeFormulaCell = formulaAnchorCell ?? selectedCell;
  const activeFormulaValue = useMemo(() => {
    if (formulaAnchorCell) {
      return formulaDraft;
    }

    if (!selectedCell) {
      return "";
    }

    return activeSheet.rows[selectedCell.rowIndex]?.[selectedCell.column]?.value ?? "";
  }, [activeSheet.rows, formulaAnchorCell, formulaDraft, selectedCell]);

  const formulaRanges = useMemo<TableRangeV2[]>(() => {
    if (formulaEditMode !== "editingFormula") {
      return [];
    }

    return parseFormulaRanges(formulaDraft);
  }, [formulaDraft, formulaEditMode]);

  useEffect(() => {
    if (!gridViewportRef.current || !selectedCell) {
      setFillHandlePosition({
        visible: false,
        left: 0,
        top: 0
      });
      return;
    }

    const rangeEnd = selectedRange
      ? {
          rowIndex: Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
          column: selectedRange.start.columnIndex > selectedRange.end.columnIndex ? selectedRange.start.column : selectedRange.end.column,
          columnIndex: Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
        }
      : selectedCell;

    const displayIndex = displayedRowIndexes.indexOf(rangeEnd.rowIndex);
    if (displayIndex < 0) {
      setFillHandlePosition({
        visible: false,
        left: 0,
        top: 0
      });
      return;
    }

    const rowSelector =
      displayIndex < freezeRows
        ? `.ag-pinned-top-container .ag-row[row-index="${displayIndex}"] .ag-cell[col-id="${rangeEnd.column}"]`
        : `.ag-center-cols-container .ag-row[row-index="${displayIndex - freezeRows}"] .ag-cell[col-id="${rangeEnd.column}"]`;
    const cellElement = gridViewportRef.current.querySelector(rowSelector) as HTMLElement | null;
    if (!cellElement) {
      setFillHandlePosition({
        visible: false,
        left: 0,
        top: 0
      });
      return;
    }

    const viewportRect = gridViewportRef.current.getBoundingClientRect();
    const cellRect = cellElement.getBoundingClientRect();
    setFillHandlePosition({
      visible: true,
      left: cellRect.right - viewportRect.left - 5,
      top: cellRect.bottom - viewportRect.top - 5
    });
  }, [displayedRowIndexes, freezeRows, selectedCell, selectedRange]);

  const remoteSelectionMap = useMemo(() => {
    const map = new Map<string, RemoteCellSelection>();
    remoteSelections.forEach((selection) => {
      if (selection.sheetId !== activeSheet.id) {
        return;
      }
      map.set(`${selection.rowIndex}:${selection.column}`, selection);
    });
    return map;
  }, [activeSheet.id, remoteSelections]);

  const remoteRangeSelections = useMemo(() => {
    return remoteSelections.filter(
      (selection) => selection.sheetId === activeSheet.id && Array.isArray(selection.ranges) && selection.ranges.length > 0
    );
  }, [activeSheet.id, remoteSelections]);

  const updateFormulaQuery = useCallback((nextValue: string, caretPosition: number) => {
    const nextQuery = extractFormulaAutocompleteToken(nextValue, caretPosition);
    setFormulaQuery(nextQuery);
    if (nextQuery) {
      setFormulaDropdownIndex(0);
    }
  }, []);

  const focusFormulaBar = useCallback((cursorPosition: number) => {
    const applyFocus = () => {
      const input = formulaBarRef.current;
      if (!input) {
        return;
      }

      const cursor = Math.max(0, Math.min(cursorPosition, input.value.length));
      input.focus();
      input.setSelectionRange(cursor, cursor);
    };

    applyFocus();
    window.setTimeout(applyFocus, 0);
  }, []);

  const updateCellRawValue = useCallback(
    (rowIndex: number, column: string, nextRaw: string) => {
      if (readOnly) {
        return;
      }

      const normalizedRaw = isFormulaInput(nextRaw) ? normalizeFormulaAliases(nextRaw) : nextRaw;
      const validationMessage = validateCellAgainstRules(normalizedRaw, activeSheet.validations, column);
      if (validationMessage) {
        setValidationError(validationMessage);
        return;
      }
      setValidationError(null);

      const ySheets = yRoot.get(Y_KEY_SHEETS);
      if (!(ySheets instanceof Y.Array)) {
        return;
      }

      const ySheet = ySheets
        .toArray()
        .find((entry) => entry instanceof Y.Map && entry.get("id") === activeSheet.id);

      if (!(ySheet instanceof Y.Map)) {
        return;
      }

      const yRows = ySheet.get("rows");
      if (!(yRows instanceof Y.Array)) {
        return;
      }

      const yRow = yRows.get(rowIndex);
      if (!(yRow instanceof Y.Map)) {
        return;
      }

      const currentCell = parseCellFromY(yRow.get(column));

      yDoc.transact(
        () => {
          yRow.set(
            column,
            stringifyCellForY({
              ...currentCell,
              value: normalizedRaw
            })
          );
        },
        "table-editor"
      );

      const columnIndex = activeSheet.columns.indexOf(column);
      if (columnIndex >= 0 && hfRef.current) {
        const sheetId = hfRef.current.getSheetId(activeSheet.id);
        if (sheetId !== undefined) {
          try {
            hfRef.current.setCellContents(
              {
                sheet: sheetId,
                row: rowIndex,
                col: columnIndex
              },
              [[normalizedRaw.trim().length > 0 ? normalizedRaw : null]]
            );
            localIncrementalMutationRef.current = true;
            setCalcRevision((revision) => revision + 1);
          } catch {
            // HyperFormula throws while formulas are still incomplete (for example "=" or "=SUM(").
            if (isPotentiallyIncompleteFormula(normalizedRaw)) {
              return;
            }
          }
        }
      }
    },
    [activeSheet.columns, activeSheet.id, activeSheet.validations, readOnly, yDoc, yRoot]
  );

  const patchSelectedCellStyle = useCallback(
    (patch: Partial<TableStyleV2>) => {
      if (!selectedCell || readOnly) {
        return;
      }

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        const row = sheet.rows[selectedCell.rowIndex];
        if (!row) {
          return currentWorkbook;
        }

        const currentCell = row[selectedCell.column] ?? { value: "" };
        const nextStyle: TableStyleV2 = {
          ...(currentCell.style ?? {}),
          ...patch
        };

        row[selectedCell.column] = {
          ...currentCell,
          style: nextStyle
        };

        return currentWorkbook;
      });
    },
    [commitWorkbookMutation, readOnly, selectedCell]
  );

  const applyBorderPreset = useCallback(
    (preset: NonNullable<TableStyleV2["borderPreset"]>) => {
      if (!selectedCell) {
        return;
      }

      if (preset === "none") {
        patchSelectedCellStyle({
          borderPreset: "none",
          border: "none",
          borders: {}
        });
        return;
      }

      const edgeStyle = {
        color: "#9ca3af",
        width: 1,
        style: "solid" as const
      };

      patchSelectedCellStyle({
        borderPreset: preset,
        border: preset === "all" ? "all" : "none",
        borders: {
          top: edgeStyle,
          right: edgeStyle,
          bottom: edgeStyle,
          left: edgeStyle
        }
      });
    },
    [patchSelectedCellStyle, selectedCell]
  );

  const formulaSuggestions = useMemo(() => {
    if (!formulaQuery) {
      return [];
    }

    const query = formulaQuery.toUpperCase();
    const canonicalHints = formulaHints
      .filter((hint) => hint.name.startsWith(query))
      .map((hint) => ({
        ...hint,
        ...(formulaHintsByName.get(hint.name) ?? {})
      }));

    const aliasHints = formulaAliasEntries
      .filter((entry) => entry.alias.startsWith(query))
      .map((entry) => {
        const canonical = formulaHintsByName.get(entry.canonical);
        return {
          name: entry.canonical,
          signature: canonical?.signature ?? `${entry.canonical}(...)`,
          description: `${entry.alias} (alias) → ${entry.canonical}`
        };
      });

    const dedup = new Map<string, FormulaFunctionHint>();
    [...aliasHints, ...canonicalHints].forEach((hint) => {
      if (!dedup.has(hint.name)) {
        dedup.set(hint.name, hint);
      }
    });

    return Array.from(dedup.values()).slice(0, 8);
  }, [formulaHints, formulaQuery]);

  const setSelectionFromGridEvent = useCallback(
    (event: any) => {
      const actualRowIndex = Number(event.data?.__rowIndex ?? -1);
      const column = event.colDef.field;
      if (actualRowIndex < 0 || !column) {
        setSelectedCell(null);
        setSelectedRange(null);
        return;
      }

      const columnIndex = activeSheet.columns.indexOf(column);
      if (columnIndex < 0) {
        return;
      }

      const clickedCell: CellAddress = {
        rowIndex: actualRowIndex,
        column,
        columnIndex
      };

      const nativeEvent = event.event as MouseEvent | KeyboardEvent | undefined;
      const shiftPressed = Boolean(nativeEvent?.shiftKey);
      const multiPressed = Boolean(nativeEvent?.ctrlKey || nativeEvent?.metaKey);

      if (
        formulaAnchorCell &&
        formulaEditMode === "editingFormula" &&
        (formulaAnchorCell.rowIndex !== clickedCell.rowIndex ||
          formulaAnchorCell.column !== clickedCell.column)
      ) {
        const input = formulaBarRef.current;
        const start = input?.selectionStart ?? formulaDraft.length;
        const end = input?.selectionEnd ?? start;
        const reference = toCellAddressLabel(clickedCell);
        const inserted = insertReferenceAtCursor(formulaDraft, reference, start, end);

        setFormulaDraft(inserted.value);
        updateCellRawValue(formulaAnchorCell.rowIndex, formulaAnchorCell.column, inserted.value);
        updateFormulaQuery(inserted.value, inserted.cursor);
        focusFormulaBar(inserted.cursor);
        return;
      }

      setSelectedCell(clickedCell);
      if (shiftPressed) {
        const anchor = selectionAnchor ?? selectedCell ?? clickedCell;
        setSelectedRange({
          start: anchor,
          end: clickedCell
        });
      } else {
        setSelectedRange(null);
      }

      if (multiPressed) {
        setSelectedRanges((current) => [...current, toSelectionRange(clickedCell, clickedCell)]);
      } else if (!shiftPressed) {
        setSelectedRanges([]);
      }

      setSelectionAnchor((current) => (shiftPressed ? current ?? clickedCell : clickedCell));

      if (formatPainterArmed && formatPainterStyleRef.current && !readOnly) {
        const styleToApply = { ...formatPainterStyleRef.current };
        commitWorkbookMutation((currentWorkbook) => {
          const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
          if (!sheet) {
            return currentWorkbook;
          }
          const row = sheet.rows[clickedCell.rowIndex];
          if (!row) {
            return currentWorkbook;
          }
          const currentCell = row[clickedCell.column] ?? { value: "" };
          row[clickedCell.column] = {
            ...currentCell,
            style: styleToApply
          };
          return currentWorkbook;
        });
        setFormatPainterArmed(false);
      }

      setFormulaAnchorCell(null);
      setFormulaEditMode("idle");
      setFormulaQuery(null);
    },
    [
      activeSheet.columns,
      focusFormulaBar,
      formulaAnchorCell,
      formulaDraft,
      formulaEditMode,
      formatPainterArmed,
      selectedCell,
      selectionAnchor,
      commitWorkbookMutation,
      readOnly,
      updateCellRawValue,
      updateFormulaQuery
    ]
  );

  const insertFormulaFunction = useCallback(
    (funcName: string) => {
      const anchor = formulaAnchorCell ?? selectedCell;
      if (!anchor || !formulaBarRef.current) {
        return;
      }

      const input = formulaBarRef.current;
      const current = formulaAnchorCell ? formulaDraft : activeFormulaValue;
      const start = input.selectionStart ?? current.length;
      const end = input.selectionEnd ?? start;
      const tokenMatch = current.slice(0, start).match(/[A-Za-z][A-Za-z0-9_]*$/);
      if (!tokenMatch) {
        return;
      }

      const tokenStart = tokenMatch.index ?? start;
      const nextValue = `${current.slice(0, tokenStart)}${funcName}(${current.slice(end)}`;
      const nextCursor = tokenStart + funcName.length + 1;

      setFormulaAnchorCell(anchor);
      setFormulaDraft(nextValue);
      setFormulaEditMode("editingFormula");
      updateCellRawValue(anchor.rowIndex, anchor.column, nextValue);
      setFormulaQuery(null);
      focusFormulaBar(nextCursor);
    },
    [activeFormulaValue, focusFormulaBar, formulaAnchorCell, formulaDraft, selectedCell, updateCellRawValue]
  );

  const getCellAddressFromGridEvent = useCallback(
    (event: any): CellAddress | null => {
      const actualRowIndex = Number(event.data?.__rowIndex ?? -1);
      const column = "colDef" in event ? event.colDef?.field : event.column?.getColId?.();
      if (actualRowIndex < 0 || !column) {
        return null;
      }

      const columnIndex = activeSheet.columns.indexOf(column);
      if (columnIndex < 0) {
        return null;
      }

      return {
        rowIndex: actualRowIndex,
        column,
        columnIndex
      };
    },
    [activeSheet.columns]
  );

  const commitFormulaRangeReference = useCallback(
    (startCell: CellAddress, endCell: CellAddress) => {
      if (!formulaAnchorCell || formulaEditMode !== "editingFormula") {
        return;
      }

      const input = formulaBarRef.current;
      const start = input?.selectionStart ?? formulaDraft.length;
      const end = input?.selectionEnd ?? start;

      const rangeStartLabel = toCellAddressLabel(startCell);
      const rangeEndLabel = toCellAddressLabel(endCell);
      const reference = rangeStartLabel === rangeEndLabel ? rangeStartLabel : `${rangeStartLabel}:${rangeEndLabel}`;
      const inserted = insertReferenceAtCursor(formulaDraft, reference, start, end);

      setFormulaDraft(inserted.value);
      updateCellRawValue(formulaAnchorCell.rowIndex, formulaAnchorCell.column, inserted.value);
      updateFormulaQuery(inserted.value, inserted.cursor);
      focusFormulaBar(inserted.cursor);
    },
    [focusFormulaBar, formulaAnchorCell, formulaDraft, formulaEditMode, updateCellRawValue, updateFormulaQuery]
  );

  const onGridCellMouseDown = useCallback(
    (event: any) => {
      const cellAddress = getCellAddressFromGridEvent(event);
      if (!cellAddress) {
        return;
      }

      if (formulaAnchorCell && formulaEditMode === "editingFormula") {
        isDraggingFormulaReferenceRef.current = true;
        draggedRangeEndRef.current = cellAddress;
        setSelectedRange({
          start: cellAddress,
          end: cellAddress
        });
        return;
      }

      isDraggingSelectionRef.current = true;
      setSelectionAnchor(cellAddress);
      setSelectedCell(cellAddress);
      setSelectedRange({
        start: cellAddress,
        end: cellAddress
      });

      const native = event.event as MouseEvent | undefined;
      if (!native?.ctrlKey && !native?.metaKey) {
        setSelectedRanges([]);
      }
    },
    [formulaAnchorCell, formulaEditMode, getCellAddressFromGridEvent]
  );

  const onGridCellMouseOver = useCallback(
    (event: any) => {
      const cellAddress = getCellAddressFromGridEvent(event);
      if (!cellAddress) {
        return;
      }

      if (isDraggingFormulaReferenceRef.current) {
        draggedRangeEndRef.current = cellAddress;
        setSelectedRange((current) =>
          current
            ? {
                start: current.start,
                end: cellAddress
              }
            : {
                start: cellAddress,
                end: cellAddress
              }
        );
        return;
      }

      if (!isDraggingSelectionRef.current || !selectionAnchor) {
        return;
      }

      setSelectedRange({
        start: selectionAnchor,
        end: cellAddress
      });
      setSelectedCell(cellAddress);
    },
    [getCellAddressFromGridEvent, selectionAnchor]
  );

  useEffect(() => {
    const handlePointerUp = () => {
      if (isDraggingFormulaReferenceRef.current && selectedRange) {
        commitFormulaRangeReference(selectedRange.start, selectedRange.end);
      }

      if (isDraggingSelectionRef.current && selectedRange) {
        setSelectedRanges((current) =>
          current.length > 0
            ? current
            : [
                {
                  start: {
                    rowIndex: Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
                    columnIndex: Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
                  },
                  end: {
                    rowIndex: Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
                    columnIndex: Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
                  }
                }
              ]
        );
      }

      isDraggingSelectionRef.current = false;
      isDraggingFormulaReferenceRef.current = false;
      draggedRangeEndRef.current = null;
    };

    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchend", handlePointerUp);
    return () => {
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [commitFormulaRangeReference, selectedRange]);

  const applyFilter = useCallback(() => {
    if (!filterColumn) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.filters = filterValue.trim().length
        ? [
            {
              column: filterColumn,
              operator: "contains",
              value: filterValue
            }
          ]
        : [];

      sheet.filterStates = filterValue.trim().length
        ? [
            {
              column: filterColumn,
              selectedValues: [],
              condition: {
                mode: "contains",
                value: filterValue
              }
            }
          ]
        : sheet.filterStates.filter((state) => state.column !== filterColumn);

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, filterColumn, filterValue]);

  const clearFilter = useCallback(() => {
    setFilterValue("");
    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.filters = [];
      sheet.filterStates = [];
      return currentWorkbook;
    });
  }, [commitWorkbookMutation]);

  const applySort = useCallback(() => {
    if (!sortColumn) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.sort = {
        column: sortColumn,
        direction: sortDirection
      };

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, sortColumn, sortDirection]);

  const clearSort = useCallback(() => {
    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.sort = null;
      return currentWorkbook;
    });
  }, [commitWorkbookMutation]);

  const activeFilterState = useMemo(() => {
    if (!activeFilterStateColumn) {
      return null;
    }
    return (
      activeSheet.filterStates.find((state) => state.column === activeFilterStateColumn) ?? {
        column: activeFilterStateColumn,
        selectedValues: []
      }
    );
  }, [activeFilterStateColumn, activeSheet.filterStates]);

  const availableFilterValues = useMemo(() => {
    if (!activeFilterStateColumn) {
      return [];
    }
    const unique = new Set<string>();
    activeSheet.rows.forEach((row) => {
      unique.add(row[activeFilterStateColumn]?.value ?? "");
    });

    const query = filterStateSearch.trim().toLowerCase();
    const all = Array.from(unique).sort((left, right) => left.localeCompare(right, "es"));
    if (!query) {
      return all.slice(0, 150);
    }
    return all.filter((valueEntry) => valueEntry.toLowerCase().includes(query)).slice(0, 150);
  }, [activeFilterStateColumn, activeSheet.rows, filterStateSearch]);

  const toggleFilterValueSelection = useCallback(
    (valueEntry: string) => {
      if (!activeFilterStateColumn) {
        return;
      }

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        const existing =
          sheet.filterStates.find((filterState) => filterState.column === activeFilterStateColumn) ?? null;
        if (!existing) {
          sheet.filterStates.push({
            column: activeFilterStateColumn,
            selectedValues: [valueEntry]
          });
          return currentWorkbook;
        }

        const selected = new Set(existing.selectedValues);
        if (selected.has(valueEntry)) {
          selected.delete(valueEntry);
        } else {
          selected.add(valueEntry);
        }
        existing.selectedValues = Array.from(selected);

        return currentWorkbook;
      });
    },
    [activeFilterStateColumn, commitWorkbookMutation]
  );

  const clearFilterState = useCallback(() => {
    if (!activeFilterStateColumn) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }
      sheet.filterStates = sheet.filterStates.filter((state) => state.column !== activeFilterStateColumn);
      return currentWorkbook;
    });
  }, [activeFilterStateColumn, commitWorkbookMutation]);

  const saveValidationRule = useCallback(() => {
    if (!validationEditor.column) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.validations = sheet.validations.filter((rule) => rule.column !== validationEditor.column);

      if (validationEditor.type === "list") {
        const values = validationEditor.values
          .split(",")
          .map((valueEntry) => valueEntry.trim())
          .filter(Boolean);
        if (values.length === 0) {
          return currentWorkbook;
        }
        sheet.validations.push({
          type: "list",
          column: validationEditor.column,
          values,
          allowBlank: true,
          ...(validationEditor.message.trim()
            ? { message: validationEditor.message.trim().slice(0, 160) }
            : {})
        });
        return currentWorkbook;
      }

      if (validationEditor.type === "numberRange") {
        sheet.validations.push({
          type: "numberRange",
          column: validationEditor.column,
          allowBlank: true,
          ...(validationEditor.min.trim() ? { min: Number(validationEditor.min) } : {}),
          ...(validationEditor.max.trim() ? { max: Number(validationEditor.max) } : {}),
          ...(validationEditor.message.trim()
            ? { message: validationEditor.message.trim().slice(0, 160) }
            : {})
        });
        return currentWorkbook;
      }

      sheet.validations.push({
        type: "dateRange",
        column: validationEditor.column,
        allowBlank: true,
        ...(validationEditor.min.trim() ? { min: validationEditor.min.trim() } : {}),
        ...(validationEditor.max.trim() ? { max: validationEditor.max.trim() } : {}),
        ...(validationEditor.message.trim()
          ? { message: validationEditor.message.trim().slice(0, 160) }
          : {})
      });
      return currentWorkbook;
    });
  }, [commitWorkbookMutation, validationEditor]);

  const findNext = useCallback(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return;
    }

    const startRow = selectedCell?.rowIndex ?? -1;
    const startCol = selectedCell?.columnIndex ?? -1;

    const scanRows = [...displayedRowIndexes, ...displayedRowIndexes];
    let started = startRow < 0;

    for (const rowIndex of scanRows) {
      const row = activeSheet.rows[rowIndex];
      if (!row) {
        continue;
      }

      for (let columnIndex = 0; columnIndex < activeSheet.columns.length; columnIndex += 1) {
        const column = activeSheet.columns[columnIndex]!;

        if (!started) {
          if (rowIndex === startRow && columnIndex <= startCol) {
            continue;
          }
          started = true;
        }

        const cellValue = row[column]?.value ?? "";
        if (!cellValue.toLowerCase().includes(query)) {
          continue;
        }

        setSelectedCell({ rowIndex, column, columnIndex });
        setFormulaAnchorCell(null);
        setFormulaEditMode("idle");

        const displayIndex = displayedRowIndexes.indexOf(rowIndex);
        if (displayIndex >= 0) {
          gridApiRef.current?.ensureIndexVisible(Math.max(0, displayIndex - freezeRows));
          gridApiRef.current?.ensureColumnVisible(column);
        }
        return;
      }
    }
  }, [activeSheet, displayedRowIndexes, freezeRows, searchText, selectedCell]);

  const replaceAll = useCallback(() => {
    const query = searchText.trim();
    if (!query || readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.rows = sheet.rows.map((row) =>
        Object.fromEntries(
          sheet.columns.map((column) => {
            const currentCell = row[column] ?? { value: "" };
            const nextValue = currentCell.value.split(query).join(replaceText);
            return [
              column,
              {
                ...currentCell,
                value: nextValue
              } satisfies TableCellV2
            ];
          })
        )
      );

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly, replaceText, searchText]);

  const addRow = useCallback(() => {
    if (readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      const newRow = Object.fromEntries(sheet.columns.map((column) => [column, { value: "" }])) as Record<
        string,
        TableCellV2
      >;
      sheet.rows.push(newRow);
      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly]);

  const removeLastRow = useCallback(() => {
    if (readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet || sheet.rows.length <= 1) {
        return currentWorkbook;
      }

      sheet.rows.pop();
      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly]);

  const addColumn = useCallback(() => {
    if (readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      const nextColumn = createColumnLabelFromIndex(sheet.columns.length);
      sheet.columns.push(nextColumn);
      sheet.rows = sheet.rows.map((row) => ({
        ...row,
        [nextColumn]: { value: "" }
      }));

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly]);

  const removeLastColumn = useCallback(() => {
    if (readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet || sheet.columns.length <= 1) {
        return currentWorkbook;
      }

      const lastColumn = sheet.columns.pop();
      if (!lastColumn) {
        return currentWorkbook;
      }

      sheet.rows = sheet.rows.map((row) => {
        const next = { ...row };
        delete next[lastColumn];
        return next;
      });

      if (sheet.sort?.column === lastColumn) {
        sheet.sort = null;
      }

      sheet.filters = sheet.filters.filter((rule) => rule.column !== lastColumn);

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly]);

  const insertColumnAt = useCallback(
    (targetIndex: number) => {
      if (readOnly) {
        return;
      }

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        const previousColumns = [...sheet.columns];
        const nextColumn = createColumnLabelFromIndex(sheet.columns.length);
        const safeIndex = Math.max(0, Math.min(targetIndex, sheet.columns.length));
        sheet.columns.splice(safeIndex, 0, nextColumn);
        sheet.rows = sheet.rows.map((row) => {
          const entries = sheet.columns.map((column) => {
            if (column === nextColumn) {
              return [column, { value: "" }] as const;
            }
            return [column, row[column] ?? row[previousColumns[safeIndex] ?? ""] ?? { value: "" }] as const;
          });
          return Object.fromEntries(entries) as Record<string, TableCellV2>;
        });

        return currentWorkbook;
      });
    },
    [commitWorkbookMutation, readOnly]
  );

  const removeColumnAt = useCallback(
    (targetColumn: string) => {
      if (readOnly) {
        return;
      }

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet || sheet.columns.length <= 1) {
          return currentWorkbook;
        }

        if (!sheet.columns.includes(targetColumn)) {
          return currentWorkbook;
        }

        sheet.columns = sheet.columns.filter((column) => column !== targetColumn);
        sheet.rows = sheet.rows.map((row) => {
          const nextRow = { ...row };
          delete nextRow[targetColumn];
          return nextRow;
        });
        sheet.filters = sheet.filters.filter((rule) => rule.column !== targetColumn);
        sheet.filterStates = sheet.filterStates.filter((state) => state.column !== targetColumn);
        sheet.validations = sheet.validations.filter((rule) => rule.column !== targetColumn);
        sheet.dimensions.hiddenColumns = sheet.dimensions.hiddenColumns.filter((column) => column !== targetColumn);
        delete sheet.dimensions.columnWidths[targetColumn];
        if (sheet.sort?.column === targetColumn) {
          sheet.sort = null;
        }

        return currentWorkbook;
      });
    },
    [commitWorkbookMutation, readOnly]
  );

  const toggleColumnHidden = useCallback(
    (column: string) => {
      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        const hidden = new Set(sheet.dimensions.hiddenColumns);
        if (hidden.has(column)) {
          hidden.delete(column);
        } else {
          hidden.add(column);
        }
        sheet.dimensions.hiddenColumns = Array.from(hidden);
        return currentWorkbook;
      });
    },
    [commitWorkbookMutation]
  );

  const addSheet = useCallback(() => {
    if (readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const newSheet = createEmptySheetV2(`Sheet ${currentWorkbook.sheets.length + 1}`);
      newSheet.id = createSheetId();
      currentWorkbook.sheets.push(newSheet);
      currentWorkbook.activeSheetId = newSheet.id;
      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly]);

  const duplicateActiveSheet = useCallback(() => {
    if (readOnly) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      const copy: TableSheetV2 = {
        ...sheet,
        id: createSheetId(),
        name: `${sheet.name} (copy)`,
        columns: [...sheet.columns],
        rows: sheet.rows.map((row) =>
          Object.fromEntries(
            sheet.columns.map((column) => {
              const cell = row[column] ?? { value: "" };
              return [column, { ...cell, ...(cell.style ? { style: { ...cell.style } } : {}) }];
            })
          )
        ),
        filters: sheet.filters.map((rule) => ({ ...rule })),
        sort: sheet.sort ? { ...sheet.sort } : null,
        view: { ...sheet.view }
      };

      currentWorkbook.sheets.push(copy);
      currentWorkbook.activeSheetId = copy.id;
      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly]);

  const removeActiveSheet = useCallback(() => {
    if (readOnly || workbook.sheets.length <= 1) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const index = currentWorkbook.sheets.findIndex((sheet) => sheet.id === currentWorkbook.activeSheetId);
      if (index < 0 || currentWorkbook.sheets.length <= 1) {
        return currentWorkbook;
      }

      currentWorkbook.sheets.splice(index, 1);
      currentWorkbook.activeSheetId =
        currentWorkbook.sheets[Math.max(0, index - 1)]?.id ?? currentWorkbook.sheets[0]!.id;
      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly, workbook.sheets.length]);

  const renameActiveSheet = useCallback(() => {
    if (readOnly) {
      return;
    }

    const sheet = getSheetById(workbook, workbook.activeSheetId);
    if (!sheet) {
      return;
    }

    setSheetRenameTargetId(sheet.id);
    setSheetRenameValue(sheet.name);
    setSheetRenameModalOpen(true);
  }, [readOnly, workbook]);

  const submitSheetRename = useCallback(() => {
    if (readOnly || !sheetRenameTargetId) {
      return;
    }

    const nextName = sheetRenameValue.trim();
    if (!nextName) {
      return;
    }

    commitWorkbookMutation((currentWorkbook) => {
      const target = getSheetById(currentWorkbook, sheetRenameTargetId);
      if (!target) {
        return currentWorkbook;
      }
      target.name = nextName.slice(0, 40);
      return currentWorkbook;
    });
    setSheetRenameModalOpen(false);
    setSheetRenameTargetId(null);
  }, [commitWorkbookMutation, readOnly, sheetRenameTargetId, sheetRenameValue]);

  const fillDown = useCallback(() => {
    if (readOnly || !selectedCell) {
      return;
    }
    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      const sourceStartRow = selectedRange
        ? Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex)
        : selectedCell.rowIndex;
      const sourceEndRow = selectedRange
        ? Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex)
        : selectedCell.rowIndex;
      const sourceStartCol = selectedRange
        ? Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
        : selectedCell.columnIndex;
      const sourceEndCol = selectedRange
        ? Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
        : selectedCell.columnIndex;

      const fillLength = sheet.rows.length - sourceEndRow - 1;
      if (fillLength <= 0) {
        return currentWorkbook;
      }

      for (let colIndex = sourceStartCol; colIndex <= sourceEndCol; colIndex += 1) {
        const column = sheet.columns[colIndex];
        if (!column) {
          continue;
        }

        const seeds = Array.from({ length: sourceEndRow - sourceStartRow + 1 }, (_, offset) => {
          const rowIndex = sourceStartRow + offset;
          return sheet.rows[rowIndex]?.[column]?.value ?? "";
        });

        const generated = applyFillSeries({
          sourceValues: seeds,
          fillLength,
          direction: "down",
          mode: "series"
        });

        generated.forEach((nextValue, offset) => {
          const targetRow = sourceEndRow + 1 + offset;
          const currentCell = sheet.rows[targetRow]?.[column] ?? { value: "" };
          sheet.rows[targetRow]![column] = {
            ...currentCell,
            value: nextValue
          };
        });
      }

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly, selectedCell, selectedRange]);

  const fillRight = useCallback(() => {
    if (readOnly || !selectedCell) {
      return;
    }
    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      const sourceStartRow = selectedRange
        ? Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex)
        : selectedCell.rowIndex;
      const sourceEndRow = selectedRange
        ? Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex)
        : selectedCell.rowIndex;
      const sourceStartCol = selectedRange
        ? Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
        : selectedCell.columnIndex;
      const sourceEndCol = selectedRange
        ? Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
        : selectedCell.columnIndex;

      const fillLength = sheet.columns.length - sourceEndCol - 1;
      if (fillLength <= 0) {
        return currentWorkbook;
      }

      for (let rowIndex = sourceStartRow; rowIndex <= sourceEndRow; rowIndex += 1) {
        const seeds = Array.from({ length: sourceEndCol - sourceStartCol + 1 }, (_, offset) => {
          const colIndex = sourceStartCol + offset;
          const column = sheet.columns[colIndex];
          return column ? sheet.rows[rowIndex]?.[column]?.value ?? "" : "";
        });

        const generated = applyFillSeries({
          sourceValues: seeds,
          fillLength,
          direction: "right",
          mode: "series"
        });

        generated.forEach((nextValue, offset) => {
          const column = sheet.columns[sourceEndCol + 1 + offset];
          if (!column) {
            return;
          }
          const currentCell = sheet.rows[rowIndex]?.[column] ?? { value: "" };
          sheet.rows[rowIndex]![column] = {
            ...currentCell,
            value: nextValue
          };
        });
      }

      return currentWorkbook;
    });
  }, [commitWorkbookMutation, readOnly, selectedCell, selectedRange]);

  const getCellAddressFromPoint = useCallback(
    (clientX: number, clientY: number): CellAddress | null => {
      const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const cell = element?.closest(".ag-cell") as HTMLElement | null;
      if (!cell) {
        return null;
      }

      const column = cell.getAttribute("col-id");
      const rowElement = cell.closest(".ag-row") as HTMLElement | null;
      if (!column || !rowElement) {
        return null;
      }

      const rawRowIndex = Number(rowElement.getAttribute("row-index") ?? "-1");
      if (rawRowIndex < 0) {
        return null;
      }

      const inPinned = Boolean(rowElement.closest(".ag-pinned-top-container"));
      const displayIndex = inPinned ? rawRowIndex : rawRowIndex + freezeRows;
      const actualRowIndex = displayedRowIndexes[displayIndex];
      if (typeof actualRowIndex !== "number") {
        return null;
      }

      const columnIndex = activeSheet.columns.indexOf(column);
      if (columnIndex < 0) {
        return null;
      }

      return {
        rowIndex: actualRowIndex,
        column,
        columnIndex
      };
    },
    [activeSheet.columns, displayedRowIndexes, freezeRows]
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!fillDragStateRef.current.active) {
        return;
      }

      const hovered = getCellAddressFromPoint(event.clientX, event.clientY);
      if (!hovered) {
        return;
      }

      fillDragStateRef.current.targetCell = hovered;
      const sourceRange = fillDragStateRef.current.sourceRange;
      if (!sourceRange) {
        return;
      }

      setSelectedRange({
        start: {
          rowIndex: sourceRange.start.rowIndex,
          column: activeSheet.columns[sourceRange.start.columnIndex] ?? activeSheet.columns[0] ?? "A",
          columnIndex: sourceRange.start.columnIndex
        },
        end: hovered
      });
    };

    const onPointerUp = () => {
      const dragState = fillDragStateRef.current;
      if (!dragState.active || !dragState.sourceRange || !dragState.targetCell || readOnly) {
        fillDragStateRef.current = {
          active: false,
          sourceRange: null,
          targetCell: null
        };
        return;
      }

      const source = dragState.sourceRange;
      const target = dragState.targetCell;
      const sourceEndRow = source.end.rowIndex;
      const sourceEndCol = source.end.columnIndex;
      const sourceStartRow = source.start.rowIndex;
      const sourceStartCol = source.start.columnIndex;

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        if (target.rowIndex > sourceEndRow) {
          const fillLength = target.rowIndex - sourceEndRow;
          for (let col = sourceStartCol; col <= sourceEndCol; col += 1) {
            const column = sheet.columns[col];
            if (!column) {
              continue;
            }

            const seeds = Array.from({ length: sourceEndRow - sourceStartRow + 1 }, (_, offset) => {
              const rowIndex = sourceStartRow + offset;
              return sheet.rows[rowIndex]?.[column]?.value ?? "";
            });
            const generated = applyFillSeries({
              sourceValues: seeds,
              fillLength,
              direction: "down",
              mode: "series"
            });
            generated.forEach((valueEntry, offset) => {
              const rowIndex = sourceEndRow + 1 + offset;
              const cell = sheet.rows[rowIndex]?.[column] ?? { value: "" };
              sheet.rows[rowIndex]![column] = {
                ...cell,
                value: valueEntry
              };
            });
          }
        } else if (target.columnIndex > sourceEndCol) {
          const fillLength = target.columnIndex - sourceEndCol;
          for (let row = sourceStartRow; row <= sourceEndRow; row += 1) {
            const seeds = Array.from({ length: sourceEndCol - sourceStartCol + 1 }, (_, offset) => {
              const col = sourceStartCol + offset;
              const column = sheet.columns[col];
              return column ? sheet.rows[row]?.[column]?.value ?? "" : "";
            });
            const generated = applyFillSeries({
              sourceValues: seeds,
              fillLength,
              direction: "right",
              mode: "series"
            });
            generated.forEach((valueEntry, offset) => {
              const column = sheet.columns[sourceEndCol + 1 + offset];
              if (!column) {
                return;
              }
              const cell = sheet.rows[row]?.[column] ?? { value: "" };
              sheet.rows[row]![column] = {
                ...cell,
                value: valueEntry
              };
            });
          }
        }

        return currentWorkbook;
      });

      fillDragStateRef.current = {
        active: false,
        sourceRange: null,
        targetCell: null
      };
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [activeSheet.columns, commitWorkbookMutation, getCellAddressFromPoint, readOnly]);

  const copySelectionToClipboard = useCallback(async () => {
    if (!selectedCell) {
      return;
    }
    const range = selectedRange
      ? {
          startRow: Math.min(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
          endRow: Math.max(selectedRange.start.rowIndex, selectedRange.end.rowIndex),
          startCol: Math.min(selectedRange.start.columnIndex, selectedRange.end.columnIndex),
          endCol: Math.max(selectedRange.start.columnIndex, selectedRange.end.columnIndex)
        }
      : {
          startRow: selectedCell.rowIndex,
          endRow: selectedCell.rowIndex,
          startCol: selectedCell.columnIndex,
          endCol: selectedCell.columnIndex
        };

    const valueToCopy = Array.from({ length: range.endRow - range.startRow + 1 }, (_, rowOffset) => {
      const rowIndex = range.startRow + rowOffset;
      return Array.from({ length: range.endCol - range.startCol + 1 }, (_, colOffset) => {
        const colIndex = range.startCol + colOffset;
        const column = activeSheet.columns[colIndex];
        return column ? activeSheet.rows[rowIndex]?.[column]?.value ?? "" : "";
      }).join("\t");
    }).join("\n");

    copiedCellsRef.current = Array.from({ length: range.endRow - range.startRow + 1 }, (_, rowOffset) => {
      const rowIndex = range.startRow + rowOffset;
      return Array.from({ length: range.endCol - range.startCol + 1 }, (_, colOffset) => {
        const colIndex = range.startCol + colOffset;
        const column = activeSheet.columns[colIndex];
        const cell = column ? activeSheet.rows[rowIndex]?.[column] : null;
        return {
          value: cell?.value ?? "",
          ...(cell?.style ? { style: { ...cell.style } } : {})
        };
      });
    });

    try {
      await navigator.clipboard.writeText(valueToCopy);
    } catch {
      // silent fallback
    }
  }, [activeSheet.columns, activeSheet.rows, selectedCell, selectedRange]);

  const pasteFromClipboard = useCallback(async () => {
    if (readOnly || !selectedCell) {
      return;
    }

    try {
      const content = await navigator.clipboard.readText();
      if (!content.trim()) {
        return;
      }

      const matrix = content
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.split("\t"));

      const sourceCells: TableCellV2[][] =
        copiedCellsRef.current.length > 0
          ? copiedCellsRef.current
          : matrix.map((row) =>
              row.map((cellValue) => ({
                value: cellValue
              }))
            );

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        const requiredRows = selectedCell.rowIndex + sourceCells.length;
        while (sheet.rows.length < requiredRows) {
          sheet.rows.push(
            Object.fromEntries(sheet.columns.map((column) => [column, { value: "" }])) as Record<
              string,
              TableCellV2
            >
          );
        }

        const requiredColumns =
          selectedCell.columnIndex + Math.max(...sourceCells.map((row) => row.length), 1);
        while (sheet.columns.length < requiredColumns) {
          const nextColumn = createColumnLabelFromIndex(sheet.columns.length);
          sheet.columns.push(nextColumn);
          sheet.rows = sheet.rows.map((row) => ({
            ...row,
            [nextColumn]: { value: "" }
          }));
        }

        sourceCells.forEach((rowValues, rowOffset) => {
          const rowIndex = selectedCell.rowIndex + rowOffset;
          rowValues.forEach((sourceCell, columnOffset) => {
            const column = sheet.columns[selectedCell.columnIndex + columnOffset];
            if (!column) {
              return;
            }

            const currentCell = sheet.rows[rowIndex]?.[column] ?? { value: "" };
            sheet.rows[rowIndex]![column] = {
              ...applyPasteSpecial({
                source: sourceCell,
                target: currentCell,
                mode: pasteSpecialMode
              })
            };
          });
        });

        return currentWorkbook;
      });
    } catch {
      // silent fallback
    }
  }, [commitWorkbookMutation, pasteSpecialMode, readOnly, selectedCell]);

  const exportCsv = useCallback(() => {
    const csv = workbookToCsv(workbook, activeSheet.id);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentId}-${activeSheet.name}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [activeSheet.id, activeSheet.name, documentId, workbook]);

  const exportXlsx = useCallback(() => {
    const buffer = workbookToXlsxArrayBuffer(workbook);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentId}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [documentId, workbook]);

  const importCsv = useCallback(
    async (file: File) => {
      const content = await file.text();
      const imported = csvToWorkbookV2(content);
      writeWorkbookToY(imported);
      setSelectedCell(null);
      setFormulaAnchorCell(null);
      setFormulaEditMode("idle");
    },
    [writeWorkbookToY]
  );

  const importXlsx = useCallback(
    async (file: File) => {
      const content = await file.arrayBuffer();
      const imported = xlsxArrayBufferToWorkbookV2(content);
      writeWorkbookToY(imported);
      setSelectedCell(null);
      setFormulaAnchorCell(null);
      setFormulaEditMode("idle");
    },
    [writeWorkbookToY]
  );

  const toggleGridlines = useCallback(() => {
    commitWorkbookMutation((currentWorkbook) => {
      const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
      if (!sheet) {
        return currentWorkbook;
      }

      sheet.view.gridlines = !sheet.view.gridlines;
      return currentWorkbook;
    });
  }, [commitWorkbookMutation]);

  const adjustView = useCallback(
    (patch: Partial<TableSheetV2["view"]>) => {
      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        sheet.view = {
          ...sheet.view,
          ...patch
        };

        return currentWorkbook;
      });
    },
    [commitWorkbookMutation]
  );

  const onFormulaBarChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const anchor = formulaAnchorCell ?? selectedCell;
      if (!anchor) {
        return;
      }

      const nextValue = event.target.value;
      const cursor = event.target.selectionStart ?? nextValue.length;
      const mode = isFormulaInput(nextValue) ? "editingFormula" : "editingValue";

      setFormulaAnchorCell(anchor);
      setFormulaDraft(nextValue);
      setFormulaEditMode(mode);
      updateFormulaQuery(nextValue, cursor);
      updateCellRawValue(anchor.rowIndex, anchor.column, nextValue);
    },
    [formulaAnchorCell, selectedCell, updateCellRawValue, updateFormulaQuery]
  );

  const onFormulaBarKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "F4") {
        event.preventDefault();
        const cursor = event.currentTarget.selectionStart ?? formulaDraft.length;
        const toggled = toggleAbsoluteReference(formulaDraft, cursor);
        setFormulaDraft(toggled.value);
        const anchor = formulaAnchorCell ?? selectedCell;
        if (anchor) {
          updateCellRawValue(anchor.rowIndex, anchor.column, toggled.value);
          updateFormulaQuery(toggled.value, toggled.cursor);
          focusFormulaBar(toggled.cursor);
        }
        return;
      }

      if (formulaSuggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFormulaDropdownIndex((current) => Math.min(current + 1, formulaSuggestions.length - 1));
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setFormulaDropdownIndex((current) => Math.max(current - 1, 0));
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const selected = formulaSuggestions[formulaDropdownIndex];
          if (selected) {
            insertFormulaFunction(selected.name);
          }
          return;
        }
      }

      if (event.key === "Escape") {
        setFormulaQuery(null);
        setFormulaEditMode("idle");
      }
    },
    [
      focusFormulaBar,
      formulaAnchorCell,
      formulaDraft,
      formulaDropdownIndex,
      formulaSuggestions,
      insertFormulaFunction,
      selectedCell,
      updateCellRawValue,
      updateFormulaQuery
    ]
  );

  const moveSelectionBy = useCallback(
    (rowDelta: number, columnDelta: number, extendRange = false) => {
      if (!selectedCell) {
        return;
      }

      const nextRow = Math.max(0, Math.min(activeSheet.rows.length - 1, selectedCell.rowIndex + rowDelta));
      const nextCol = Math.max(
        0,
        Math.min(activeSheet.columns.length - 1, selectedCell.columnIndex + columnDelta)
      );
      const column = activeSheet.columns[nextCol];
      if (!column) {
        return;
      }

      const nextCell: CellAddress = {
        rowIndex: nextRow,
        column,
        columnIndex: nextCol
      };

      setSelectedCell(nextCell);
      if (extendRange) {
        const anchor = selectionAnchor ?? selectedCell;
        setSelectedRange({
          start: anchor,
          end: nextCell
        });
      } else {
        setSelectedRange(null);
        setSelectionAnchor(nextCell);
      }

      const displayIndex = displayedRowIndexes.indexOf(nextRow);
      if (displayIndex >= 0) {
        gridApiRef.current?.ensureIndexVisible(Math.max(0, displayIndex - freezeRows));
        gridApiRef.current?.ensureColumnVisible(column);
      }
    },
    [activeSheet.columns, activeSheet.rows.length, displayedRowIndexes, freezeRows, selectedCell, selectionAnchor]
  );

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInputTarget =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("input,textarea,[contenteditable='true']"));

      const formulaFocused = document.activeElement === formulaBarRef.current;
      if (isInputTarget && !formulaFocused) {
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copySelectionToClipboard();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        void copySelectionToClipboard();
        if (selectedCell && !readOnly) {
          updateCellRawValue(selectedCell.rowIndex, selectedCell.column, "");
        }
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        void pasteFromClipboard();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoManagerRef.current?.undo();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        undoManagerRef.current?.redo();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        patchSelectedCellStyle({
          bold: !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.bold ?? false)
        });
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        patchSelectedCellStyle({
          italic: !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.italic ?? false)
        });
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        patchSelectedCellStyle({
          underline: !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.underline ?? false)
        });
        return;
      }

      if (event.ctrlKey && event.key === "1") {
        event.preventDefault();
        setFormatPanelOpen((current) => !current);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setActiveRibbonTab("DATOS");
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        setActiveRibbonTab("DATOS");
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (!selectedCell) {
          return;
        }
        setActiveFilterStateColumn(selectedCell.column);
        return;
      }

      if (event.altKey && event.key === "=" && selectedCell && !readOnly) {
        event.preventDefault();
        const column = selectedCell.column;
        const upperRow = Math.max(0, selectedCell.rowIndex - 1);
        const formula = `=SUM(${column}1:${column}${upperRow + 1})`;
        updateCellRawValue(selectedCell.rowIndex, selectedCell.column, formula);
        setFormulaDraft(formula);
        setFormulaEditMode("editingFormula");
        return;
      }

      if (!selectedCell || readOnly) {
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        moveSelectionBy(0, event.shiftKey ? -1 : 1, event.shiftKey);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        moveSelectionBy(event.shiftKey ? -1 : 1, 0, event.shiftKey);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelectionBy(0, 1, event.shiftKey);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelectionBy(0, -1, event.shiftKey);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelectionBy(1, 0, event.shiftKey);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelectionBy(-1, 0, event.shiftKey);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    activeSheet.rows,
    copySelectionToClipboard,
    moveSelectionBy,
    patchSelectedCellStyle,
    pasteFromClipboard,
    readOnly,
    selectedCell,
    updateCellRawValue
  ]);

  const onGridReady = useCallback((event: GridReadyEvent<any>) => {
    gridApiRef.current = event.api;
  }, []);

  const onColumnResized = useCallback(
    (event: any) => {
      if (!event.finished) {
        return;
      }

      const columnId = event.column?.getColId?.();
      if (!columnId || columnId === "__rowIndex") {
        return;
      }

      const actualWidth = event.column?.getActualWidth?.();
      if (typeof actualWidth !== "number" || Number.isNaN(actualWidth)) {
        return;
      }

      commitWorkbookMutation((currentWorkbook) => {
        const sheet = getSheetById(currentWorkbook, currentWorkbook.activeSheetId);
        if (!sheet) {
          return currentWorkbook;
        }

        sheet.dimensions.columnWidths[columnId] = Math.max(56, Math.min(640, Math.round(actualWidth)));
        return currentWorkbook;
      });
    },
    [commitWorkbookMutation]
  );

  const onColumnHeaderContextMenu = useCallback((event: any) => {
    const column = event.column?.getColId?.();
    if (!column || column === "__rowIndex") {
      return;
    }

    const native = event.event as MouseEvent | undefined;
    if (native) {
      native.preventDefault();
    }

    setHeaderMenu({
      visible: true,
      x: native?.clientX ?? 0,
      y: native?.clientY ?? 0,
      column
    });
  }, []);

  const columnDefs = useMemo<ColDef<any>[]>(() => {
    const rowNumberCol: ColDef<any> = {
      field: "__rowIndex",
      headerName: "",
      width: 58,
      maxWidth: 58,
      pinned: "left",
      lockPinned: true,
      editable: false,
      suppressMovable: true,
      sortable: false,
      resizable: false,
      valueGetter: (params) => Number(params.data?.__rowIndex ?? 0) + 1,
      cellStyle: {
        backgroundColor: "#f3f4f6",
        color: "#6b7280",
        textAlign: "center",
        fontSize: "11px",
        fontWeight: 700,
        borderRight: "1px solid #d1d5db"
      }
    };

    const visibleColumns = activeSheet.columns.filter(
      (column) => !activeSheet.dimensions.hiddenColumns.includes(column)
    );

    const dataColumns = visibleColumns.map<ColDef<any>>((column, visibleColumnIndex) => ({
      field: column,
      headerName: column,
      editable: !readOnly,
      sortable: false,
      filter: false,
      resizable: true,
      minWidth: 64,
      width: activeSheet.dimensions.columnWidths[column] ?? 120,
      flex: 1,
      ...(visibleColumnIndex < activeSheet.view.freezeColumns ? { pinned: "left" as const } : {}),
      valueGetter: (params) => {
        const rowIndex = Number(params.data?.__rowIndex ?? -1);
        if (rowIndex < 0) {
          return "";
        }

        const raw = activeSheet.rows[rowIndex]?.[column]?.value ?? "";
        const columnIndex = activeSheet.columns.indexOf(column);
        const computed = getComputedCellValue(activeSheet.id, rowIndex, columnIndex, raw);
        return formatCellDisplayValue(computed, activeSheet.rows[rowIndex]?.[column]?.style);
      },
      valueSetter: (params) => {
        if (readOnly) {
          return false;
        }

        const rowIndex = Number(params.data?.__rowIndex ?? -1);
        if (rowIndex < 0) {
          return false;
        }

        updateCellRawValue(rowIndex, column, String(params.newValue ?? ""));
        return false;
      },
      cellStyle: (params) => {
        const rowIndex = Number(params.data?.__rowIndex ?? -1);
        if (rowIndex < 0) {
          return;
        }

        const columnIndex = activeSheet.columns.indexOf(column);

        const baseCell = activeSheet.rows[rowIndex]?.[column];
        const style = baseCell?.style;
        const isSelected = selectedCell?.rowIndex === rowIndex && selectedCell.column === column;
        const inRange =
          (selectedRange &&
            isCellInSelectionRange(rowIndex, columnIndex, toSelectionRange(selectedRange.start, selectedRange.end))) ||
          selectedRanges.some((range) => isCellInSelectionRange(rowIndex, columnIndex, range));

        const remoteSelection = remoteSelectionMap.get(`${rowIndex}:${column}`);
        const inRemoteRange = remoteRangeSelections.some((selection) =>
          (selection.ranges ?? []).some((range) => isCellInSelectionRange(rowIndex, columnIndex, range))
        );

        const stylePatch: Record<string, string | number> = {
          ...(style?.align ? { textAlign: style.align } : {}),
          ...(style?.verticalAlign ? { verticalAlign: style.verticalAlign } : {}),
          ...(style?.bold ? { fontWeight: 700 } : {}),
          ...(style?.italic ? { fontStyle: "italic" } : {}),
          ...(style?.underline ? { textDecoration: "underline" } : {}),
          ...(style?.wrapText ? { whiteSpace: "pre-wrap" } : {}),
          ...(style?.textColor ? { color: normalizeColor(style.textColor, "#111827") } : {}),
          ...(style?.backgroundColor
            ? { backgroundColor: normalizeColor(style.backgroundColor, "#ffffff") }
            : {}),
          ...(style?.border === "all" ? { boxShadow: "inset 0 0 0 1px #9ca3af" } : {}),
          ...(style?.borders?.top ? { borderTop: `${style.borders.top.width ?? 1}px ${style.borders.top.style ?? "solid"} ${style.borders.top.color ?? "#9ca3af"}` } : {}),
          ...(style?.borders?.right ? { borderRight: `${style.borders.right.width ?? 1}px ${style.borders.right.style ?? "solid"} ${style.borders.right.color ?? "#9ca3af"}` } : {}),
          ...(style?.borders?.bottom ? { borderBottom: `${style.borders.bottom.width ?? 1}px ${style.borders.bottom.style ?? "solid"} ${style.borders.bottom.color ?? "#9ca3af"}` } : {}),
          ...(style?.borders?.left ? { borderLeft: `${style.borders.left.width ?? 1}px ${style.borders.left.style ?? "solid"} ${style.borders.left.color ?? "#9ca3af"}` } : {})
        };

        if (activeSheet.view.gridlines === false) {
          stylePatch.border = "none";
        }

        if (formulaRanges.length > 0 && isCellInRanges(rowIndex, columnIndex, formulaRanges)) {
          stylePatch.boxShadow = `inset 0 0 0 2px ${EXCEL_BRAND_COLOR}`;
          stylePatch.backgroundColor = "#ecfdf3";
        }

        if (inRange) {
          stylePatch.backgroundColor = "#eef6ff";
          stylePatch.boxShadow = "inset 0 0 0 1px #7aa7ff";
        }

        if (remoteSelection) {
          stylePatch.backgroundColor = `${remoteSelection.color}22`;
          stylePatch.boxShadow = `inset 0 0 0 2px ${remoteSelection.color}`;
        }
        if (inRemoteRange && !remoteSelection) {
          stylePatch.backgroundColor = "#f5f3ff";
          stylePatch.boxShadow = "inset 0 0 0 1px #a78bfa";
        }

        if (isSelected) {
          stylePatch.boxShadow = `inset 0 0 0 2px ${EXCEL_BRAND_COLOR}`;
        }

        return stylePatch;
      }
    }));

    return [rowNumberCol, ...dataColumns];
  }, [
    activeSheet,
    formulaRanges,
    getComputedCellValue,
    remoteRangeSelections,
    readOnly,
    remoteSelectionMap,
    selectedCell,
    selectedRange,
    selectedRanges,
    updateCellRawValue
  ]);

  const tbBtn = (disabled = false) =>
    `inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors active:scale-95 ${
      disabled
        ? "cursor-not-allowed border-[rgba(0,0,0,0.06)] bg-slate-50 text-slate-400"
        : "border-[rgba(0,0,0,0.09)] bg-white text-slate-600 shadow-sm hover:bg-slate-50"
    }`;

  return (
    <div className="flex h-full min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <input
        ref={csvInputRef}
        type="file"
        className="hidden"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importCsv(file);
          }
          event.target.value = "";
        }}
      />
      <input
        ref={xlsxInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importXlsx(file);
          }
          event.target.value = "";
        }}
      />

      <div className="border-b border-[rgba(0,0,0,0.07)] bg-[#f8f9fa]">
        <div className="flex flex-wrap items-center gap-1 border-b border-[rgba(0,0,0,0.07)] px-3 py-1.5">
          {[
            ["INICIO", "Inicio"],
            ["FORMULAS", "Fórmulas"],
            ["DATOS", "Datos"],
            ["VISTA", "Vista"]
          ].map(([valueTab, label]) => (
            <button
              key={valueTab}
              type="button"
              onClick={() => setActiveRibbonTab(valueTab as typeof activeRibbonTab)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                activeRibbonTab === valueTab
                  ? "bg-white text-[#0a84ff] shadow-sm"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              {label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
            <span>{activeSheet.rows.length} filas</span>
            <span>·</span>
            <span>{activeSheet.columns.length} columnas</span>
            <span>·</span>
            <span>{workbook.sheets.length} hojas</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          {activeRibbonTab === "INICIO" ? (
            <>
              <button type="button" onClick={() => undoManagerRef.current?.undo()} className={tbBtn(!canUndo)} disabled={!canUndo}>
                ↶ Undo
              </button>
              <button type="button" onClick={() => undoManagerRef.current?.redo()} className={tbBtn(!canRedo)} disabled={!canRedo}>
                ↷ Redo
              </button>
              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <button type="button" onClick={copySelectionToClipboard} className={tbBtn(!selectedCell)} disabled={!selectedCell}>
                Copy
              </button>
              <button type="button" onClick={() => void pasteFromClipboard()} className={tbBtn(readOnly || !selectedCell)} disabled={readOnly || !selectedCell}>
                Paste
              </button>
              <select
                value={pasteSpecialMode}
                onChange={(event) => setPasteSpecialMode(event.target.value as TablePasteSpecialModeV2)}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="all">Pegado: Todo</option>
                <option value="values">Solo valores</option>
                <option value="formulas">Solo fórmulas</option>
                <option value="format">Solo formato</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!selectedCell) {
                    return;
                  }
                  const style =
                    activeSheet.rows[selectedCell.rowIndex]?.[selectedCell.column]?.style ?? null;
                  if (!style) {
                    return;
                  }
                  formatPainterStyleRef.current = { ...style };
                  setFormatPainterArmed(true);
                }}
                className={tbBtn(readOnly || !selectedCell)}
                disabled={readOnly || !selectedCell}
              >
                Pincel {formatPainterArmed ? "•" : ""}
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <button type="button" onClick={addRow} className={tbBtn(readOnly)} disabled={readOnly}>
                + Fila
              </button>
              <button type="button" onClick={removeLastRow} className={tbBtn(readOnly || activeSheet.rows.length <= 1)} disabled={readOnly || activeSheet.rows.length <= 1}>
                − Fila
              </button>
              <button type="button" onClick={addColumn} className={tbBtn(readOnly)} disabled={readOnly}>
                + Col
              </button>
              <button type="button" onClick={removeLastColumn} className={tbBtn(readOnly || activeSheet.columns.length <= 1)} disabled={readOnly || activeSheet.columns.length <= 1}>
                − Col
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <button type="button" onClick={fillDown} className={tbBtn(readOnly || !selectedCell)} disabled={readOnly || !selectedCell}>
                Fill ↓
              </button>
              <button type="button" onClick={fillRight} className={tbBtn(readOnly || !selectedCell)} disabled={readOnly || !selectedCell}>
                Fill →
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <button
                type="button"
                onClick={() => patchSelectedCellStyle({ bold: !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.bold ?? false) })}
                className={tbBtn(readOnly || !selectedCell)}
                disabled={readOnly || !selectedCell}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => patchSelectedCellStyle({ italic: !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.italic ?? false) })}
                className={tbBtn(readOnly || !selectedCell)}
                disabled={readOnly || !selectedCell}
              >
                I
              </button>
              <button
                type="button"
                onClick={() => patchSelectedCellStyle({ underline: !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.underline ?? false) })}
                className={tbBtn(readOnly || !selectedCell)}
                disabled={readOnly || !selectedCell}
              >
                U
              </button>
              <label
                className={`inline-flex items-center gap-1 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-600 ${
                  readOnly || !selectedCell ? "opacity-50" : ""
                }`}
              >
                Tx
                <input
                  type="color"
                  aria-label="Color de texto"
                  value={normalizeColor(
                    activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                      ?.textColor,
                    "#111827"
                  )}
                  onChange={(event) => patchSelectedCellStyle({ textColor: event.target.value })}
                  disabled={readOnly || !selectedCell}
                  className="h-5 w-6 cursor-pointer rounded border border-[rgba(0,0,0,0.2)] p-0 disabled:cursor-not-allowed"
                />
              </label>
              <label
                className={`inline-flex items-center gap-1 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-600 ${
                  readOnly || !selectedCell ? "opacity-50" : ""
                }`}
              >
                Fondo
                <input
                  type="color"
                  aria-label="Color de fondo"
                  value={normalizeColor(
                    activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                      ?.backgroundColor,
                    "#ffffff"
                  )}
                  onChange={(event) => patchSelectedCellStyle({ backgroundColor: event.target.value })}
                  disabled={readOnly || !selectedCell}
                  className="h-5 w-6 cursor-pointer rounded border border-[rgba(0,0,0,0.2)] p-0 disabled:cursor-not-allowed"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  patchSelectedCellStyle({
                    border:
                      activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                        ?.border === "all"
                        ? "none"
                        : "all"
                  })
                }
                className={tbBtn(readOnly || !selectedCell)}
                disabled={readOnly || !selectedCell}
              >
                Bordes
              </button>
              <select
                value={
                  activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                    ?.borderPreset ?? "none"
                }
                onChange={(event) =>
                  applyBorderPreset(event.target.value as NonNullable<TableStyleV2["borderPreset"]>)
                }
                disabled={readOnly || !selectedCell}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 disabled:opacity-50"
              >
                <option value="none">Sin preset</option>
                <option value="all">Borde total</option>
                <option value="outline">Contorno</option>
                <option value="inside">Interno</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  patchSelectedCellStyle({
                    wrapText:
                      !(activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                        ?.wrapText ?? false)
                  })
                }
                className={tbBtn(readOnly || !selectedCell)}
                disabled={readOnly || !selectedCell}
              >
                Wrap
              </button>
              <select
                value={
                  activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                    ?.verticalAlign ?? "middle"
                }
                onChange={(event) =>
                  patchSelectedCellStyle({
                    verticalAlign: event.target.value as NonNullable<TableStyleV2["verticalAlign"]>
                  })
                }
                disabled={readOnly || !selectedCell}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 disabled:opacity-50"
              >
                <option value="top">V-Top</option>
                <option value="middle">V-Middle</option>
                <option value="bottom">V-Bottom</option>
              </select>

              <select
                value={activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.numberFormat ?? "general"}
                onChange={(event) => {
                  const numberFormat = event.target.value as NonNullable<TableStyleV2["numberFormat"]>;
                  patchSelectedCellStyle({ numberFormat });
                }}
                disabled={readOnly || !selectedCell}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700 disabled:opacity-50"
              >
                <option value="general">General</option>
                <option value="number">Number</option>
                <option value="currency">Currency</option>
                <option value="percent">Percent</option>
                <option value="date">Date</option>
              </select>
              <button type="button" onClick={() => setFormatPanelOpen((state) => !state)} className={tbBtn(false)}>
                Panel formato
              </button>
            </>
          ) : null}

          {activeRibbonTab === "FORMULAS" ? (
            <>
              <p className="text-xs text-slate-600">
                Usa la barra <span className="font-mono">fx</span> con alias ES+EN (`SUMA`/`SUM`,
                `SI`/`IF`, `BUSCARV`/`VLOOKUP`).
              </p>
              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
              <button type="button" onClick={() => setFormulaGuideVisible((state) => !state)} className={tbBtn(false)}>
                Guía rápida
              </button>
            </>
          ) : null}

          {activeRibbonTab === "DATOS" ? (
            <>
              <button type="button" onClick={() => csvInputRef.current?.click()} className={tbBtn(readOnly)} disabled={readOnly}>
                Import CSV
              </button>
              <button type="button" onClick={() => xlsxInputRef.current?.click()} className={tbBtn(readOnly)} disabled={readOnly}>
                Import XLSX
              </button>
              <button type="button" onClick={exportCsv} className={tbBtn(false)}>
                Export CSV
              </button>
              <button type="button" onClick={exportXlsx} className={tbBtn(false)}>
                Export XLSX
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <select
                value={filterColumn}
                onChange={(event) => setFilterColumn(event.target.value)}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="">Filtro columna</option>
                {activeSheet.columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
              <input
                value={filterValue}
                onChange={(event) => setFilterValue(event.target.value)}
                placeholder="contiene..."
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              />
              <button type="button" onClick={applyFilter} className={tbBtn(false)}>
                Aplicar filtro
              </button>
              <button type="button" onClick={clearFilter} className={tbBtn(false)}>
                Limpiar
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <select
                value={sortColumn}
                onChange={(event) => setSortColumn(event.target.value)}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="">Orden columna</option>
                {activeSheet.columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
              <select
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <button type="button" onClick={applySort} className={tbBtn(false)}>
                Ordenar
              </button>
              <button type="button" onClick={clearSort} className={tbBtn(false)}>
                Quitar orden
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <select
                value={activeFilterStateColumn}
                onChange={(event) => setActiveFilterStateColumn(event.target.value)}
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="">Filtro avanzado</option>
                {activeSheet.columns.map((column) => (
                  <option key={`adv-${column}`} value={column}>
                    {column}
                  </option>
                ))}
              </select>
              <input
                value={filterStateSearch}
                onChange={(event) => setFilterStateSearch(event.target.value)}
                placeholder="Buscar valor"
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              />
              {activeFilterState?.condition ? (
                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                  Condición: {activeFilterState.condition.mode} {activeFilterState.condition.value}
                </span>
              ) : null}
              <div className="max-h-16 overflow-auto rounded border border-[rgba(0,0,0,0.08)] bg-white px-2 py-1 text-[11px] text-slate-600">
                {availableFilterValues.length === 0 ? (
                  <span className="text-slate-400">Sin valores</span>
                ) : (
                  availableFilterValues.slice(0, 12).map((valueEntry) => {
                    const selected = activeFilterState?.selectedValues.includes(valueEntry) ?? false;
                    return (
                      <label key={`${activeFilterStateColumn}-${valueEntry}`} className="mr-2 inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleFilterValueSelection(valueEntry)}
                        />
                        <span>{valueEntry || "(vacío)"}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <button type="button" onClick={clearFilterState} className={tbBtn(false)}>
                Limpiar avanzado
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <select
                value={validationEditor.type}
                onChange={(event) =>
                  setValidationEditor((current) => ({
                    ...current,
                    type: event.target.value as ValidationEditorState["type"]
                  }))
                }
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="list">Validación lista</option>
                <option value="numberRange">Validación número</option>
                <option value="dateRange">Validación fecha</option>
              </select>
              <select
                value={validationEditor.column}
                onChange={(event) =>
                  setValidationEditor((current) => ({
                    ...current,
                    column: event.target.value
                  }))
                }
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              >
                <option value="">Columna validación</option>
                {activeSheet.columns.map((column) => (
                  <option key={`val-${column}`} value={column}>
                    {column}
                  </option>
                ))}
              </select>
              {validationEditor.type === "list" ? (
                <input
                  value={validationEditor.values}
                  onChange={(event) =>
                    setValidationEditor((current) => ({
                      ...current,
                      values: event.target.value
                    }))
                  }
                  placeholder="Aprobado, Rechazado"
                  className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
                />
              ) : (
                <>
                  <input
                    value={validationEditor.min}
                    onChange={(event) =>
                      setValidationEditor((current) => ({
                        ...current,
                        min: event.target.value
                      }))
                    }
                    placeholder="Min"
                    className="h-7 w-20 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
                  />
                  <input
                    value={validationEditor.max}
                    onChange={(event) =>
                      setValidationEditor((current) => ({
                        ...current,
                        max: event.target.value
                      }))
                    }
                    placeholder="Max"
                    className="h-7 w-20 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
                  />
                </>
              )}
              <button type="button" onClick={saveValidationRule} className={tbBtn(false)}>
                Guardar validación
              </button>

              <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar"
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              />
              <input
                value={replaceText}
                onChange={(event) => setReplaceText(event.target.value)}
                placeholder="Reemplazar"
                className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
              />
              <button type="button" onClick={findNext} className={tbBtn(false)}>
                Buscar siguiente
              </button>
              <button type="button" onClick={replaceAll} className={tbBtn(readOnly)} disabled={readOnly}>
                Reemplazar todo
              </button>
            </>
          ) : null}

          {activeRibbonTab === "VISTA" ? (
            <>
              <button type="button" onClick={toggleGridlines} className={tbBtn(false)}>
                {activeSheet.view.gridlines ? "Ocultar grid" : "Mostrar grid"}
              </button>

              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                Freeze filas
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={activeSheet.view.freezeRows}
                  onChange={(event) => adjustView({ freezeRows: Number(event.target.value || 0) })}
                  className="h-7 w-16 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2"
                />
              </label>

              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                Freeze cols
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={activeSheet.view.freezeColumns}
                  onChange={(event) => adjustView({ freezeColumns: Number(event.target.value || 0) })}
                  className="h-7 w-16 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2"
                />
              </label>

              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                Zoom
                <input
                  type="number"
                  min={50}
                  max={200}
                  value={activeSheet.view.zoom}
                  onChange={(event) => adjustView({ zoom: Number(event.target.value || 100) })}
                  className="h-7 w-20 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2"
                />
              </label>
              {activeSheet.dimensions.hiddenColumns.length > 0 ? (
                <select
                  onChange={(event) => {
                    if (!event.target.value) {
                      return;
                    }
                    toggleColumnHidden(event.target.value);
                    event.target.value = "";
                  }}
                  className="h-7 rounded-lg border border-[rgba(0,0,0,0.09)] bg-white px-2 text-xs text-slate-700"
                >
                  <option value="">Mostrar columna oculta</option>
                  {activeSheet.dimensions.hiddenColumns.map((column) => (
                    <option key={`hidden-${column}`} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="relative flex items-center gap-2 border-b border-[rgba(0,0,0,0.06)] bg-white px-3 py-2">
        <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:inline">
          Barra de fórmulas
        </span>
        <span className="min-w-[4rem] shrink-0 rounded bg-[#f0f4f9] px-2 py-1 text-center text-[11px] font-semibold text-slate-500">
          {activeFormulaCell ? toCellAddressLabel(activeFormulaCell) : "—"}
        </span>
        <span className="shrink-0 select-none text-sm font-bold italic" style={{ color: EXCEL_BRAND_COLOR }}>
          fx
        </span>

        <input
          ref={formulaBarRef}
          value={activeFormulaValue}
          onChange={onFormulaBarChange}
          onKeyDown={onFormulaBarKeyDown}
          onFocus={() => {
            if (!selectedCell) {
              return;
            }

            const raw = activeSheet.rows[selectedCell.rowIndex]?.[selectedCell.column]?.value ?? "";
            const input = formulaBarRef.current;
            const cursor = input?.selectionStart ?? raw.length;
            setFormulaAnchorCell(selectedCell);
            setFormulaDraft(raw);
            setFormulaEditMode(isFormulaInput(raw) ? "editingFormula" : "editingValue");
            updateFormulaQuery(raw, cursor);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setFormulaQuery(null);
              setFormulaAnchorCell(null);
              setFormulaEditMode("idle");
            }, 150);
          }}
          disabled={readOnly || !selectedCell}
          placeholder={
            selectedCell
              ? "Type value or formula, e.g. =SUM(A1:A10)"
              : "Select a cell to edit"
          }
          className="h-8 flex-1 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f9fa] px-3 font-mono text-sm text-slate-700 outline-none transition-shadow focus:border-[#0a84ff] focus:bg-white focus:ring-2 focus:ring-[#0a84ff]/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent"
        />

        <div
          className="relative shrink-0"
          onMouseEnter={() => setFormulaGuideVisible(true)}
          onMouseLeave={() => setFormulaGuideVisible(false)}
        >
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            aria-label="Formula quick guide"
          >
            ?
          </button>

          {formulaGuideVisible ? (
            <div className="absolute right-0 top-8 z-50 w-80 rounded-lg border border-[rgba(0,0,0,0.12)] bg-white p-3 text-xs text-slate-600 shadow-xl">
              <p className="font-semibold text-slate-700">Excel-style quick tutorial</p>
              <p className="mt-1">1. Select a cell and type <span className="font-mono">=</span> to start a formula.</p>
              <p className="mt-1">2. Type letters (example <span className="font-mono">=S</span>) para sugerencias.</p>
              <p className="mt-1">3. While editing a formula, click another cell to inject a reference (example <span className="font-mono">B4</span>).</p>
              <p className="mt-1">4. Use <span className="font-mono">F4</span> para alternar referencias absolutas.</p>
              <p className="mt-1">5. Use <span className="font-mono">Enter</span> o <span className="font-mono">Tab</span> para aceptar sugerencia.</p>
            </div>
          ) : null}
        </div>

        {formulaSuggestions.length > 0 ? (
          <div className="absolute left-20 top-full z-50 mt-0.5 w-[420px] overflow-hidden rounded-lg border border-[rgba(0,0,0,0.12)] bg-white shadow-lg">
            {formulaSuggestions.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertFormulaFunction(item.name);
                }}
                className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition-colors ${
                  index === formulaDropdownIndex
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                    {item.name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{item.signature}</span>
                </span>
                <span className="text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={gridViewportRef}
          className="ag-theme-quartz relative flex-1 overflow-hidden"
          style={{ zoom: activeSheet.view.zoom / 100 }}
        >
          <AgGridReact<any>
            theme="legacy"
            rowData={bodyRowData}
            pinnedTopRowData={pinnedTopRowData}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: false,
              filter: false,
              editable: !readOnly
            }}
            getRowHeight={(params) => {
              const rowIndex = Number(params.data?.__rowIndex ?? -1);
              if (rowIndex < 0) {
                return 28;
              }
              const fromMap = activeSheet.dimensions.rowHeights[String(rowIndex)];
              return typeof fromMap === "number" ? fromMap : 28;
            }}
            suppressClickEdit
            singleClickEdit={false}
            animateRows
            onGridReady={onGridReady}
            onColumnResized={onColumnResized}
            onColumnHeaderContextMenu={onColumnHeaderContextMenu}
            onCellClicked={(event) => setSelectionFromGridEvent(event)}
            onCellMouseDown={onGridCellMouseDown}
            onCellMouseOver={onGridCellMouseOver}
            onCellKeyDown={(event) => {
            if (readOnly) {
              return;
            }

            const actualRowIndex = Number(event.data?.__rowIndex ?? -1);
            const column = "colDef" in event ? event.colDef.field : undefined;
            const keyEvent = event.event as KeyboardEvent | undefined;

            if (actualRowIndex < 0 || !column || !keyEvent) {
              return;
            }

            const columnIndex = activeSheet.columns.indexOf(column);
            if (columnIndex < 0) {
              return;
            }

            const cellAddress: CellAddress = {
              rowIndex: actualRowIndex,
              column,
              columnIndex
            };

            if (keyEvent.key === "F2") {
              keyEvent.preventDefault();
              const raw = activeSheet.rows[actualRowIndex]?.[column]?.value ?? "";
              setSelectedCell(cellAddress);
              setFormulaAnchorCell(cellAddress);
              setFormulaDraft(raw);
              setFormulaEditMode(isFormulaInput(raw) ? "editingFormula" : "editingValue");
              updateFormulaQuery(raw, raw.length);
              focusFormulaBar(raw.length);
              return;
            }

            if (keyEvent.key === "Backspace" || keyEvent.key === "Delete") {
              keyEvent.preventDefault();
              setSelectedCell(cellAddress);
              setFormulaAnchorCell(cellAddress);
              setFormulaDraft("");
              setFormulaEditMode("editingValue");
              updateCellRawValue(actualRowIndex, column, "");
              focusFormulaBar(0);
              return;
            }

            if (isPrintableKey(keyEvent)) {
              keyEvent.preventDefault();
              setSelectedCell(cellAddress);
              setFormulaAnchorCell(cellAddress);
              setFormulaDraft(keyEvent.key);
              setFormulaEditMode(isFormulaInput(keyEvent.key) ? "editingFormula" : "editingValue");
              updateFormulaQuery(keyEvent.key, keyEvent.key.length);
              updateCellRawValue(actualRowIndex, column, keyEvent.key);
              focusFormulaBar(keyEvent.key.length);
            }
            }}
          />

          {fillHandlePosition.visible && selectedCell && !readOnly ? (
            <button
              type="button"
              aria-label="Fill handle"
              className="absolute z-40 h-2.5 w-2.5 rounded-sm border border-white bg-[#217346] shadow"
              style={{
                left: fillHandlePosition.left,
                top: fillHandlePosition.top
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                const sourceRange = selectedRange
                  ? toSelectionRange(selectedRange.start, selectedRange.end)
                  : {
                      start: {
                        rowIndex: selectedCell.rowIndex,
                        columnIndex: selectedCell.columnIndex
                      },
                      end: {
                        rowIndex: selectedCell.rowIndex,
                        columnIndex: selectedCell.columnIndex
                      }
                    };

                fillDragStateRef.current = {
                  active: true,
                  sourceRange,
                  targetCell: selectedCell
                };
              }}
            />
          ) : null}

          {validationError ? (
            <div className="absolute bottom-2 left-2 z-40 rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 shadow">
              {validationError}
            </div>
          ) : null}
        </div>

        {formatPanelOpen ? (
          <aside className="hidden w-72 shrink-0 border-l border-[rgba(0,0,0,0.08)] bg-white p-3 md:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded border border-[rgba(0,0,0,0.08)] p-2">
                <p className="font-semibold text-slate-600">Número</p>
                <p className="mt-1 text-slate-500">
                  {activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style
                    ?.numberFormat ?? "general"}
                </p>
              </div>
              <div className="rounded border border-[rgba(0,0,0,0.08)] p-2">
                <p className="font-semibold text-slate-600">Alineación</p>
                <p className="mt-1 text-slate-500">
                  H: {activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.align ?? "left"} ·
                  V:{" "}
                  {activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.verticalAlign ??
                    "middle"}
                </p>
              </div>
              <div className="rounded border border-[rgba(0,0,0,0.08)] p-2">
                <p className="font-semibold text-slate-600">Texto</p>
                <p className="mt-1 text-slate-500">
                  {activeSheet.rows[selectedCell?.rowIndex ?? -1]?.[selectedCell?.column ?? ""]?.style?.wrapText
                    ? "Wrap activo"
                    : "Wrap inactivo"}
                </p>
              </div>
              <div className="rounded border border-[rgba(0,0,0,0.08)] p-2">
                <p className="font-semibold text-slate-600">Validaciones</p>
                <p className="mt-1 text-slate-500">{activeSheet.validations.length} reglas</p>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[rgba(0,0,0,0.07)] bg-[#f8f9fa] px-3 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {workbook.sheets.map((sheet) => {
            const active = sheet.id === workbook.activeSheetId;
            return (
              <button
                key={sheet.id}
                type="button"
                onClick={() => {
                  commitWorkbookMutation((currentWorkbook) => {
                    currentWorkbook.activeSheetId = sheet.id;
                    return currentWorkbook;
                  });
                  setSelectedCell(null);
                  setFormulaAnchorCell(null);
                  setSelectionAnchor(null);
                  setSelectedRange(null);
                  setSelectedRanges([]);
                  setFormulaEditMode("idle");
                }}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-white text-[#0a84ff] shadow-sm"
                    : "text-slate-600 hover:bg-white/70"
                }`}
              >
                {sheet.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={addSheet} className={tbBtn(readOnly)} disabled={readOnly}>
            + Hoja
          </button>
          <button type="button" onClick={duplicateActiveSheet} className={tbBtn(readOnly)} disabled={readOnly}>
            Duplicar
          </button>
          <button type="button" onClick={renameActiveSheet} className={tbBtn(readOnly)} disabled={readOnly}>
            Renombrar
          </button>
          <button
            type="button"
            onClick={removeActiveSheet}
            className={tbBtn(readOnly || workbook.sheets.length <= 1)}
            disabled={readOnly || workbook.sheets.length <= 1}
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setMobileToolsOpen((current) => !current)}
            className="inline-flex h-7 items-center rounded-lg border border-[rgba(0,0,0,0.1)] bg-white px-2 text-xs font-semibold text-slate-600 md:hidden"
          >
            Herramientas
          </button>
        </div>
      </div>

      {headerMenu.visible ? (
        <div
          className="fixed inset-0 z-50"
          onClick={() =>
            setHeaderMenu({
              visible: false,
              x: 0,
              y: 0,
              column: ""
            })
          }
        >
          <div
            className="absolute w-48 rounded-lg border border-[rgba(0,0,0,0.12)] bg-white p-1 shadow-xl"
            style={{ left: headerMenu.x, top: headerMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const index = activeSheet.columns.indexOf(headerMenu.column);
                if (index >= 0) {
                  insertColumnAt(index + 1);
                }
                setHeaderMenu({ visible: false, x: 0, y: 0, column: "" });
              }}
            >
              Insertar columna
            </button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                removeColumnAt(headerMenu.column);
                setHeaderMenu({ visible: false, x: 0, y: 0, column: "" });
              }}
            >
              Eliminar columna
            </button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                toggleColumnHidden(headerMenu.column);
                setHeaderMenu({ visible: false, x: 0, y: 0, column: "" });
              }}
            >
              Ocultar/mostrar columna
            </button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSortColumn(headerMenu.column);
                setSortDirection("asc");
                setHeaderMenu({ visible: false, x: 0, y: 0, column: "" });
              }}
            >
              Orden ascendente
            </button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSortColumn(headerMenu.column);
                setSortDirection("desc");
                setHeaderMenu({ visible: false, x: 0, y: 0, column: "" });
              }}
            >
              Orden descendente
            </button>
          </div>
        </div>
      ) : null}

      {mobileToolsOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-[rgba(0,0,0,0.08)] bg-white p-3 shadow-2xl md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Herramientas rápidas</p>
            <button
              type="button"
              onClick={() => setMobileToolsOpen(false)}
              className="rounded border border-[rgba(0,0,0,0.08)] px-2 py-1 text-xs text-slate-600"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={tbBtn(readOnly || !selectedCell)} onClick={() => patchSelectedCellStyle({ bold: true })} disabled={readOnly || !selectedCell}>
              Bold
            </button>
            <button type="button" className={tbBtn(readOnly || !selectedCell)} onClick={() => patchSelectedCellStyle({ wrapText: true })} disabled={readOnly || !selectedCell}>
              Wrap
            </button>
            <button type="button" className={tbBtn(false)} onClick={findNext}>
              Buscar
            </button>
            <button type="button" className={tbBtn(readOnly)} onClick={fillDown} disabled={readOnly}>
              Fill ↓
            </button>
            <button type="button" className={tbBtn(readOnly)} onClick={fillRight} disabled={readOnly}>
              Fill →
            </button>
            <button type="button" className={tbBtn(false)} onClick={() => setFormatPanelOpen((state) => !state)}>
              Formato
            </button>
          </div>
        </div>
      ) : null}

      {remoteSelections.length > 0 ? (
        <div className="border-t border-[rgba(0,0,0,0.06)] bg-white px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {remoteSelections.map((selection) => (
              <span
                key={`${selection.userId}-${selection.sheetId}-${selection.rowIndex}-${selection.column}`}
                className="inline-flex items-center gap-1 rounded-full border border-[rgba(0,0,0,0.07)] bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: selection.color }}
                />
                {selection.name}:{" "}
                {selection.sheetId === activeSheet.id
                  ? selection.ranges && selection.ranges.length > 0
                    ? selection.ranges
                        .slice(0, 2)
                        .map((range) => {
                          const start = createCellLabelFromAddress(range.start);
                          const end = createCellLabelFromAddress(range.end);
                          return start === end ? start : `${start}:${end}`;
                        })
                        .join(", ")
                    : `${selection.column}${selection.rowIndex + 1}`
                  : "otra hoja"}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <UiModal
        open={sheetRenameModalOpen}
        onClose={() => {
          setSheetRenameModalOpen(false);
          setSheetRenameTargetId(null);
        }}
        title="Renombrar hoja"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre de hoja</label>
          <input
            autoFocus
            value={sheetRenameValue}
            onChange={(event) => setSheetRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitSheetRename();
              }
            }}
            placeholder="Ej: Presupuesto 2026"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setSheetRenameModalOpen(false);
              setSheetRenameTargetId(null);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitSheetRename}
            disabled={!sheetRenameValue.trim()}
            className="rounded-lg border border-blue-200 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </UiModal>
    </div>
  );
};
