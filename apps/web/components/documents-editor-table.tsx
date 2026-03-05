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

  const lastSerializedRef = useRef("");

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
    onChange(payload);

    if (yLegacyText.toString() !== payload) {
      yLegacyText.delete(0, yLegacyText.length);
      yLegacyText.insert(0, payload);
    }
  }, [onChange, yLegacyText, yRoot]);

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

  const updateCellRawValue = (rowIndex: number, column: string, nextRaw: string) => {
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
  };

  const columnDefs = useMemo<ColDef[]>(() => {
    return tableState.columns.map((column, columnIndex) => ({
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
        return true;
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
    }));
  }, [computedMatrix, readOnly, remoteCellMap, tableState.columns]);

  const selectedCellValue = useMemo(() => {
    if (!selectedCell) {
      return "";
    }

    return tableState.rows[selectedCell.rowIndex]?.[selectedCell.column] ?? "";
  }, [selectedCell, tableState.rows]);

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-3">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Tabla colaborativa con fórmulas (AG Grid + HyperFormula + Y.js CRDT por celda)
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <label className="mb-1 block text-xs font-semibold text-slate-600">Barra de fórmula</label>
        <input
          value={selectedCellValue}
          onChange={(event) => {
            if (!selectedCell) {
              return;
            }
            updateCellRawValue(selectedCell.rowIndex, selectedCell.column, event.target.value);
          }}
          disabled={readOnly || !selectedCell}
          placeholder={selectedCell ? `Celda ${selectedCell.column}${selectedCell.rowIndex + 1}` : "Selecciona una celda"}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Ejemplos: <code>=SUM(A1:A10)</code>, <code>=AVERAGE(B1:B10)</code>, <code>=COUNT(C1:C10)</code>
        </p>
      </div>

      {remoteSelections.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            {remoteSelections.map((item) => (
              <span
                key={`${item.userId}-${item.rowIndex}-${item.column}`}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}: {item.column}
                {item.rowIndex + 1}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ag-theme-quartz h-[500px] w-full overflow-hidden rounded-xl border border-slate-200">
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
          onCellValueChanged={(event) => {
            if (readOnly) {
              return;
            }

            const rowIndex = event.rowIndex ?? -1;
            const column = event.colDef.field;
            if (rowIndex < 0 || !column) {
              return;
            }

            updateCellRawValue(rowIndex, column, String(event.newValue ?? ""));
          }}
        />
      </div>
    </div>
  );
};
