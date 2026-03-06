"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { AgGridReact } from "ag-grid-react";
import { HyperFormula } from "hyperformula";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const FORMULA_FUNCTIONS: { name: string; description: string }[] = (() => {
  const descriptions: Record<string, string> = {
    SUM: "Suma un rango de celdas",
    AVERAGE: "Promedio de un rango",
    COUNT: "Cuenta celdas con números",
    COUNTA: "Cuenta celdas no vacías",
    COUNTBLANK: "Cuenta celdas vacías",
    MAX: "Valor máximo",
    MIN: "Valor mínimo",
    IF: "Condicional: SI(condición, verdadero, falso)",
    AND: "Verdadero si todos los argumentos son verdaderos",
    OR: "Verdadero si algún argumento es verdadero",
    NOT: "Invierte un valor lógico",
    CONCATENATE: "Une textos",
    LEFT: "Primeros N caracteres",
    RIGHT: "Últimos N caracteres",
    MID: "Subcadena desde posición",
    LEN: "Longitud de texto",
    TRIM: "Elimina espacios extra",
    UPPER: "Convierte a mayúsculas",
    LOWER: "Convierte a minúsculas",
    ROUND: "Redondea a N decimales",
    ROUNDUP: "Redondea hacia arriba",
    ROUNDDOWN: "Redondea hacia abajo",
    ABS: "Valor absoluto",
    POWER: "Potencia: POWER(base, exp)",
    SQRT: "Raíz cuadrada",
    TODAY: "Fecha de hoy",
    NOW: "Fecha y hora actual",
    VLOOKUP: "Búsqueda vertical",
    HLOOKUP: "Búsqueda horizontal",
    INDEX: "Valor en posición de rango",
    MATCH: "Posición de un valor en rango",
    SUMIF: "Suma condicional",
    COUNTIF: "Cuenta condicional",
    AVERAGEIF: "Promedio condicional",
    MEDIAN: "Mediana de un rango",
    PRODUCT: "Producto de un rango",
    MOD: "Resto de división",
    INT: "Parte entera"
  };

  try {
    const registered = HyperFormula.getRegisteredFunctionNames("enGB");
    return registered
      .filter((name) => name in descriptions)
      .sort()
      .map((name) => ({ name, description: descriptions[name] as string }));
  } catch {
    return Object.entries(descriptions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, description]) => ({ name, description }));
  }
})();

type TableState = {
  columns: string[];
  rows: Array<Record<string, string>>;
};

type RemoteCellSelection = {
  userId: string;
  name: string;
  color: string;
  rowIndex: number;
  column: string;
};

const TABLE_AWARENESS_KEY = "coreliaTableCell";
const DEFAULT_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const createDefaultTable = (): TableState => ({
  columns: DEFAULT_COLUMNS,
  rows: Array.from({ length: 20 }).map(() =>
    Object.fromEntries(DEFAULT_COLUMNS.map((column) => [column, ""]))
  )
});

const normalizeColumns = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_COLUMNS;
  }

  const normalized = value
    .map((column) => String(column).trim().toUpperCase().slice(0, 4))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_COLUMNS;
};

const parseTable = (value: string): TableState => {
  if (!value.trim()) {
    return createDefaultTable();
  }

  try {
    const parsed = JSON.parse(value) as Partial<TableState>;
    const columns = normalizeColumns(parsed.columns);

    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.map((row) =>
          Object.fromEntries(
            columns.map((column) => [column, String((row as Record<string, unknown>)[column] ?? "")])
          )
        )
      : [];

    if (rows.length === 0) {
      return {
        columns,
        rows: createDefaultTable().rows
      };
    }

    return {
      columns,
      rows
    };
  } catch {
    return createDefaultTable();
  }
};

const stringifyCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return String((value as { value?: unknown }).value ?? "");
  }
  return String(value);
};

const buildYRowsFromState = (state: TableState) => {
  const yRows = new Y.Array<Y.Map<string>>();

  for (const row of state.rows) {
    const yRow = new Y.Map<string>();
    for (const column of state.columns) {
      yRow.set(column, row[column] ?? "");
    }
    yRows.push([yRow]);
  }

  return yRows;
};

const readStateFromY = (yRoot: Y.Map<unknown>): TableState => {
  const yColumns = yRoot.get("columns");
  const yRows = yRoot.get("rows");

  if (!(yColumns instanceof Y.Array) || !(yRows instanceof Y.Array)) {
    return createDefaultTable();
  }

  const columns = normalizeColumns(yColumns.toArray());
  const rows = yRows
    .toArray()
    .map((row) => {
      if (!(row instanceof Y.Map)) {
        return Object.fromEntries(columns.map((column) => [column, ""]));
      }

      return Object.fromEntries(columns.map((column) => [column, String(row.get(column) ?? "")]));
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      columns,
      rows: createDefaultTable().rows
    };
  }

  return {
    columns,
    rows
  };
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

  const [tableState, setTableState] = useState<TableState>(() => parseTable(value || yLegacyText.toString()));
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<RemoteCellSelection[]>([]);
  const [formulaQuery, setFormulaQuery] = useState<string | null>(null);
  const [formulaDropdownIndex, setFormulaDropdownIndex] = useState(0);
  const formulaBarRef = useRef<HTMLInputElement>(null);

  const lastSerializedRef = useRef("");
  const lastNotifiedRef = useRef("");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const writeStateToY = useCallback(
    (state: TableState) => {
      yDoc.transact(() => {
        const yColumns = new Y.Array<string>();
        yColumns.push(state.columns);

        yRoot.set("columns", yColumns);
        yRoot.set("rows", buildYRowsFromState(state));
        yRoot.set("initialized", true);
      });
    },
    [yDoc, yRoot]
  );

  const ensureInitialized = useCallback(() => {
    const initialized = yRoot.get("initialized");
    if (initialized === true) {
      return;
    }

    const seed = parseTable(value || yLegacyText.toString());
    writeStateToY(seed);

    const legacyPayload = JSON.stringify(seed);
    if (yLegacyText.toString() !== legacyPayload) {
      yLegacyText.delete(0, yLegacyText.length);
      yLegacyText.insert(0, legacyPayload);
    }
  }, [value, writeStateToY, yLegacyText, yRoot]);

  const syncFromY = useCallback(() => {
    const nextState = readStateFromY(yRoot);
    const payload = JSON.stringify(nextState);

    lastSerializedRef.current = payload;
    setTableState(nextState);
    if (lastNotifiedRef.current !== payload) {
      lastNotifiedRef.current = payload;
      onChangeRef.current(payload);
    }

    if (yLegacyText.toString() !== payload) {
      yLegacyText.delete(0, yLegacyText.length);
      yLegacyText.insert(0, payload);
    }
  }, [yLegacyText, yRoot]);

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

    writeStateToY(parseTable(value));
  }, [value, writeStateToY]);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      setRemoteSelections([]);
      return;
    }

    const refreshRemoteSelections = () => {
      const next: RemoteCellSelection[] = [];
      const states = awareness.getStates();

      states.forEach((state: any) => {
        const cell = state?.[TABLE_AWARENESS_KEY] as
          | (RemoteCellSelection & { documentId?: string })
          | null
          | undefined;

        if (!cell || cell.documentId !== documentId || cell.userId === currentUser.id) {
          return;
        }

        next.push({
          userId: cell.userId,
          name: cell.name,
          color: cell.color,
          rowIndex: cell.rowIndex,
          column: cell.column
        });
      });

      setRemoteSelections(next);
    };

    refreshRemoteSelections();
    awareness.on("change", refreshRemoteSelections);

    return () => {
      awareness.off("change", refreshRemoteSelections);
    };
  }, [currentUser.id, documentId, provider]);

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
      rowIndex: selectedCell.rowIndex,
      column: selectedCell.column
    });
  }, [currentUser.color, currentUser.id, currentUser.name, documentId, provider, selectedCell]);

  const matrix = useMemo(() => {
    return tableState.rows.map((row) =>
      tableState.columns.map((column) => {
        const raw = row[column] ?? "";
        return raw.trim() === "" ? null : raw;
      })
    );
  }, [tableState.columns, tableState.rows]);

  const computedMatrix = useMemo(() => {
    try {
      const hf = HyperFormula.buildFromArray(matrix, {
        licenseKey: "gpl-v3"
      });
      const values = hf.getSheetValues(0);
      hf.destroy();
      return values;
    } catch {
      return matrix;
    }
  }, [matrix]);

  const remoteCellMap = useMemo(() => {
    const map = new Map<string, RemoteCellSelection>();
    for (const item of remoteSelections) {
      map.set(`${item.rowIndex}:${item.column}`, item);
    }
    return map;
  }, [remoteSelections]);

  const updateCellRawValue = useCallback(
    (rowIndex: number, column: string, nextRaw: string) => {
      if (readOnly) {
        return;
      }

      const yRows = yRoot.get("rows");
      if (!(yRows instanceof Y.Array)) {
        return;
      }

      const yRow = yRows.get(rowIndex);
      if (!(yRow instanceof Y.Map)) {
        return;
      }

      yRow.set(column, nextRaw);
    },
    [readOnly, yRoot]
  );

  const columnDefs = useMemo<ColDef[]>(() => {
    const rowNumberCol: ColDef = {
      headerName: "",
      width: 50,
      maxWidth: 50,
      pinned: "left",
      editable: false,
      sortable: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: true,
      valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      cellStyle: {
        backgroundColor: "#f0f0f0",
        textAlign: "center",
        color: "#6b7280",
        fontSize: "11px",
        fontWeight: "600",
        borderRight: "1px solid #d1d5db"
      }
    };
    return [rowNumberCol, ...tableState.columns.map<ColDef>((column, columnIndex) => ({
      field: column,
      headerName: column,
      editable: !readOnly,
      minWidth: 120,
      flex: 1,
      resizable: true,
      valueGetter: (params) => {
        const rowIndex = params.node?.rowIndex ?? -1;
        if (rowIndex < 0) {
          return "";
        }

        const computed = computedMatrix[rowIndex]?.[columnIndex];
        return stringifyCellValue(computed);
      },
      valueSetter: (params) => {
        if (readOnly) {
          return false;
        }

        const rowIndex = params.node?.rowIndex ?? -1;
        if (rowIndex < 0) {
          return false;
        }

        updateCellRawValue(rowIndex, column, String(params.newValue ?? ""));
        // The Y.js observer drives table re-renders; returning false prevents AG Grid double-mutation.
        return false;
      },
      cellStyle: (params) => {
        const rowIndex = params.node?.rowIndex ?? -1;
        if (rowIndex < 0) {
          return;
        }

        const remoteSelection = remoteCellMap.get(`${rowIndex}:${column}`);
        if (!remoteSelection) {
          return;
        }

        return {
          backgroundColor: `${remoteSelection.color}26`,
          boxShadow: `inset 0 0 0 2px ${remoteSelection.color}`
        };
      },
      tooltipValueGetter: (params) => {
        const rowIndex = params.node?.rowIndex ?? -1;
        if (rowIndex < 0) {
          return undefined;
        }

        const remoteSelection = remoteCellMap.get(`${rowIndex}:${column}`);
        return remoteSelection ? `${remoteSelection.name} está editando esta celda` : undefined;
      }
    }))];
  }, [computedMatrix, readOnly, remoteCellMap, tableState.columns, updateCellRawValue]);

  const selectedCellValue = useMemo(() => {
    if (!selectedCell) {
      return "";
    }

    return tableState.rows[selectedCell.rowIndex]?.[selectedCell.column] ?? "";
  }, [selectedCell, tableState.rows]);

  const addRow = useCallback(() => {
    if (readOnly) return;
    const yRows = yRoot.get("rows");
    if (!(yRows instanceof Y.Array)) return;
    const yRow = new Y.Map<string>();
    for (const col of tableState.columns) {
      yRow.set(col, "");
    }
    yRows.push([yRow]);
  }, [readOnly, tableState.columns, yRoot]);

  const removeLastRow = useCallback(() => {
    if (readOnly) return;
    const yRows = yRoot.get("rows");
    if (!(yRows instanceof Y.Array) || yRows.length === 0) return;
    yRows.delete(yRows.length - 1, 1);
  }, [readOnly, yRoot]);

  const addColumn = useCallback(() => {
    if (readOnly) return;
    const yColumns = yRoot.get("columns");
    const yRows = yRoot.get("rows");
    if (!(yColumns instanceof Y.Array) || !(yRows instanceof Y.Array)) return;
    const existingCols = yColumns.toArray().map(String);
    const nextLetter = String.fromCharCode(65 + existingCols.length);
    const newCol = existingCols.includes(nextLetter)
      ? `C${existingCols.length + 1}`
      : nextLetter;
    yDoc.transact(() => {
      yColumns.push([newCol]);
      yRows.toArray().forEach((row) => {
        if (row instanceof Y.Map) {
          row.set(newCol, "");
        }
      });
    });
  }, [readOnly, yDoc, yRoot]);

  const removeLastColumn = useCallback(() => {
    if (readOnly) return;
    const yColumns = yRoot.get("columns");
    const yRows = yRoot.get("rows");
    if (!(yColumns instanceof Y.Array) || yColumns.length <= 1) return;
    const lastCol = String(yColumns.get(yColumns.length - 1));
    yDoc.transact(() => {
      yColumns.delete(yColumns.length - 1, 1);
      if (yRows instanceof Y.Array) {
        yRows.toArray().forEach((row) => {
          if (row instanceof Y.Map) {
            row.delete(lastCol);
          }
        });
      }
    });
  }, [readOnly, yDoc, yRoot]);

  const exportCsv = useCallback(() => {
    const header = tableState.columns.join(",");
    const rows = tableState.rows.map((row) =>
      tableState.columns
        .map((col) => {
          const val = row[col] ?? "";
          return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [documentId, tableState]);

  const formulaSuggestions = useMemo(() => {
    if (formulaQuery === null || formulaQuery === "") return [];
    const upper = formulaQuery.toUpperCase();
    return FORMULA_FUNCTIONS.filter((f) => f.name.startsWith(upper)).slice(0, 8);
  }, [formulaQuery]);

  const handleFormulaBarChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedCell) return;
      const val = event.target.value;
      updateCellRawValue(selectedCell.rowIndex, selectedCell.column, val);

      if (val.startsWith("=")) {
        const match = val.match(/[A-Za-z][A-Za-z0-9]*$/);
        if (match) {
          setFormulaQuery(match[0]);
          setFormulaDropdownIndex(0);
        } else {
          setFormulaQuery(null);
        }
      } else {
        setFormulaQuery(null);
      }
    },
    [selectedCell, updateCellRawValue]
  );

  const insertFormula = useCallback(
    (funcName: string) => {
      if (!selectedCell || !formulaBarRef.current) return;
      const currentVal = selectedCellValue;
      const match = currentVal.match(/[A-Za-z][A-Za-z0-9]*$/);
      if (!match) return;
      const before = currentVal.slice(0, match.index);
      const newVal = before + funcName + "(";
      updateCellRawValue(selectedCell.rowIndex, selectedCell.column, newVal);
      setFormulaQuery(null);
      requestAnimationFrame(() => {
        if (formulaBarRef.current) {
          formulaBarRef.current.focus();
          formulaBarRef.current.setSelectionRange(newVal.length, newVal.length);
        }
      });
    },
    [selectedCell, selectedCellValue, updateCellRawValue]
  );

  const handleFormulaBarKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (formulaSuggestions.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFormulaDropdownIndex((i) => Math.min(i + 1, formulaSuggestions.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFormulaDropdownIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const selected = formulaSuggestions[formulaDropdownIndex];
        if (selected) insertFormula(selected.name);
      } else if (event.key === "Escape") {
        setFormulaQuery(null);
      }
    },
    [formulaDropdownIndex, formulaSuggestions, insertFormula]
  );

  const tbBtn = (disabled = false) =>
    `inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors active:scale-95 ${
      disabled
        ? "cursor-not-allowed border-[rgba(0,0,0,0.06)] bg-slate-50 text-slate-400"
        : "border-[rgba(0,0,0,0.09)] bg-white text-slate-600 shadow-sm hover:bg-slate-50"
    }`;

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[rgba(0,0,0,0.07)] bg-[#f8f9fa] px-3 py-2">
        {!readOnly ? (
          <>
            <div className="flex items-center gap-1">
              <button type="button" onClick={addRow} className={tbBtn(false)} title="Añadir fila">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M12 14v7M8.5 17.5h7"/></svg>
                + Fila
              </button>
              <button type="button" onClick={removeLastRow} disabled={tableState.rows.length <= 1} className={tbBtn(tableState.rows.length <= 1)} title="Eliminar última fila">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M8 17.5h8"/></svg>
                − Fila
              </button>
            </div>
            <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
            <div className="flex items-center gap-1">
              <button type="button" onClick={addColumn} className={tbBtn(false)} title="Añadir columna">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M14 12h7M17.5 8.5v7"/></svg>
                + Col
              </button>
              <button type="button" onClick={removeLastColumn} disabled={tableState.columns.length <= 1} className={tbBtn(tableState.columns.length <= 1)} title="Eliminar última columna">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M17 12h4"/></svg>
                − Col
              </button>
            </div>
            <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
          </>
        ) : null}
        <button type="button" onClick={exportCsv} className={tbBtn(false)} title="Exportar CSV">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
        {remoteSelections.length > 0 ? (
          <>
            <span className="h-5 w-px bg-[rgba(0,0,0,0.12)]" />
            <div className="flex flex-wrap items-center gap-1">
              {remoteSelections.map((item) => (
                <span
                  key={`${item.userId}-${item.rowIndex}-${item.column}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[rgba(0,0,0,0.07)] bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}: {item.column}{item.rowIndex + 1}
                </span>
              ))}
            </div>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
          <span>{tableState.rows.length} filas</span>
          <span>·</span>
          <span>{tableState.columns.length} col</span>
        </div>
      </div>

      {/* Formula bar */}
      <div className="relative flex items-center gap-2 border-b border-[rgba(0,0,0,0.06)] bg-white px-3 py-1.5">
        <span className="shrink-0 rounded bg-[#f0f4f9] px-2 py-1 text-[11px] font-semibold text-slate-500 min-w-[4rem] text-center">
          {selectedCell ? `${selectedCell.column}${selectedCell.rowIndex + 1}` : "—"}
        </span>
        <span className="shrink-0 text-sm italic font-bold text-slate-400 select-none">fx</span>
        <input
          ref={formulaBarRef}
          value={selectedCellValue}
          onChange={handleFormulaBarChange}
          onKeyDown={handleFormulaBarKeyDown}
          onBlur={() => setTimeout(() => setFormulaQuery(null), 150)}
          disabled={readOnly || !selectedCell}
          placeholder={selectedCell ? `Introduce un valor o una fórmula como =SUM(A1:A10)` : "Selecciona una celda para editar"}
          className="h-8 flex-1 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f9fa] px-3 text-sm font-mono text-slate-700 outline-none transition-shadow focus:border-[#0a84ff] focus:bg-white focus:ring-2 focus:ring-[#0a84ff]/20 disabled:cursor-default disabled:bg-transparent disabled:border-transparent"
        />
        {formulaSuggestions.length > 0 && (
          <div className="absolute left-20 top-full z-50 mt-0.5 w-80 rounded-lg border border-[rgba(0,0,0,0.12)] bg-white shadow-lg overflow-hidden">
            {formulaSuggestions.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertFormula(item.name);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  index === formulaDropdownIndex ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 font-mono">
                  {item.name}
                </span>
                <span className="truncate text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ag-theme-quartz flex-1 overflow-hidden">
        <AgGridReact
          theme="legacy"
          rowData={tableState.rows}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: false,
            filter: false
          }}
          animateRows
          onCellClicked={(event) => {
            const rowIndex = event.rowIndex ?? -1;
            const column = event.colDef.field;
            if (rowIndex < 0 || !column) {
              setSelectedCell(null);
              return;
            }
            setSelectedCell({ rowIndex, column });
          }}
        />
      </div>
    </div>
  );
};
