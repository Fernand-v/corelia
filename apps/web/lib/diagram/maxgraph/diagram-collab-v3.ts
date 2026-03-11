import * as Y from "yjs";
import type { DiagramKind } from "@corelia/types";

import {
  createEmptyDrawioDocument,
  createEmptyGraphModelXml,
  ensureDocumentIntegrity,
  escapeXml,
  type DrawioDocument
} from "@/lib/diagram/maxgraph/xml-format";

export const DIAGRAM_V3_SCHEMA_VERSION = 3;
export const DIAGRAM_V3_LOCAL_ORIGIN = "diagram:v3:local";
export const DIAGRAM_V3_MIGRATION_ORIGIN = "diagram:v3:migration";

const GRAPH_MODEL_OPEN_TAG_REGEX = /<mxGraphModel\b[^>]*>/i;
const ROOT_CONTENT_REGEX = /<root>([\s\S]*?)<\/root>/i;
const CELL_XML_REGEX = /<mxCell\b[^>]*\/>|<mxCell\b[\s\S]*?<\/mxCell>/gi;
const CELL_ID_REGEX = /\bid=(["'])([^"']+)\1/i;
const CELL_START_TAG_ATTRS_REGEX = /<mxCell\b([^>]*)>/i;
const GEOMETRY_TAG_ATTRS_REGEX = /<mxGeometry\b([^>]*)\/>|<mxGeometry\b([^>]*)>[\s\S]*?<\/mxGeometry>/i;
const ATTR_REGEX = /([A-Za-z0-9_:-]+)=("([^"]*)"|'([^']*)')/g;

type DiagramCollabMeta = {
  actorId?: string;
  operation?: string;
  origin?: unknown;
  timestamp?: number;
};

export type DiagramGeometryV3 = {
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  relative?: boolean | undefined;
};

export type DiagramCellV3 = {
  id: string;
  kind: "vertex" | "edge";
  parentId?: string | undefined;
  sourceId?: string | undefined;
  targetId?: string | undefined;
  value?: string | undefined;
  style?: string | undefined;
  geometry?: DiagramGeometryV3 | undefined;
  zIndex: number;
  rawXml: string;
  updatedAt: number;
  updatedBy?: string | undefined;
};

export type DiagramPageV3 = {
  id: string;
  name: string;
  openTag: string;
  cellOrder: string[];
  cells: Record<string, DiagramCellV3>;
};

export type DiagramDocumentV3 = {
  schemaVersion: number;
  activePageId: string;
  pagesOrder: string[];
  pages: Record<string, DiagramPageV3>;
  revision: number;
  lastLocalOp?: string | undefined;
};

const decodeXml = (value: string): string =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");

const parseAttributes = (source: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  ATTR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = ATTR_REGEX.exec(source);
  while (match) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? "";
    if (key) {
      attrs[key] = decodeXml(value);
    }
    match = ATTR_REGEX.exec(source);
  }
  return attrs;
};

const toFiniteNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getOpenTag = (xml: string): string => {
  return (
    xml.trim().match(GRAPH_MODEL_OPEN_TAG_REGEX)?.[0] ??
    createEmptyGraphModelXml().match(GRAPH_MODEL_OPEN_TAG_REGEX)?.[0] ??
    "<mxGraphModel>"
  );
};

const parseGraphModelXml = (
  pageId: string,
  pageName: string,
  xml: string,
  meta?: DiagramCollabMeta
): DiagramPageV3 => {
  const normalized = xml.trim();
  const openTag = getOpenTag(normalized);
  const rootContent = normalized.match(ROOT_CONTENT_REGEX)?.[1] ?? "";
  const now = meta?.timestamp ?? Date.now();

  const cells: Record<string, DiagramCellV3> = {};
  const cellOrder: string[] = [];

  CELL_XML_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = CELL_XML_REGEX.exec(rootContent);
  let zIndex = 0;
  while (match) {
    const rawCellXml = match[0]?.trim();
    if (!rawCellXml) {
      match = CELL_XML_REGEX.exec(rootContent);
      continue;
    }

    const id = rawCellXml.match(CELL_ID_REGEX)?.[2];
    if (!id) {
      match = CELL_XML_REGEX.exec(rootContent);
      continue;
    }

    const startTagAttrs = parseAttributes(rawCellXml.match(CELL_START_TAG_ATTRS_REGEX)?.[1] ?? "");
    const geometryAttrs = parseAttributes(
      rawCellXml.match(GEOMETRY_TAG_ATTRS_REGEX)?.[1] ??
      rawCellXml.match(GEOMETRY_TAG_ATTRS_REGEX)?.[2] ??
      ""
    );

    const geometry: DiagramGeometryV3 = {
      x: toFiniteNumber(geometryAttrs.x ?? geometryAttrs._x),
      y: toFiniteNumber(geometryAttrs.y ?? geometryAttrs._y),
      width: toFiniteNumber(geometryAttrs.width ?? geometryAttrs._width),
      height: toFiniteNumber(geometryAttrs.height ?? geometryAttrs._height),
      relative: geometryAttrs.relative === "1"
    };

    const hasGeometryValues =
      geometry.x !== undefined ||
      geometry.y !== undefined ||
      geometry.width !== undefined ||
      geometry.height !== undefined ||
      geometry.relative === true;

    // Extract style from inline attribute or <Object as="style" .../> child element
    let cellStyle = startTagAttrs.style;
    if (!cellStyle) {
      const styleObjMatch = rawCellXml.match(/<Object\b([^>]*?)\bas="style"([^>]*?)\s*\/>/i);
      if (styleObjMatch) {
        const objAttrs = `${styleObjMatch[1] ?? ""} ${styleObjMatch[2] ?? ""}`.trim();
        const stylePairs: string[] = [];
        ATTR_REGEX.lastIndex = 0;
        let sm: RegExpExecArray | null = ATTR_REGEX.exec(objAttrs);
        while (sm) {
          const key = sm[1];
          const val = sm[3] ?? sm[4] ?? "";
          if (key && key !== "as") {
            stylePairs.push(`${key}=${val}`);
          }
          sm = ATTR_REGEX.exec(objAttrs);
        }
        if (stylePairs.length > 0) {
          cellStyle = stylePairs.join(";");
        }
      }
    }

    cells[id] = {
      id,
      kind: startTagAttrs.edge === "1" ? "edge" : "vertex",
      parentId: startTagAttrs.parent,
      sourceId: startTagAttrs.source,
      targetId: startTagAttrs.target,
      value: startTagAttrs.value,
      style: cellStyle,
      geometry: hasGeometryValues ? geometry : undefined,
      zIndex,
      rawXml: rawCellXml,
      updatedAt: now,
      updatedBy: meta?.actorId
    };

    cellOrder.push(id);
    zIndex += 1;
    match = CELL_XML_REGEX.exec(rootContent);
  }

  if (!cells["0"]) {
    cells["0"] = {
      id: "0",
      kind: "vertex",
      zIndex: 0,
      rawXml: '<mxCell id="0"/>',
      updatedAt: now,
      updatedBy: meta?.actorId
    };
    cellOrder.unshift("0");
  }
  if (!cells["1"]) {
    cells["1"] = {
      id: "1",
      kind: "vertex",
      parentId: "0",
      zIndex: 1,
      rawXml: '<mxCell id="1" parent="0"/>',
      updatedAt: now,
      updatedBy: meta?.actorId
    };
    if (!cellOrder.includes("1")) {
      cellOrder.splice(Math.min(1, cellOrder.length), 0, "1");
    }
  }

  return {
    id: pageId,
    name: pageName,
    openTag,
    cellOrder,
    cells
  };
};

const getOrCreateMap = <T = unknown>(parent: Y.Map<unknown>, key: string): Y.Map<T> => {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) {
    return existing as Y.Map<T>;
  }
  const created = new Y.Map<T>();
  parent.set(key, created);
  return created;
};

const getOrCreateArray = <T>(parent: Y.Map<unknown>, key: string): Y.Array<T> => {
  const existing = parent.get(key);
  if (existing instanceof Y.Array) {
    return existing as Y.Array<T>;
  }
  const created = new Y.Array<T>();
  parent.set(key, created);
  return created;
};

const replaceYArray = <T>(array: Y.Array<T>, nextValues: T[]) => {
  if (array.length > 0) {
    array.delete(0, array.length);
  }
  if (nextValues.length > 0) {
    array.insert(0, nextValues);
  }
};

const setMapField = (map: Y.Map<unknown>, key: string, value: unknown) => {
  if (value === undefined || value === null) {
    map.delete(key);
    return;
  }
  map.set(key, value);
};

const upsertCellInYMap = (cellsMap: Y.Map<unknown>, cell: DiagramCellV3) => {
  const cellMap = getOrCreateMap(cellsMap, cell.id);
  setMapField(cellMap, "id", cell.id);
  setMapField(cellMap, "kind", cell.kind);
  setMapField(cellMap, "parentId", cell.parentId);
  setMapField(cellMap, "sourceId", cell.sourceId);
  setMapField(cellMap, "targetId", cell.targetId);
  setMapField(cellMap, "value", cell.value ?? "");
  setMapField(cellMap, "style", cell.style ?? "");
  setMapField(cellMap, "geometry", cell.geometry ?? null);
  setMapField(cellMap, "zIndex", cell.zIndex);
  setMapField(cellMap, "rawXml", cell.rawXml);
  setMapField(cellMap, "updatedAt", cell.updatedAt);
  setMapField(cellMap, "updatedBy", cell.updatedBy);
};

const upsertPageInYMap = (pagesMap: Y.Map<unknown>, page: DiagramPageV3) => {
  const pageMap = getOrCreateMap(pagesMap, page.id);
  setMapField(pageMap, "id", page.id);
  setMapField(pageMap, "name", page.name);
  setMapField(pageMap, "openTag", page.openTag);
  const cellOrderArray = getOrCreateArray<string>(pageMap, "cellOrder");
  replaceYArray(cellOrderArray, page.cellOrder);

  const cellsMap = getOrCreateMap(pageMap, "cells");
  const incomingIds = new Set(page.cellOrder);

  for (const cellId of Array.from(cellsMap.keys())) {
    if (!incomingIds.has(cellId)) {
      cellsMap.delete(cellId);
    }
  }

  page.cellOrder.forEach((cellId, index) => {
    const cell = page.cells[cellId];
    if (!cell) {
      return;
    }
    upsertCellInYMap(cellsMap, {
      ...cell,
      zIndex: index
    });
  });
};

const runTransaction = (rootMap: Y.Map<unknown>, meta: DiagramCollabMeta | undefined, fn: () => void) => {
  const doc = rootMap.doc;
  const origin = meta?.origin ?? DIAGRAM_V3_LOCAL_ORIGIN;
  if (!doc) {
    fn();
    return;
  }
  doc.transact(fn, origin);
};

const bumpRevision = (rootMap: Y.Map<unknown>, meta?: DiagramCollabMeta) => {
  const currentRevision = Number(rootMap.get("revision") ?? 0);
  const nextRevision = Number.isFinite(currentRevision) ? currentRevision + 1 : 1;
  rootMap.set("revision", nextRevision);

  if (meta?.operation) {
    rootMap.set("lastLocalOp", meta.operation);
  }
  rootMap.set("updatedAt", meta?.timestamp ?? Date.now());
};

const ensureRootSkeleton = (rootMap: Y.Map<unknown>) => {
  rootMap.set("schemaVersion", DIAGRAM_V3_SCHEMA_VERSION);
  getOrCreateArray<string>(rootMap, "pagesOrder");
  getOrCreateMap(rootMap, "pages");
  if (!rootMap.has("revision")) {
    rootMap.set("revision", 0);
  }
};

export const hasDiagramV3Data = (rootMap: Y.Map<unknown>): boolean => {
  const schemaVersion = Number(rootMap.get("schemaVersion") ?? 0);
  const pagesOrder = rootMap.get("pagesOrder");
  const pages = rootMap.get("pages");
  return (
    schemaVersion === DIAGRAM_V3_SCHEMA_VERSION &&
    pagesOrder instanceof Y.Array &&
    pages instanceof Y.Map &&
    pagesOrder.length > 0
  );
};

export const writeDrawioDocumentToDiagramV3 = (
  rootMap: Y.Map<unknown>,
  document: DrawioDocument,
  meta?: DiagramCollabMeta
) => {
  runTransaction(rootMap, meta, () => {
    ensureRootSkeleton(rootMap);
    setMapField(rootMap, "activePageId", document.activePageId);
    setMapField(rootMap, "host", document.host ?? "corelia");
    setMapField(rootMap, "etag", document.etag);
    setMapField(rootMap, "modified", document.modified);

    const pagesOrder = getOrCreateArray<string>(rootMap, "pagesOrder");
    const nextOrder = document.pages.map((page) => page.id);
    replaceYArray(pagesOrder, nextOrder);

    const pagesMap = getOrCreateMap(rootMap, "pages");
    const incomingPageIds = new Set(nextOrder);

    for (const existingPageId of Array.from(pagesMap.keys())) {
      if (!incomingPageIds.has(existingPageId)) {
        pagesMap.delete(existingPageId);
      }
    }

    document.pages.forEach((page) => {
      const parsedPage = parseGraphModelXml(page.id, page.name, page.xml, meta);
      upsertPageInYMap(pagesMap, parsedPage);
    });

    bumpRevision(rootMap, meta);
  });
};

export const applyGraphModelXmlToDiagramV3Page = (
  rootMap: Y.Map<unknown>,
  input: {
    pageId: string;
    pageName: string;
    xml: string;
    setActive?: boolean;
    preserveMissing?: boolean;
    removedCellIds?: string[];
  },
  meta?: DiagramCollabMeta
) => {
  runTransaction(rootMap, meta, () => {
    ensureRootSkeleton(rootMap);
    const pagesOrder = getOrCreateArray<string>(rootMap, "pagesOrder");
    const pagesMap = getOrCreateMap(rootMap, "pages");

    if (!pagesOrder.toArray().includes(input.pageId)) {
      pagesOrder.push([input.pageId]);
    }

    const parsedPage = parseGraphModelXml(input.pageId, input.pageName, input.xml, meta);
    const currentPageValue = pagesMap.get(input.pageId);
    if (input.preserveMissing && currentPageValue instanceof Y.Map) {
      const currentPage = readPageFromYMap(input.pageId, currentPageValue);
      const removedIds = new Set(input.removedCellIds ?? []);
      const mergedCells: Record<string, DiagramCellV3> = {};

      // 1. Seed from currentPage so edges and vertices not in parsedPage are kept
      currentPage.cellOrder.forEach((cellId) => {
        if (removedIds.has(cellId)) {
          return;
        }
        const cell = currentPage.cells[cellId];
        if (!cell) {
          return;
        }
        mergedCells[cellId] = cell;
      });

      // 2. Overwrite/add cells from parsedPage (local graph state wins for
      //    cells it knows about).
      parsedPage.cellOrder.forEach((cellId) => {
        if (removedIds.has(cellId)) {
          return;
        }
        const cell = parsedPage.cells[cellId];
        if (!cell) {
          return;
        }
        mergedCells[cellId] = cell;
      });

      // 3. Safety pass: ensure edges whose source/target vertices were removed
      //    are also removed, and edges whose source/target exist are preserved
      //    even if they ended up outside both cellOrders.
      const parsedOrderSet = new Set(parsedPage.cellOrder);
      const currentOrderSet = new Set(currentPage.cellOrder);
      const edgesToRemove: string[] = [];
      for (const [cellId, cell] of Object.entries(mergedCells)) {
        if (cell.kind !== "edge" || cellId === "0" || cellId === "1") continue;
        const srcOk = !cell.sourceId || (mergedCells[cell.sourceId] && !removedIds.has(cell.sourceId));
        const tgtOk = !cell.targetId || (mergedCells[cell.targetId] && !removedIds.has(cell.targetId));
        if (!srcOk || !tgtOk) {
          edgesToRemove.push(cellId);
        }
      }
      for (const id of edgesToRemove) {
        delete mergedCells[id];
      }

      const mergedOrder = parsedPage.cellOrder
        .filter((cellId) => !removedIds.has(cellId))
        .concat(
          currentPage.cellOrder.filter(
            (cellId) => !removedIds.has(cellId) && !parsedOrderSet.has(cellId)
          )
        );
      const normalizedOrder = normalizeCellOrder(mergedOrder, mergedCells);
      const normalizedCells: Record<string, DiagramCellV3> = {};
      normalizedOrder.forEach((cellId, index) => {
        const cell = mergedCells[cellId];
        if (!cell) {
          return;
        }
        normalizedCells[cellId] = {
          ...cell,
          zIndex: index
        };
      });

      upsertPageInYMap(pagesMap, {
        id: parsedPage.id,
        name: parsedPage.name,
        openTag: parsedPage.openTag,
        cellOrder: normalizedOrder,
        cells: normalizedCells
      });
    } else {
      upsertPageInYMap(pagesMap, parsedPage);
    }

    if (input.setActive !== false) {
      setMapField(rootMap, "activePageId", input.pageId);
    }

    bumpRevision(rootMap, meta);
  });
};

const toStringOr = (value: unknown, fallback: string): string => {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
};

const normalizeCellOrder = (cellOrder: string[], cellsById: Record<string, DiagramCellV3>): string[] => {
  const order = [...cellOrder];
  if (!order.includes("0")) {
    order.unshift("0");
  }
  if (!order.includes("1")) {
    order.splice(Math.min(1, order.length), 0, "1");
  }

  // Ensure every cell in cellsById appears in the order (edges that only
  // exist in the Y.js state but were missing from both cellOrders).
  const seen = new Set(order);
  Object.keys(cellsById).forEach((id) => {
    if (!seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  });

  // Deduplicate while keeping insertion order, and drop IDs that have no
  // cell data.  Use a Set for O(1) deduplication instead of indexOf.
  const dedup = new Set<string>();
  return order.filter((id) => {
    if (dedup.has(id)) return false;
    dedup.add(id);
    return Boolean(cellsById[id]);
  });
};

const buildFallbackCellXml = (cell: DiagramCellV3): string => {
  if (cell.id === "0") {
    return '<mxCell id="0"/>';
  }
  if (cell.id === "1") {
    return '<mxCell id="1" parent="0"/>';
  }

  const attrs: string[] = [`id="${escapeXml(cell.id)}"`];
  if (cell.parentId) {
    attrs.push(`parent="${escapeXml(cell.parentId)}"`);
  }
  if (cell.kind === "edge") {
    attrs.push('edge="1"');
  } else {
    attrs.push('vertex="1"');
  }
  if (cell.sourceId) {
    attrs.push(`source="${escapeXml(cell.sourceId)}"`);
  }
  if (cell.targetId) {
    attrs.push(`target="${escapeXml(cell.targetId)}"`);
  }
  if (cell.value) {
    attrs.push(`value="${escapeXml(cell.value)}"`);
  }
  if (cell.style) {
    attrs.push(`style="${escapeXml(cell.style)}"`);
  }

  const geometry = cell.geometry;
  const geometryAttrs: string[] = [];
  if (geometry?.x !== undefined) {
    geometryAttrs.push(`x="${geometry.x}"`);
  }
  if (geometry?.y !== undefined) {
    geometryAttrs.push(`y="${geometry.y}"`);
  }
  if (geometry?.width !== undefined) {
    geometryAttrs.push(`width="${geometry.width}"`);
  }
  if (geometry?.height !== undefined) {
    geometryAttrs.push(`height="${geometry.height}"`);
  }
  if (geometry?.relative) {
    geometryAttrs.push('relative="1"');
  }
  geometryAttrs.push('as="geometry"');

  return `<mxCell ${attrs.join(" ")}><mxGeometry ${geometryAttrs.join(" ")}/></mxCell>`;
};

const pageToGraphModelXml = (page: DiagramPageV3): string => {
  const openTag = page.openTag?.includes("<mxGraphModel")
    ? page.openTag
    : getOpenTag(createEmptyGraphModelXml());
  const order = normalizeCellOrder(page.cellOrder, page.cells);
  const body = order
    .map((cellId) => {
      const cell = page.cells[cellId];
      if (!cell) {
        return "";
      }
      const raw = typeof cell.rawXml === "string" ? cell.rawXml.trim() : "";
      if (raw.includes("<mxCell")) {
        return raw;
      }
      return buildFallbackCellXml(cell);
    })
    .filter(Boolean)
    .join("");

  return `${openTag}<root>${body}</root></mxGraphModel>`;
};

const readCellFromYMap = (cellId: string, cellMap: Y.Map<unknown>, zIndex: number): DiagramCellV3 => {
  const geometryValue = cellMap.get("geometry");
  const geometry =
    geometryValue && typeof geometryValue === "object"
      ? {
          x: toFiniteNumber(String((geometryValue as Record<string, unknown>).x ?? "")),
          y: toFiniteNumber(String((geometryValue as Record<string, unknown>).y ?? "")),
          width: toFiniteNumber(String((geometryValue as Record<string, unknown>).width ?? "")),
          height: toFiniteNumber(String((geometryValue as Record<string, unknown>).height ?? "")),
          relative: (geometryValue as Record<string, unknown>).relative === true
        }
      : undefined;

  return {
    id: toStringOr(cellMap.get("id"), cellId),
    kind: cellMap.get("kind") === "edge" ? "edge" : "vertex",
    parentId: typeof cellMap.get("parentId") === "string" ? (cellMap.get("parentId") as string) : undefined,
    sourceId: typeof cellMap.get("sourceId") === "string" ? (cellMap.get("sourceId") as string) : undefined,
    targetId: typeof cellMap.get("targetId") === "string" ? (cellMap.get("targetId") as string) : undefined,
    value: typeof cellMap.get("value") === "string" ? (cellMap.get("value") as string) : undefined,
    style: typeof cellMap.get("style") === "string" ? (cellMap.get("style") as string) : undefined,
    geometry,
    zIndex: Number(cellMap.get("zIndex") ?? zIndex),
    rawXml: toStringOr(cellMap.get("rawXml"), ""),
    updatedAt: Number(cellMap.get("updatedAt") ?? Date.now()),
    updatedBy: typeof cellMap.get("updatedBy") === "string" ? (cellMap.get("updatedBy") as string) : undefined
  };
};

const readPageFromYMap = (pageId: string, pageMap: Y.Map<unknown>): DiagramPageV3 => {
  const id = toStringOr(pageMap.get("id"), pageId);
  const name = toStringOr(pageMap.get("name"), `Página ${id.slice(0, 6)}`);
  const openTag = toStringOr(pageMap.get("openTag"), getOpenTag(createEmptyGraphModelXml()));

  const cellOrderArray = pageMap.get("cellOrder");
  const cellsMapValue = pageMap.get("cells");
  const cellOrder = cellOrderArray instanceof Y.Array ? cellOrderArray.toArray() : [];
  const cellsMap = cellsMapValue instanceof Y.Map ? cellsMapValue : new Y.Map<unknown>();
  const cells: Record<string, DiagramCellV3> = {};

  const orderedIds = cellOrder.length > 0 ? cellOrder : Array.from(cellsMap.keys());
  orderedIds.forEach((cellId, index) => {
    const rawCellMap = cellsMap.get(cellId);
    if (!(rawCellMap instanceof Y.Map)) {
      return;
    }
    cells[cellId] = readCellFromYMap(cellId, rawCellMap, index);
  });

  // Include cells that may exist in map but are missing in order list.
  Array.from(cellsMap.keys()).forEach((cellId, index) => {
    if (cells[cellId]) {
      return;
    }
    const rawCellMap = cellsMap.get(cellId);
    if (!(rawCellMap instanceof Y.Map)) {
      return;
    }
    cells[cellId] = readCellFromYMap(cellId, rawCellMap, index);
  });

  const normalizedOrder = normalizeCellOrder(orderedIds, cells);

  return {
    id,
    name,
    openTag,
    cellOrder: normalizedOrder,
    cells
  };
};

export const readDiagramDocumentV3 = (rootMap: Y.Map<unknown>): DiagramDocumentV3 | null => {
  if (!hasDiagramV3Data(rootMap)) {
    return null;
  }

  const pagesOrderArray = rootMap.get("pagesOrder");
  const pagesMapValue = rootMap.get("pages");
  if (!(pagesOrderArray instanceof Y.Array) || !(pagesMapValue instanceof Y.Map)) {
    return null;
  }

  const pagesOrder = pagesOrderArray.toArray();
  const pages: Record<string, DiagramPageV3> = {};

  pagesOrder.forEach((pageId) => {
    const pageValue = pagesMapValue.get(pageId);
    if (!(pageValue instanceof Y.Map)) {
      return;
    }
    pages[pageId] = readPageFromYMap(pageId, pageValue);
  });

  // Include stray pages that are present in the map but absent in order.
  Array.from(pagesMapValue.keys()).forEach((pageId) => {
    if (pages[pageId]) {
      return;
    }
    const pageValue = pagesMapValue.get(pageId);
    if (!(pageValue instanceof Y.Map)) {
      return;
    }
    pages[pageId] = readPageFromYMap(pageId, pageValue);
    pagesOrder.push(pageId);
  });

  const activePageId = toStringOr(rootMap.get("activePageId"), pagesOrder[0] ?? "");

  const lastLocalOp = typeof rootMap.get("lastLocalOp") === "string"
    ? (rootMap.get("lastLocalOp") as string)
    : undefined;

  const result: DiagramDocumentV3 = {
    schemaVersion: Number(rootMap.get("schemaVersion") ?? 0),
    activePageId,
    pagesOrder,
    pages,
    revision: Number(rootMap.get("revision") ?? 0)
  };
  if (lastLocalOp) {
    result.lastLocalOp = lastLocalOp;
  }

  return result;
};

export const exportDiagramV3ToDrawioDocument = (
  rootMap: Y.Map<unknown>,
  fallbackKind: DiagramKind
): DrawioDocument => {
  const v3 = readDiagramDocumentV3(rootMap);
  if (!v3) {
    return createEmptyDrawioDocument(fallbackKind);
  }

  const pages = v3.pagesOrder
    .map((pageId) => v3.pages[pageId])
    .filter((page): page is DiagramPageV3 => Boolean(page))
    .map((page) => ({
      id: page.id,
      name: page.name,
      xml: pageToGraphModelXml(page)
    }));

  if (pages.length === 0) {
    return createEmptyDrawioDocument(fallbackKind);
  }

  const activeExists = pages.some((page) => page.id === v3.activePageId);
  const activePageId = activeExists ? v3.activePageId : (pages[0]?.id ?? v3.activePageId);
  const host = typeof rootMap.get("host") === "string" ? (rootMap.get("host") as string) : "corelia";
  const etag = typeof rootMap.get("etag") === "string" ? (rootMap.get("etag") as string) : undefined;
  const modified = typeof rootMap.get("modified") === "string"
    ? (rootMap.get("modified") as string)
    : new Date().toISOString();

  const nextDocument: DrawioDocument = {
    host,
    modified,
    activePageId,
    pages
  };
  if (etag) {
    nextDocument.etag = etag;
  }

  return ensureDocumentIntegrity(nextDocument, fallbackKind);
};

export const getDiagramV3Diagnostics = (rootMap: Y.Map<unknown>): {
  schemaVersion: number;
  revision: number;
  lastLocalOp?: string | undefined;
  pageCount: number;
} => {
  const v3 = readDiagramDocumentV3(rootMap);
  const lastLocalOp = typeof rootMap.get("lastLocalOp") === "string"
    ? (rootMap.get("lastLocalOp") as string)
    : undefined;
  const diagnostics: {
    schemaVersion: number;
    revision: number;
    lastLocalOp?: string | undefined;
    pageCount: number;
  } = {
    schemaVersion: Number(rootMap.get("schemaVersion") ?? 0),
    revision: Number(rootMap.get("revision") ?? 0),
    pageCount: v3 ? v3.pagesOrder.length : 0
  };
  if (lastLocalOp) {
    diagnostics.lastLocalOp = lastLocalOp;
  }
  return diagnostics;
};
