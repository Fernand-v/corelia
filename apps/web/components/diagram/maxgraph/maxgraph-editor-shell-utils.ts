import type { CSSProperties } from "react";
import type { DiagramKind } from "@corelia/types";
import type { AbstractGraph, Cell } from "@maxgraph/core";

import type { SelectedCellView } from "@/components/diagram/maxgraph/maxgraph-properties-panel";
import type { GridMode, CanvasMode, RemoteCursorPresence } from "@/components/diagram/maxgraph/types";
import { DIAGRAM_THEME_BY_KIND } from "@/lib/diagram/maxgraph/themes";
import type { DrawioDocument } from "@/lib/diagram/maxgraph/xml-format";
import { getActivePage } from "@/lib/diagram/maxgraph/xml-pages";

export const AWARENESS_KEY = "diagram-maxgraph-presence";

export const backgroundByMode = (
  canvasMode: CanvasMode,
  gridMode: GridMode,
  kind: DiagramKind
): CSSProperties => {
  const theme = DIAGRAM_THEME_BY_KIND[kind];

  if (gridMode === "none") {
    return {
      background: canvasMode === "light" ? theme.canvasBackgroundLight : theme.canvasBackgroundDark
    };
  }

  if (gridMode === "lines") {
    const color = canvasMode === "light" ? theme.gridColorLight : theme.gridColorDark;
    return {
      backgroundColor:
        canvasMode === "light" ? theme.canvasBackgroundLight : theme.canvasBackgroundDark,
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: "16px 16px"
    };
  }

  const color = canvasMode === "light" ? theme.gridColorLight : theme.gridColorDark;
  return {
    backgroundColor: canvasMode === "light" ? theme.canvasBackgroundLight : theme.canvasBackgroundDark,
    backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
    backgroundSize: "16px 16px"
  };
};

const stringifyValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const areStringListsEqual = (left: string[] = [], right: string[] = []): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
};

export const areRemotePresenceEqual = (
  left: RemoteCursorPresence[],
  right: RemoteCursorPresence[]
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];

    if (!a || !b) {
      return false;
    }

    if (
      a.documentId !== b.documentId ||
      a.pageId !== b.pageId ||
      a.userId !== b.userId ||
      a.name !== b.name ||
      a.color !== b.color
    ) {
      return false;
    }

    const cursorA = a.cursor ?? null;
    const cursorB = b.cursor ?? null;
    if (cursorA === null || cursorB === null) {
      if (cursorA !== cursorB) {
        return false;
      }
    } else if (cursorA.x !== cursorB.x || cursorA.y !== cursorB.y) {
      return false;
    }

    if (!areStringListsEqual(a.selectedCellIds, b.selectedCellIds)) {
      return false;
    }
  }

  return true;
};

const parseMeta = (style: Record<string, unknown>): Array<{ key: string; value: string }> => {
  const raw = style.meta;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Array<{ key: string; value: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item.key === "string").map((item) => ({
      key: item.key,
      value: typeof item.value === "string" ? item.value : ""
    }));
  } catch {
    return [];
  }
};

export const encodeMeta = (items: Array<{ key: string; value: string }>): string =>
  encodeURIComponent(JSON.stringify(items.filter((item) => item.key.trim().length > 0)));

export const toStyleRecord = (style: unknown): Record<string, unknown> => {
  if (!style || typeof style !== "object") {
    return {};
  }

  return { ...(style as Record<string, unknown>) };
};

export const buildSelectedCellView = (
  graph: AbstractGraph | null,
  document: DrawioDocument
): SelectedCellView => {
  if (!graph) {
    return {
      type: "none",
      id: null,
      label: "",
      style: {},
      geometry: null,
      connections: [],
      metadata: [],
      diagramInfo: {
        totalCells: 0,
        totalVertices: 0,
        totalEdges: 0,
        pageName: getActivePage(document)?.name ?? ""
      }
    };
  }

  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const edges = graph.getChildEdges(parent);
  const selectedCell = graph.getSelectionCell();

  if (!selectedCell) {
    return {
      type: "none",
      id: null,
      label: "",
      style: {},
      geometry: null,
      connections: [],
      metadata: [],
      diagramInfo: {
        totalCells: vertices.length + edges.length,
        totalVertices: vertices.length,
        totalEdges: edges.length,
        pageName: getActivePage(document)?.name ?? ""
      }
    };
  }

  const style = toStyleRecord(selectedCell.getStyle());
  const geometry = selectedCell.getGeometry();
  const label = stringifyValue(selectedCell.getValue());

  const connections = selectedCell.isVertex()
    ? [
        ...graph.getIncomingEdges(selectedCell, null).map((edge) => ({
          id: edge.getId() ?? "",
          label: stringifyValue(edge.getValue()) || edge.getId() || "edge",
          direction: "in" as const
        })),
        ...graph.getOutgoingEdges(selectedCell, null).map((edge) => ({
          id: edge.getId() ?? "",
          label: stringifyValue(edge.getValue()) || edge.getId() || "edge",
          direction: "out" as const
        }))
      ]
    : [];

  return {
    type: selectedCell.isEdge() ? "edge" : "vertex",
    id: selectedCell.getId(),
    label,
    style,
    geometry: geometry
      ? {
          x: geometry.x ?? 0,
          y: geometry.y ?? 0,
          width: geometry.width ?? 0,
          height: geometry.height ?? 0
        }
      : null,
    connections,
    metadata: parseMeta(style),
    diagramInfo: {
      totalCells: vertices.length + edges.length,
      totalVertices: vertices.length,
      totalEdges: edges.length,
      pageName: getActivePage(document)?.name ?? ""
    }
  };
};

export const applyThemeToGraph = (graph: AbstractGraph, kind: DiagramKind) => {
  const theme = DIAGRAM_THEME_BY_KIND[kind];
  graph.getStylesheet().putCellStyle(
    "defaultVertex",
    {
      perimeter: "rectanglePerimeter",
      ...theme.defaultVertexStyle
    } as any
  );
  graph.getStylesheet().putCellStyle(
    "defaultEdge",
    {
      edgeStyle: "orthogonalEdgeStyle",
      rounded: 1,
      entryPerimeter: 1,
      exitPerimeter: 1,
      ...theme.defaultEdgeStyle
    } as any
  );
};

export const cloneStyle = (style: Record<string, unknown>): Record<string, unknown> => ({ ...style });

export const baseConnectorStyle: Record<string, string | number | boolean> = {
  edgeStyle: "orthogonalEdgeStyle",
  rounded: 1,
  entryPerimeter: 1,
  exitPerimeter: 1
};

export const resolveConnectableVertex = (graph: AbstractGraph, rawCell: Cell | null): Cell | null => {
  if (!rawCell) {
    return null;
  }

  let current: Cell | null = rawCell;
  const parent = graph.getDefaultParent();

  while (current && current !== parent) {
    if (current.isVertex() && !current.isEdge()) {
      return current;
    }
    current = current.getParent();
  }

  return null;
};

export const graphToScreenPoint = (
  graph: AbstractGraph,
  point: { x: number; y: number }
): { x: number; y: number } => {
  const scale = graph.getView().scale || 1;
  const translate = graph.getView().translate;
  return {
    x: (point.x + translate.x) * scale,
    y: (point.y + translate.y) * scale
  };
};

export const screenToGraphPoint = (
  graph: AbstractGraph,
  point: { x: number; y: number }
): { x: number; y: number } => {
  const scale = graph.getView().scale || 1;
  const translate = graph.getView().translate;
  return {
    x: point.x / scale - translate.x,
    y: point.y / scale - translate.y
  };
};
