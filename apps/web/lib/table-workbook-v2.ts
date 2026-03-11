import * as XLSX from "xlsx";

export type TableHorizontalAlignV2 = "left" | "center" | "right";
export type TableVerticalAlignV2 = "top" | "middle" | "bottom";
export type TableNumberFormatV2 = "general" | "number" | "currency" | "percent" | "date";
export type TableBorderStyleV2 = "none" | "all";
export type TableBorderPresetV2 = "none" | "all" | "outline" | "inside";
export type TableBorderEdgeV2 = "top" | "right" | "bottom" | "left";
export type TableSelectionModeV2 = "single" | "range" | "multi";

export type TableBorderEdgeStyleV2 = {
  color?: string;
  width?: number;
  style?: "solid" | "dashed";
};

export type TableStyleV2 = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TableHorizontalAlignV2;
  verticalAlign?: TableVerticalAlignV2;
  textColor?: string;
  backgroundColor?: string;
  border?: TableBorderStyleV2;
  borderPreset?: TableBorderPresetV2;
  borders?: Partial<Record<TableBorderEdgeV2, TableBorderEdgeStyleV2>>;
  wrapText?: boolean;
  numberFormat?: TableNumberFormatV2;
  numberFormatCustom?: string;
};

export type TableCellV2 = {
  value: string;
  style?: TableStyleV2;
};

export type TableFilterRuleV2 = {
  column: string;
  operator: "contains" | "equals";
  value: string;
};

export type TableSortRuleV2 = {
  column: string;
  direction: "asc" | "desc";
};

export type TableFilterConditionV2 = {
  mode: "contains" | "equals" | "number_gt" | "number_lt" | "date_after" | "date_before";
  value: string;
};

export type TableFilterStateV2 = {
  column: string;
  selectedValues: string[];
  condition?: TableFilterConditionV2;
};

export type TableViewStateV2 = {
  zoom: number;
  gridlines: boolean;
  freezeRows: number;
  freezeColumns: number;
};

export type TableValidationRuleV2 =
  | {
      type: "list";
      column: string;
      allowBlank?: boolean;
      values: string[];
      message?: string;
    }
  | {
      type: "numberRange";
      column: string;
      allowBlank?: boolean;
      min?: number;
      max?: number;
      message?: string;
    }
  | {
      type: "dateRange";
      column: string;
      allowBlank?: boolean;
      min?: string;
      max?: string;
      message?: string;
    };

export type TableDimensionV2 = {
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  hiddenColumns: string[];
  hiddenRows: number[];
};

export type TableSheetV2 = {
  id: string;
  name: string;
  columns: string[];
  rows: Array<Record<string, TableCellV2>>;
  filters: TableFilterRuleV2[];
  filterStates: TableFilterStateV2[];
  sort: TableSortRuleV2 | null;
  validations: TableValidationRuleV2[];
  dimensions: TableDimensionV2;
  view: TableViewStateV2;
};

export type TableWorkbookV2 = {
  version: 2;
  activeSheetId: string;
  sheets: TableSheetV2[];
};

export type TableLegacyStateV1 = {
  columns: string[];
  rows: Array<Record<string, string>>;
};

export type TableAddressV2 = {
  rowIndex: number;
  columnIndex: number;
};

export type TableRangeV2 = {
  start: TableAddressV2;
  end: TableAddressV2;
  label: string;
};

export type TableSelectionRangeV2 = {
  start: TableAddressV2;
  end: TableAddressV2;
};

export type TableSelectionV2 = {
  anchor: TableAddressV2 | null;
  active: TableAddressV2 | null;
  ranges: TableSelectionRangeV2[];
  mode: TableSelectionModeV2;
};

export type TablePasteSpecialModeV2 = "all" | "values" | "formulas" | "format";

const DEFAULT_COLUMN_COUNT = 8;
const DEFAULT_ROW_COUNT = 20;
const MAX_COLUMNS = 512;
const MAX_ROWS = 10_000;

const defaultViewState: TableViewStateV2 = {
  zoom: 100,
  gridlines: true,
  freezeRows: 0,
  freezeColumns: 0
};

const defaultDimensions: TableDimensionV2 = {
  columnWidths: {},
  rowHeights: {},
  hiddenColumns: [],
  hiddenRows: []
};

const FORMULA_ALIAS_MAP: Record<string, string> = {
  SUMA: "SUM",
  PROMEDIO: "AVERAGE",
  CONTAR: "COUNT",
  CONTARA: "COUNTA",
  MAXIMO: "MAX",
  MINIMO: "MIN",
  SI: "IF",
  Y: "AND",
  O: "OR",
  BUSCARV: "VLOOKUP",
  BUSCARX: "XLOOKUP",
  INDICE: "INDEX",
  COINCIDIR: "MATCH",
  HOY: "TODAY",
  AHORA: "NOW"
};

const WEEKDAYS_ES = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
const WEEKDAYS_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS_ES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const sanitizeHexColor = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized;
  }

  return undefined;
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
};

const normalizeNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
};

const normalizeAlign = (value: unknown): TableHorizontalAlignV2 | undefined => {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return undefined;
};

const normalizeVerticalAlign = (value: unknown): TableVerticalAlignV2 | undefined => {
  if (value === "top" || value === "middle" || value === "bottom") {
    return value;
  }
  return undefined;
};

const normalizeBorder = (value: unknown): TableBorderStyleV2 | undefined => {
  if (value === "none" || value === "all") {
    return value;
  }
  return undefined;
};

const normalizeBorderPreset = (value: unknown): TableBorderPresetV2 | undefined => {
  if (value === "none" || value === "all" || value === "outline" || value === "inside") {
    return value;
  }
  return undefined;
};

const normalizeNumberFormat = (value: unknown): TableNumberFormatV2 | undefined => {
  if (
    value === "general" ||
    value === "number" ||
    value === "currency" ||
    value === "percent" ||
    value === "date"
  ) {
    return value;
  }
  return undefined;
};

const sanitizeBorderEdgeStyle = (value: unknown): TableBorderEdgeStyleV2 | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as TableBorderEdgeStyleV2;
  const edge: TableBorderEdgeStyleV2 = {};

  const color = sanitizeHexColor(source.color);
  if (color) {
    edge.color = color;
  }

  if (source.style === "solid" || source.style === "dashed") {
    edge.style = source.style;
  }

  if (typeof source.width === "number" && Number.isFinite(source.width)) {
    edge.width = Math.max(1, Math.min(4, Math.round(source.width)));
  }

  return Object.keys(edge).length > 0 ? edge : undefined;
};

const sanitizeStyle = (value: unknown): TableStyleV2 | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const style = value as TableStyleV2;
  const next: TableStyleV2 = {};

  if (typeof style.bold === "boolean") {
    next.bold = style.bold;
  }
  if (typeof style.italic === "boolean") {
    next.italic = style.italic;
  }
  if (typeof style.underline === "boolean") {
    next.underline = style.underline;
  }

  const align = normalizeAlign(style.align);
  if (align) {
    next.align = align;
  }

  const verticalAlign = normalizeVerticalAlign(style.verticalAlign);
  if (verticalAlign) {
    next.verticalAlign = verticalAlign;
  }

  const border = normalizeBorder(style.border);
  if (border) {
    next.border = border;
  }

  const borderPreset = normalizeBorderPreset(style.borderPreset);
  if (borderPreset) {
    next.borderPreset = borderPreset;
  }

  const numberFormat = normalizeNumberFormat(style.numberFormat);
  if (numberFormat) {
    next.numberFormat = numberFormat;
  }

  if (typeof style.numberFormatCustom === "string" && style.numberFormatCustom.trim().length > 0) {
    next.numberFormatCustom = style.numberFormatCustom.trim().slice(0, 64);
  }

  if (typeof style.wrapText === "boolean") {
    next.wrapText = style.wrapText;
  }

  const textColor = sanitizeHexColor(style.textColor);
  if (textColor) {
    next.textColor = textColor;
  }

  const backgroundColor = sanitizeHexColor(style.backgroundColor);
  if (backgroundColor) {
    next.backgroundColor = backgroundColor;
  }

  if (style.borders && typeof style.borders === "object") {
    const borders: Partial<Record<TableBorderEdgeV2, TableBorderEdgeStyleV2>> = {};
    const top = sanitizeBorderEdgeStyle(style.borders.top);
    const right = sanitizeBorderEdgeStyle(style.borders.right);
    const bottom = sanitizeBorderEdgeStyle(style.borders.bottom);
    const left = sanitizeBorderEdgeStyle(style.borders.left);
    if (top) {
      borders.top = top;
    }
    if (right) {
      borders.right = right;
    }
    if (bottom) {
      borders.bottom = bottom;
    }
    if (left) {
      borders.left = left;
    }

    if (Object.keys(borders).length > 0) {
      next.borders = borders;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

const normalizeColumnToken = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim().toUpperCase();
  if (!/^[A-Z]{1,4}$/.test(token)) {
    return null;
  }

  return token;
};

const ensureUniqueColumns = (columns: unknown): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  if (Array.isArray(columns)) {
    for (const rawColumn of columns) {
      const token = normalizeColumnToken(rawColumn);
      if (!token || seen.has(token)) {
        continue;
      }
      seen.add(token);
      normalized.push(token);
      if (normalized.length >= MAX_COLUMNS) {
        break;
      }
    }
  }

  if (normalized.length > 0) {
    return normalized;
  }

  return Array.from({ length: DEFAULT_COLUMN_COUNT }, (_, index) => createColumnLabelFromIndex(index));
};

const createDefaultCell = (): TableCellV2 => ({ value: "" });

const sanitizeCell = (value: unknown): TableCellV2 => {
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const source = value as { value?: unknown; style?: unknown };
    const style = sanitizeStyle(source.style);
    return {
      value: String(source.value ?? ""),
      ...(style ? { style } : {})
    };
  }

  if (typeof value === "string") {
    return {
      value
    };
  }

  return createDefaultCell();
};

const sanitizeRows = (rows: unknown, columns: string[]): Array<Record<string, TableCellV2>> => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Array.from({ length: DEFAULT_ROW_COUNT }, () =>
      Object.fromEntries(columns.map((column) => [column, createDefaultCell()]))
    );
  }

  return rows.slice(0, MAX_ROWS).map((row) => {
    const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return Object.fromEntries(
      columns.map((column) => [column, sanitizeCell(source[column] ?? createDefaultCell())])
    );
  });
};

const sanitizeFilterRule = (value: unknown, columns: string[]): TableFilterRuleV2 | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as TableFilterRuleV2;
  const column = normalizeColumnToken(source.column);
  if (!column || !columns.includes(column)) {
    return null;
  }

  if (source.operator !== "contains" && source.operator !== "equals") {
    return null;
  }

  return {
    column,
    operator: source.operator,
    value: String(source.value ?? "")
  };
};

const sanitizeSortRule = (value: unknown, columns: string[]): TableSortRuleV2 | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as TableSortRuleV2;
  const column = normalizeColumnToken(source.column);
  if (!column || !columns.includes(column)) {
    return null;
  }

  if (source.direction !== "asc" && source.direction !== "desc") {
    return null;
  }

  return {
    column,
    direction: source.direction
  };
};

const sanitizeFilterCondition = (value: unknown): TableFilterConditionV2 | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as TableFilterConditionV2;
  if (
    source.mode !== "contains" &&
    source.mode !== "equals" &&
    source.mode !== "number_gt" &&
    source.mode !== "number_lt" &&
    source.mode !== "date_after" &&
    source.mode !== "date_before"
  ) {
    return undefined;
  }

  return {
    mode: source.mode,
    value: String(source.value ?? "")
  };
};

const sanitizeFilterState = (value: unknown, columns: string[]): TableFilterStateV2 | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as TableFilterStateV2;
  const column = normalizeColumnToken(source.column);
  if (!column || !columns.includes(column)) {
    return null;
  }

  const selectedValues = Array.isArray(source.selectedValues)
    ? source.selectedValues.slice(0, 300).map((entry) => String(entry))
    : [];

  const condition = sanitizeFilterCondition(source.condition);
  return {
    column,
    selectedValues,
    ...(condition ? { condition } : {})
  };
};

const sanitizeValidationRule = (value: unknown, columns: string[]): TableValidationRuleV2 | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as TableValidationRuleV2;
  const column = normalizeColumnToken((source as { column?: unknown }).column);
  if (!column || !columns.includes(column)) {
    return null;
  }

  if (source.type === "list") {
    return {
      type: "list",
      column,
      allowBlank: normalizeBoolean(source.allowBlank, true),
      values: Array.isArray(source.values)
        ? source.values.slice(0, 200).map((entry) => String(entry))
        : [],
      ...(typeof source.message === "string" && source.message.trim().length > 0
        ? { message: source.message.trim().slice(0, 160) }
        : {})
    };
  }

  if (source.type === "numberRange") {
    return {
      type: "numberRange",
      column,
      allowBlank: normalizeBoolean(source.allowBlank, true),
      ...(typeof source.min === "number" && Number.isFinite(source.min) ? { min: source.min } : {}),
      ...(typeof source.max === "number" && Number.isFinite(source.max) ? { max: source.max } : {}),
      ...(typeof source.message === "string" && source.message.trim().length > 0
        ? { message: source.message.trim().slice(0, 160) }
        : {})
    };
  }

  if (source.type === "dateRange") {
    return {
      type: "dateRange",
      column,
      allowBlank: normalizeBoolean(source.allowBlank, true),
      ...(typeof source.min === "string" && source.min.trim().length > 0
        ? { min: source.min.trim().slice(0, 32) }
        : {}),
      ...(typeof source.max === "string" && source.max.trim().length > 0
        ? { max: source.max.trim().slice(0, 32) }
        : {}),
      ...(typeof source.message === "string" && source.message.trim().length > 0
        ? { message: source.message.trim().slice(0, 160) }
        : {})
    };
  }

  return null;
};

const sanitizeDimensions = (value: unknown, columns: string[]): TableDimensionV2 => {
  if (!value || typeof value !== "object") {
    return {
      ...defaultDimensions
    };
  }

  const source = value as Partial<TableDimensionV2>;

  const columnWidthsEntries: Array<[string, number]> = [];
  Object.entries(source.columnWidths ?? {}).forEach(([column, width]) => {
    const normalizedColumn = normalizeColumnToken(column);
    if (!normalizedColumn || !columns.includes(normalizedColumn)) {
      return;
    }
    columnWidthsEntries.push([
      normalizedColumn,
      typeof width === "number" && Number.isFinite(width) ? Math.max(56, Math.min(640, Math.round(width))) : 120
    ]);
  });
  const columnWidths = Object.fromEntries(columnWidthsEntries);

  const rowHeights = Object.fromEntries(
    Object.entries(source.rowHeights ?? {})
      .filter(([rowIndex]) => /^\d+$/.test(rowIndex))
      .map(([rowIndex, height]) => [
        rowIndex,
        typeof height === "number" && Number.isFinite(height) ? Math.max(20, Math.min(120, Math.round(height))) : 28
      ])
  );

  const hiddenColumns = Array.isArray(source.hiddenColumns)
    ? source.hiddenColumns
        .map((column) => normalizeColumnToken(column))
        .filter((column): column is string => Boolean(column && columns.includes(column)))
    : [];

  const hiddenRows = Array.isArray(source.hiddenRows)
    ? source.hiddenRows
        .map((row) => Number(row))
        .filter((row) => Number.isInteger(row) && row >= 0)
        .slice(0, 10_000)
    : [];

  return {
    columnWidths,
    rowHeights,
    hiddenColumns,
    hiddenRows
  };
};

const sanitizeViewState = (value: unknown): TableViewStateV2 => {
  if (!value || typeof value !== "object") {
    return defaultViewState;
  }

  const view = value as TableViewStateV2;
  return {
    zoom: normalizeNumber(view.zoom, defaultViewState.zoom, 50, 200),
    gridlines: normalizeBoolean(view.gridlines, defaultViewState.gridlines),
    freezeRows: normalizeNumber(view.freezeRows, 0, 0, 100),
    freezeColumns: normalizeNumber(view.freezeColumns, 0, 0, 20)
  };
};

const createSheetId = (seed: string) => {
  const compact = seed.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return `sheet-${compact || "main"}`;
};

const sanitizeSheet = (value: unknown, index: number): TableSheetV2 => {
  const source = value && typeof value === "object" ? (value as Partial<TableSheetV2>) : {};
  const columns = ensureUniqueColumns(source.columns);
  const rows = sanitizeRows(source.rows, columns);

  const filters = Array.isArray(source.filters)
    ? source.filters
        .map((rule) => sanitizeFilterRule(rule, columns))
        .filter((rule): rule is TableFilterRuleV2 => Boolean(rule))
    : [];

  const sort = sanitizeSortRule(source.sort, columns);
  const filterStatesFromV2 = Array.isArray(source.filterStates)
    ? source.filterStates
        .map((filterState) => sanitizeFilterState(filterState, columns))
        .filter((filterState): filterState is TableFilterStateV2 => Boolean(filterState))
    : [];

  const filterStates =
    filterStatesFromV2.length > 0
      ? filterStatesFromV2
      : filters.map((filterRule) => ({
          column: filterRule.column,
          selectedValues: [],
          condition: {
            mode: filterRule.operator === "equals" ? "equals" : "contains",
            value: filterRule.value
          } satisfies TableFilterConditionV2
        }));

  const validations = Array.isArray(source.validations)
    ? source.validations
        .map((validation) => sanitizeValidationRule(validation, columns))
        .filter((validation): validation is TableValidationRuleV2 => Boolean(validation))
    : [];

  const id =
    typeof source.id === "string" && source.id.trim().length > 0
      ? source.id
      : createSheetId(String(index + 1));

  const name =
    typeof source.name === "string" && source.name.trim().length > 0
      ? source.name.trim().slice(0, 40)
      : `Sheet ${index + 1}`;

  return {
    id,
    name,
    columns,
    rows,
    filters,
    filterStates,
    sort,
    validations,
    dimensions: sanitizeDimensions(source.dimensions, columns),
    view: sanitizeViewState(source.view)
  };
};

export const createColumnLabelFromIndex = (columnIndex: number): string => {
  let index = columnIndex;
  let label = "";

  do {
    label = String.fromCharCode((index % 26) + 65) + label;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);

  return label;
};

export const columnIndexFromLabel = (label: string): number => {
  const token = label.trim().toUpperCase();
  if (!/^[A-Z]{1,4}$/.test(token)) {
    return -1;
  }

  let result = 0;
  for (const char of token) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }

  return result - 1;
};

export const createEmptySheetV2 = (name = "Sheet 1"): TableSheetV2 => {
  const columns = Array.from({ length: DEFAULT_COLUMN_COUNT }, (_, index) =>
    createColumnLabelFromIndex(index)
  );

  return {
    id: createSheetId(name),
    name,
    columns,
    rows: Array.from({ length: DEFAULT_ROW_COUNT }, () =>
      Object.fromEntries(columns.map((column) => [column, createDefaultCell()]))
    ),
    filters: [],
    filterStates: [],
    sort: null,
    validations: [],
    dimensions: { ...defaultDimensions },
    view: defaultViewState
  };
};

export const createEmptyWorkbookV2 = (): TableWorkbookV2 => {
  const sheet = createEmptySheetV2();
  return {
    version: 2,
    activeSheetId: sheet.id,
    sheets: [sheet]
  };
};

export const migrateTableV1ToV2 = (legacy: TableLegacyStateV1): TableWorkbookV2 => {
  const columns = ensureUniqueColumns(legacy.columns);
  const rows = sanitizeRows(legacy.rows, columns);
  const sheet: TableSheetV2 = {
    id: createSheetId("sheet1"),
    name: "Sheet 1",
    columns,
    rows,
    filters: [],
    filterStates: [],
    sort: null,
    validations: [],
    dimensions: { ...defaultDimensions },
    view: defaultViewState
  };

  return {
    version: 2,
    activeSheetId: sheet.id,
    sheets: [sheet]
  };
};

export const sanitizeWorkbookV2 = (value: unknown): TableWorkbookV2 => {
  const source = value && typeof value === "object" ? (value as Partial<TableWorkbookV2>) : {};
  const rawSheets = Array.isArray(source.sheets) ? source.sheets : [];
  const sheets = (rawSheets.length > 0 ? rawSheets : [createEmptySheetV2()]).map((sheet, index) =>
    sanitizeSheet(sheet, index)
  );

  const activeSheetId =
    typeof source.activeSheetId === "string" && sheets.some((sheet) => sheet.id === source.activeSheetId)
      ? source.activeSheetId
      : sheets[0]!.id;

  return {
    version: 2,
    activeSheetId,
    sheets
  };
};

export const parseWorkbookV2 = (raw: string): TableWorkbookV2 => {
  if (!raw.trim()) {
    return createEmptyWorkbookV2();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (
      parsed &&
      typeof parsed === "object" &&
      "columns" in (parsed as Record<string, unknown>) &&
      "rows" in (parsed as Record<string, unknown>)
    ) {
      return migrateTableV1ToV2(parsed as TableLegacyStateV1);
    }

    return sanitizeWorkbookV2(parsed);
  } catch {
    return createEmptyWorkbookV2();
  }
};

export const serializeWorkbookV2 = (workbook: TableWorkbookV2): string => {
  return JSON.stringify(sanitizeWorkbookV2(workbook));
};

export const getSheetById = (workbook: TableWorkbookV2, sheetId: string): TableSheetV2 | null => {
  return workbook.sheets.find((sheet) => sheet.id === sheetId) ?? null;
};

export const getActiveSheet = (workbook: TableWorkbookV2): TableSheetV2 => {
  return getSheetById(workbook, workbook.activeSheetId) ?? workbook.sheets[0]!;
};

export const extractFormulaAutocompleteToken = (
  formula: string,
  cursorPosition: number
): string | null => {
  if (!formula.trimStart().startsWith("=")) {
    return null;
  }

  const cursor = Math.max(0, Math.min(cursorPosition, formula.length));
  const beforeCursor = formula.slice(0, cursor);
  const tokenMatch = beforeCursor.match(/[A-Za-z][A-Za-z0-9_]*$/);
  if (!tokenMatch) {
    return null;
  }

  const token = tokenMatch[0]!.toUpperCase();
  return /\d/.test(token) ? null : token;
};

export const insertReferenceAtCursor = (
  currentValue: string,
  reference: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; cursor: number } => {
  const start = Math.max(0, Math.min(selectionStart, currentValue.length));
  const end = Math.max(start, Math.min(selectionEnd, currentValue.length));
  const nextValue = `${currentValue.slice(0, start)}${reference}${currentValue.slice(end)}`;
  return {
    value: nextValue,
    cursor: start + reference.length
  };
};

export const parseCellAddress = (token: string): TableAddressV2 | null => {
  const match = token.trim().toUpperCase().match(/^\$?([A-Z]{1,4})\$?(\d{1,7})$/);
  if (!match) {
    return null;
  }

  const [, columnToken, rowToken] = match;
  const columnIndex = columnIndexFromLabel(columnToken!);
  if (columnIndex < 0) {
    return null;
  }

  const rowIndex = Number.parseInt(rowToken!, 10) - 1;
  if (rowIndex < 0) {
    return null;
  }

  return {
    rowIndex,
    columnIndex
  };
};

export const parseFormulaRanges = (formula: string): TableRangeV2[] => {
  if (!formula.trimStart().startsWith("=")) {
    return [];
  }

  const matches = formula.matchAll(/(\$?[A-Z]{1,4}\$?\d{1,7})(:(\$?[A-Z]{1,4}\$?\d{1,7}))?/gi);
  const ranges: TableRangeV2[] = [];

  for (const match of matches) {
    const startAddress = parseCellAddress(match[1] ?? "");
    const endAddress = parseCellAddress(match[3] ?? match[1] ?? "");
    if (!startAddress || !endAddress) {
      continue;
    }

    ranges.push({
      start: {
        rowIndex: Math.min(startAddress.rowIndex, endAddress.rowIndex),
        columnIndex: Math.min(startAddress.columnIndex, endAddress.columnIndex)
      },
      end: {
        rowIndex: Math.max(startAddress.rowIndex, endAddress.rowIndex),
        columnIndex: Math.max(startAddress.columnIndex, endAddress.columnIndex)
      },
      label: match[0] ?? ""
    });
  }

  return ranges;
};

export const isCellInRanges = (rowIndex: number, columnIndex: number, ranges: TableRangeV2[]): boolean => {
  return ranges.some((range) =>
    rowIndex >= range.start.rowIndex &&
    rowIndex <= range.end.rowIndex &&
    columnIndex >= range.start.columnIndex &&
    columnIndex <= range.end.columnIndex
  );
};

export const createCellLabelFromAddress = (address: TableAddressV2): string => {
  return `${createColumnLabelFromIndex(address.columnIndex)}${address.rowIndex + 1}`;
};

export const normalizeFormulaAliases = (input: string): string => {
  if (!input.trimStart().startsWith("=")) {
    return input;
  }

  return input.replace(/\b([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-z0-9_ÁÉÍÓÚÑáéíóúñ]*)\s*(?=\()/g, (rawToken) => {
    const token = rawToken.trim().toUpperCase();
    const normalized = FORMULA_ALIAS_MAP[token] ?? token;
    return normalized;
  });
};

export const getFormulaAliasEntries = () => {
  return Object.entries(FORMULA_ALIAS_MAP).map(([alias, canonical]) => ({
    alias,
    canonical
  }));
};

export const toggleAbsoluteReference = (
  formula: string,
  cursorPosition: number
): { value: string; cursor: number } => {
  const regex = /\$?[A-Z]{1,4}\$?\d{1,7}/g;
  const cursor = Math.max(0, Math.min(cursorPosition, formula.length));
  let match = regex.exec(formula);
  while (match) {
    const token = match[0]!;
    const start = match.index;
    const end = start + token.length;
    if (cursor >= start && cursor <= end) {
      const parsed = token.match(/^(\$?)([A-Z]{1,4})(\$?)(\d{1,7})$/);
      if (!parsed) {
        break;
      }

      const [, rawColAbs, col, rawRowAbs, row] = parsed;
      const colAbs = rawColAbs === "$";
      const rowAbs = rawRowAbs === "$";

      let nextToken = token;
      if (!colAbs && !rowAbs) {
        nextToken = `$${col}$${row}`;
      } else if (colAbs && rowAbs) {
        nextToken = `${col}$${row}`;
      } else if (!colAbs && rowAbs) {
        nextToken = `$${col}${row}`;
      } else {
        nextToken = `${col}${row}`;
      }

      const value = `${formula.slice(0, start)}${nextToken}${formula.slice(end)}`;
      const cursorOffset = cursor - start;
      return {
        value,
        cursor: start + Math.min(nextToken.length, Math.max(0, cursorOffset))
      };
    }

    match = regex.exec(formula);
  }

  return {
    value: formula,
    cursor
  };
};

const shiftReferenceToken = (token: string, rowDelta: number, colDelta: number): string => {
  const parsed = token.match(/^(\$?)([A-Z]{1,4})(\$?)(\d{1,7})$/);
  if (!parsed) {
    return token;
  }

  const [, colAbsRaw, colLabel, rowAbsRaw, rowDigits] = parsed;
  const colAbs = colAbsRaw === "$";
  const rowAbs = rowAbsRaw === "$";

  const currentCol = columnIndexFromLabel(colLabel!);
  const currentRow = Number.parseInt(rowDigits!, 10) - 1;

  const nextCol = colAbs ? currentCol : Math.max(0, currentCol + colDelta);
  const nextRow = rowAbs ? currentRow : Math.max(0, currentRow + rowDelta);

  return `${colAbs ? "$" : ""}${createColumnLabelFromIndex(nextCol)}${rowAbs ? "$" : ""}${nextRow + 1}`;
};

export const shiftFormulaReferences = (formula: string, rowDelta: number, colDelta: number): string => {
  if (!formula.trimStart().startsWith("=")) {
    return formula;
  }

  return formula.replace(/\$?[A-Z]{1,4}\$?\d{1,7}/g, (token) =>
    shiftReferenceToken(token, rowDelta, colDelta)
  );
};

const deriveSeriesFromValues = (seedValues: string[]): ((offset: number) => string) | null => {
  if (seedValues.length === 0) {
    return null;
  }

  const numericValues = seedValues.map((entry) => Number(entry));
  if (numericValues.every((entry) => !Number.isNaN(entry))) {
    const base = numericValues[numericValues.length - 1] ?? 0;
    const previous = numericValues[numericValues.length - 2] ?? base - 1;
    const step = base - previous || 1;
    return (offset) => String(base + step * (offset + 1));
  }

  const dateValues = seedValues.map((entry) => {
    const date = new Date(entry);
    return Number.isNaN(date.getTime()) ? null : date;
  });
  if (dateValues.every((entry) => entry instanceof Date)) {
    const base = dateValues[dateValues.length - 1] as Date;
    const previous = (dateValues[dateValues.length - 2] as Date | undefined) ?? new Date(base.getTime() - 86400000);
    const stepMs = base.getTime() - previous.getTime() || 86400000;
    return (offset) => new Date(base.getTime() + stepMs * (offset + 1)).toISOString().slice(0, 10);
  }

  const upper = (seedValues[seedValues.length - 1] ?? "").trim().toUpperCase();
  const weekIdx = WEEKDAYS_ES.indexOf(upper) >= 0 ? WEEKDAYS_ES.indexOf(upper) : WEEKDAYS_EN.indexOf(upper);
  if (weekIdx >= 0) {
    return (offset) => WEEKDAYS_ES[(weekIdx + offset + 1) % WEEKDAYS_ES.length]!;
  }

  const monthIdx = MONTHS_ES.indexOf(upper) >= 0 ? MONTHS_ES.indexOf(upper) : MONTHS_EN.indexOf(upper);
  if (monthIdx >= 0) {
    return (offset) => MONTHS_ES[(monthIdx + offset + 1) % MONTHS_ES.length]!;
  }

  return null;
};

export const applyFillSeries = (params: {
  sourceValues: string[];
  fillLength: number;
  direction: "down" | "right";
  rowDelta?: number;
  colDelta?: number;
  mode?: "series" | "copy";
}): string[] => {
  const { sourceValues, fillLength, direction, mode = "series", rowDelta = 0, colDelta = 0 } = params;
  const safeLength = Math.max(0, fillLength);
  if (safeLength === 0) {
    return [];
  }

  if (sourceValues.length === 0) {
    return Array.from({ length: safeLength }, () => "");
  }

  const lastSeed = sourceValues[sourceValues.length - 1] ?? "";
  const isFormula = lastSeed.trimStart().startsWith("=");

  if (mode === "copy") {
    return Array.from({ length: safeLength }, (_, index) => {
      if (!isFormula) {
        return sourceValues[index % sourceValues.length] ?? "";
      }

      const step = index + 1;
      const nextRowDelta = direction === "down" ? rowDelta + step : rowDelta;
      const nextColDelta = direction === "right" ? colDelta + step : colDelta;
      return shiftFormulaReferences(lastSeed, nextRowDelta, nextColDelta);
    });
  }

  const generator = deriveSeriesFromValues(sourceValues);
  if (generator) {
    return Array.from({ length: safeLength }, (_, index) => generator(index));
  }

  return Array.from({ length: safeLength }, (_, index) => {
    if (isFormula) {
      const step = index + 1;
      const nextRowDelta = direction === "down" ? rowDelta + step : rowDelta;
      const nextColDelta = direction === "right" ? colDelta + step : colDelta;
      return shiftFormulaReferences(lastSeed, nextRowDelta, nextColDelta);
    }

    return sourceValues[index % sourceValues.length] ?? "";
  });
};

export const applyPasteSpecial = (params: {
  source: TableCellV2;
  target: TableCellV2;
  mode: TablePasteSpecialModeV2;
  computedValue?: string;
}): TableCellV2 => {
  const { source, target, mode, computedValue } = params;

  if (mode === "format") {
    if (!source.style) {
      const { style: _style, ...targetWithoutStyle } = target;
      return targetWithoutStyle;
    }
    return {
      ...target,
      style: { ...source.style }
    };
  }

  if (mode === "formulas") {
    return {
      ...target,
      value: source.value.trimStart().startsWith("=") ? source.value : target.value
    };
  }

  if (mode === "values") {
    return {
      ...target,
      value:
        computedValue ??
        (source.value.trimStart().startsWith("=") ? source.value.replace(/^=/, "") : source.value)
    };
  }

  return {
    value: source.value,
    ...(source.style ? { style: { ...source.style } } : {})
  };
};

export const validateCellAgainstRules = (
  value: string,
  rules: TableValidationRuleV2[],
  column: string
): string | null => {
  const matchingRules = rules.filter((rule) => rule.column === column);
  if (matchingRules.length === 0) {
    return null;
  }

  for (const rule of matchingRules) {
    const trimmed = value.trim();
    if (trimmed.length === 0 && rule.allowBlank !== false) {
      continue;
    }

    if (rule.type === "list") {
      const valid = rule.values.some((candidate) => candidate.toLowerCase() === trimmed.toLowerCase());
      if (!valid) {
        return rule.message ?? `Valor inválido para ${column}.`;
      }
    }

    if (rule.type === "numberRange") {
      const numeric = Number(trimmed);
      if (Number.isNaN(numeric)) {
        return rule.message ?? `Se requiere un número en ${column}.`;
      }
      if (typeof rule.min === "number" && numeric < rule.min) {
        return rule.message ?? `El mínimo permitido en ${column} es ${rule.min}.`;
      }
      if (typeof rule.max === "number" && numeric > rule.max) {
        return rule.message ?? `El máximo permitido en ${column} es ${rule.max}.`;
      }
    }

    if (rule.type === "dateRange") {
      const date = new Date(trimmed);
      if (Number.isNaN(date.getTime())) {
        return rule.message ?? `Se requiere una fecha válida en ${column}.`;
      }

      if (rule.min) {
        const min = new Date(rule.min);
        if (!Number.isNaN(min.getTime()) && date.getTime() < min.getTime()) {
          return rule.message ?? `La fecha mínima permitida en ${column} es ${rule.min}.`;
        }
      }

      if (rule.max) {
        const max = new Date(rule.max);
        if (!Number.isNaN(max.getTime()) && date.getTime() > max.getTime()) {
          return rule.message ?? `La fecha máxima permitida en ${column} es ${rule.max}.`;
        }
      }
    }
  }

  return null;
};

const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const workbookToCsv = (workbook: TableWorkbookV2, sheetId?: string): string => {
  const sheet = sheetId ? getSheetById(workbook, sheetId) : getActiveSheet(workbook);
  if (!sheet) {
    return "";
  }

  const header = sheet.columns.join(",");
  const rows = sheet.rows.map((row) =>
    sheet.columns.map((column) => csvEscape(row[column]?.value ?? "")).join(",")
  );

  return [header, ...rows].join("\n");
};

const decodeXlsxCell = (cell: XLSX.CellObject | undefined): string => {
  if (!cell) {
    return "";
  }

  if (typeof cell.f === "string" && cell.f.length > 0) {
    return `=${cell.f}`;
  }

  if (cell.v === null || cell.v === undefined) {
    return "";
  }

  return String(cell.v);
};

const sheetFromAoa = (
  aoa: unknown[][],
  name: string,
  maxRows = MAX_ROWS
): TableSheetV2 => {
  const safeRows = aoa.slice(0, Math.max(1, maxRows + 1));
  const firstRow = Array.isArray(safeRows[0]) ? safeRows[0] : [];

  const hasHeader =
    firstRow.length > 0 &&
    firstRow.every((value) => typeof value === "string" && String(value).trim().length > 0);

  const dataStartIndex = hasHeader ? 1 : 0;
  const rawColumns = hasHeader
    ? firstRow.map((value) => normalizeColumnToken(value) ?? String(value).trim().slice(0, 4).toUpperCase())
    : [];

  const columns = ensureUniqueColumns(
    rawColumns.length > 0
      ? rawColumns
      : Array.from({ length: Math.max(firstRow.length, DEFAULT_COLUMN_COUNT) }, (_, index) =>
          createColumnLabelFromIndex(index)
        )
  );

  const rows = safeRows.slice(dataStartIndex, dataStartIndex + MAX_ROWS).map((sourceRow) => {
    const values = Array.isArray(sourceRow) ? sourceRow : [];
    return Object.fromEntries(
      columns.map((column, index) => [
        column,
        {
          value: String(values[index] ?? "")
        } satisfies TableCellV2
      ])
    );
  });

  return {
    id: createSheetId(name),
    name: name.slice(0, 40) || "Sheet",
    columns,
    rows: rows.length > 0 ? rows : sanitizeRows([], columns),
    filters: [],
    filterStates: [],
    sort: null,
    validations: [],
    dimensions: { ...defaultDimensions },
    view: defaultViewState
  };
};

export const csvToWorkbookV2 = (csv: string): TableWorkbookV2 => {
  const parsed = XLSX.read(csv, {
    type: "string",
    raw: false,
    cellFormula: true
  });

  const firstName = parsed.SheetNames[0];
  if (!firstName) {
    return createEmptyWorkbookV2();
  }

  const ws = parsed.Sheets[firstName]!;
  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false
  }) as unknown[][];

  const sheet = sheetFromAoa(aoa, firstName);
  return {
    version: 2,
    activeSheetId: sheet.id,
    sheets: [sheet]
  };
};

export const workbookToXlsxArrayBuffer = (workbook: TableWorkbookV2): ArrayBuffer => {
  const next = sanitizeWorkbookV2(workbook);
  const xlsxWorkbook = XLSX.utils.book_new();

  next.sheets.forEach((sheet, sheetIndex) => {
    const data = [
      sheet.columns,
      ...sheet.rows.map((row) => sheet.columns.map((column) => row[column]?.value ?? ""))
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    sheet.rows.forEach((row, rowIndex) => {
      sheet.columns.forEach((column, columnIndex) => {
        const cellValue = row[column]?.value ?? "";
        if (!cellValue.startsWith("=")) {
          return;
        }

        const address = XLSX.utils.encode_cell({
          c: columnIndex,
          r: rowIndex + 1
        });

        ws[address] = {
          t: "n",
          f: cellValue.slice(1),
          v: 0
        };
      });
    });

    XLSX.utils.book_append_sheet(
      xlsxWorkbook,
      ws,
      (sheet.name || `Sheet ${sheetIndex + 1}`).slice(0, 31)
    );
  });

  return XLSX.write(xlsxWorkbook, {
    bookType: "xlsx",
    type: "array"
  }) as ArrayBuffer;
};

export const xlsxArrayBufferToWorkbookV2 = (buffer: ArrayBuffer): TableWorkbookV2 => {
  const parsed = XLSX.read(buffer, {
    type: "array",
    raw: false,
    cellFormula: true
  });

  const sheets = parsed.SheetNames.map((sheetName, index) => {
    const ws = parsed.Sheets[sheetName];
    if (!ws || !ws["!ref"]) {
      return sanitizeSheet({
        id: createSheetId(`${sheetName}-${index + 1}`),
        name: sheetName
      }, index);
    }

    const range = XLSX.utils.decode_range(ws["!ref"]);
    const columnCount = Math.max(DEFAULT_COLUMN_COUNT, range.e.c + 1);
    const rowCount = Math.min(MAX_ROWS, Math.max(1, range.e.r + 1));

    const columns = Array.from({ length: columnCount }, (_, colIndex) =>
      createColumnLabelFromIndex(colIndex)
    );

    const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
      Object.fromEntries(
        columns.map((column, columnIndex) => {
          const address = XLSX.utils.encode_cell({
            c: columnIndex,
            r: rowIndex
          });
          const cell = ws[address];
          return [
            column,
            {
              value: decodeXlsxCell(cell)
            } satisfies TableCellV2
          ];
        })
      )
    );

    return sanitizeSheet(
      {
        id: createSheetId(`${sheetName}-${index + 1}`),
        name: sheetName,
        columns,
        rows
      },
      index
    );
  });

  const safeSheets = sheets.length > 0 ? sheets : [createEmptySheetV2()];

  return {
    version: 2,
    activeSheetId: safeSheets[0]!.id,
    sheets: safeSheets
  };
};

export const stringifyCellForY = (cell: TableCellV2): string => {
  return JSON.stringify({
    value: cell.value,
    ...(cell.style ? { style: cell.style } : {})
  });
};

export const parseCellFromY = (raw: unknown): TableCellV2 => {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return sanitizeCell(parsed);
    } catch {
      return {
        value: raw
      };
    }
  }

  return sanitizeCell(raw);
};
