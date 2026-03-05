import { Geometry, Rectangle, type AbstractGraph, type Cell } from "@maxgraph/core";

import type { EdgeTemplate, ShapeTemplate } from "@/lib/diagram/maxgraph/palette-catalog";

const normalizePoint = (
  graph: AbstractGraph,
  input: { x: number; y: number }
): { x: number; y: number } => {
  const scale = graph.getView().scale || 1;
  const translate = graph.getView().translate;

  return {
    x: input.x / scale - translate.x,
    y: input.y / scale - translate.y
  };
};

export const getViewportCenter = (
  graph: AbstractGraph,
  container: HTMLElement
): { x: number; y: number } => {
  const scale = graph.getView().scale || 1;
  const translate = graph.getView().translate;

  const x = container.clientWidth / 2 / scale - translate.x;
  const y = container.clientHeight / 2 / scale - translate.y;

  return { x, y };
};

export const insertShapeTemplate = (
  graph: AbstractGraph,
  template: ShapeTemplate,
  options?: {
    screenPoint?: { x: number; y: number };
    graphPoint?: { x: number; y: number };
    container?: HTMLElement | null;
  }
): Cell => {
  const parent = graph.getDefaultParent();

  const graphPoint = options?.graphPoint
    ? options.graphPoint
    : options?.screenPoint
      ? normalizePoint(graph, options.screenPoint)
      : options?.container
        ? getViewportCenter(graph, options.container)
        : { x: 120, y: 120 };

  const x = graph.snap(graphPoint.x - template.width / 2);
  const y = graph.snap(graphPoint.y - template.height / 2);

  let inserted: Cell | null = null;
  graph.batchUpdate(() => {
    inserted = graph.insertVertex({
      parent,
      value: template.value ?? template.label,
      position: [x, y],
      size: [template.width, template.height],
      style: template.style as any
    });
  });

  if (!inserted) {
    throw new Error("No se pudo insertar el shape en maxGraph");
  }

  return inserted;
};

export const insertEdgeTemplate = (
  graph: AbstractGraph,
  template: EdgeTemplate,
  source: Cell,
  target: Cell
): Cell => {
  const parent = graph.getDefaultParent();

  let inserted: Cell | null = null;
  graph.batchUpdate(() => {
    inserted = graph.insertEdge({
      parent,
      value: template.value ?? template.label,
      source,
      target,
      style: template.style as any
    });
  });

  if (!inserted) {
    throw new Error("No se pudo insertar el conector en maxGraph");
  }

  return inserted;
};

export const moveCellToCenter = (
  graph: AbstractGraph,
  cell: Cell,
  container: HTMLElement
): void => {
  const center = getViewportCenter(graph, container);
  const geometry = cell.getGeometry();
  if (!geometry) {
    return;
  }

  const width = geometry.width ?? 120;
  const height = geometry.height ?? 80;

  const nextGeometry = geometry.clone();
  nextGeometry.x = graph.snap(center.x - width / 2);
  nextGeometry.y = graph.snap(center.y - height / 2);

  graph.batchUpdate(() => {
    graph.getDataModel().setGeometry(cell, nextGeometry);
  });
};

export const resizeCell = (
  graph: AbstractGraph,
  cell: Cell,
  size: { width: number; height: number }
): void => {
  const geometry = cell.getGeometry();
  if (!geometry) {
    return;
  }

  const next = geometry.clone();
  next.width = Math.max(20, size.width);
  next.height = Math.max(20, size.height);

  graph.batchUpdate(() => {
    graph.getDataModel().setGeometry(cell, next);
  });
};

export const setCellPosition = (
  graph: AbstractGraph,
  cell: Cell,
  position: { x: number; y: number }
): void => {
  const geometry = cell.getGeometry();
  if (!geometry) {
    return;
  }

  const next = geometry.clone();
  next.x = graph.snap(position.x);
  next.y = graph.snap(position.y);

  graph.batchUpdate(() => {
    graph.getDataModel().setGeometry(cell, next);
  });
};

export const zoomToPercent = (graph: AbstractGraph, percent: number): void => {
  const normalized = Math.min(300, Math.max(10, percent));
  graph.zoomTo(normalized / 100);
};

export const fitGraph = (graph: AbstractGraph): void => {
  const bounds = graph.getGraphBounds();
  graph.zoomToRect(bounds);
};

export const resetView = (graph: AbstractGraph): void => {
  graph.getView().setScale(1);
  graph.getView().setTranslate(0, 0);
};

export const geometryToRectangle = (cell: Cell): Rectangle | null => {
  const geometry = cell.getGeometry();
  if (!geometry) {
    return null;
  }

  return new Rectangle(geometry.x ?? 0, geometry.y ?? 0, geometry.width ?? 0, geometry.height ?? 0);
};

export const createGeometry = (x: number, y: number, width: number, height: number): Geometry =>
  new Geometry(x, y, width, height);
