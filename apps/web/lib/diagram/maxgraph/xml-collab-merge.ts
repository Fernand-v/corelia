import type { DrawioDocument } from "@/lib/diagram/maxgraph/xml-format";
import { createEmptyGraphModelXml } from "@/lib/diagram/maxgraph/xml-format";

type MergePreference = "local" | "incoming";

type ParsedGraphModel = {
  openTag: string;
  cells: Map<string, string>;
};

const GRAPH_MODEL_OPEN_TAG_REGEX = /<mxGraphModel\b[^>]*>/i;
const ROOT_CONTENT_REGEX = /<root>([\s\S]*?)<\/root>/i;
const CELL_XML_REGEX = /<mxCell\b[^>]*\/>|<mxCell\b[\s\S]*?<\/mxCell>/gi;
const CELL_ID_REGEX = /\bid=(["'])([^"']+)\1/i;

const normalizeCellXmlForComparison = (xml: string): string =>
  xml.replace(/\s+/g, " ").trim();

const compareIds = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }

  if (left === "0") {
    return -1;
  }

  if (right === "0") {
    return 1;
  }

  if (left === "1") {
    return -1;
  }

  if (right === "1") {
    return 1;
  }

  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);
  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right);
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
};

const parseGraphModel = (xml: string): ParsedGraphModel => {
  const normalized = xml.trim();
  const fallback = createEmptyGraphModelXml();
  const openTag =
    normalized.match(GRAPH_MODEL_OPEN_TAG_REGEX)?.[0] ??
    fallback.match(GRAPH_MODEL_OPEN_TAG_REGEX)?.[0] ??
    "<mxGraphModel>";
  const rootContent =
    normalized.match(ROOT_CONTENT_REGEX)?.[1] ??
    fallback.match(ROOT_CONTENT_REGEX)?.[1] ??
    "";

  const cells = new Map<string, string>();
  CELL_XML_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = CELL_XML_REGEX.exec(rootContent);
  while (match) {
    const cellXml = match[0]?.trim();
    const id = cellXml?.match(CELL_ID_REGEX)?.[2];
    if (cellXml && id) {
      cells.set(id, cellXml);
    }
    match = CELL_XML_REGEX.exec(rootContent);
  }

  if (!cells.has("0") || !cells.has("1")) {
    const fallbackCells = parseGraphModel(fallback).cells;
    if (!cells.has("0")) {
      const rootCell = fallbackCells.get("0");
      if (rootCell) {
        cells.set("0", rootCell);
      }
    }
    if (!cells.has("1")) {
      const layerCell = fallbackCells.get("1");
      if (layerCell) {
        cells.set("1", layerCell);
      }
    }
  }

  return {
    openTag,
    cells
  };
};

const mergeGraphModelXml = (
  localXml: string,
  incomingXml: string,
  preference: MergePreference
): string => {
  const localModel = parseGraphModel(localXml);
  const incomingModel = parseGraphModel(incomingXml);
  const openTag = preference === "incoming" ? incomingModel.openTag : localModel.openTag;

  const allIds = new Set<string>([
    ...localModel.cells.keys(),
    ...incomingModel.cells.keys()
  ]);

  const mergedCells = Array.from(allIds)
    .sort(compareIds)
    .map((id) => {
      const localCell = localModel.cells.get(id);
      const incomingCell = incomingModel.cells.get(id);
      if (!localCell) {
        return incomingCell ?? "";
      }
      if (!incomingCell) {
        return localCell;
      }

      if (
        normalizeCellXmlForComparison(localCell) ===
        normalizeCellXmlForComparison(incomingCell)
      ) {
        return incomingCell;
      }

      return preference === "incoming" ? incomingCell : localCell;
    })
    .filter(Boolean);

  return `${openTag}<root>${mergedCells.join("")}</root></mxGraphModel>`;
};

const hasSamePageSet = (left: DrawioDocument, right: DrawioDocument): boolean => {
  if (left.pages.length !== right.pages.length) {
    return false;
  }

  const rightIds = new Set(right.pages.map((page) => page.id));
  return left.pages.every((page) => rightIds.has(page.id));
};

const mergePagePair = (
  localPage: DrawioDocument["pages"][number] | undefined,
  incomingPage: DrawioDocument["pages"][number] | undefined,
  preference: MergePreference,
  fallbackId: string
): DrawioDocument["pages"][number] | null => {
  if (!localPage && !incomingPage) {
    return null;
  }
  if (!localPage) {
    return incomingPage ?? null;
  }
  if (!incomingPage) {
    return localPage;
  }

  const preferredPage = preference === "incoming" ? incomingPage : localPage;
  const fallbackPage = preference === "incoming" ? localPage : incomingPage;
  return {
    id: preferredPage.id || fallbackPage.id || fallbackId,
    name: preference === "incoming" ? incomingPage.name : localPage.name,
    xml: mergeGraphModelXml(localPage.xml, incomingPage.xml, preference)
  };
};

export const mergeDrawioDocuments = (
  local: DrawioDocument,
  incoming: DrawioDocument,
  preference: MergePreference
): DrawioDocument => {
  const localById = new Map(local.pages.map((page) => [page.id, page]));
  const incomingById = new Map(incoming.pages.map((page) => [page.id, page]));
  const mergedPages: DrawioDocument["pages"] = [];

  if (hasSamePageSet(local, incoming)) {
    const orderedPageIds = incoming.pages.map((page) => page.id);
    orderedPageIds.forEach((pageId, index) => {
      const merged = mergePagePair(
        localById.get(pageId),
        incomingById.get(pageId),
        preference,
        `page-${index + 1}`
      );
      if (merged) {
        mergedPages.push(merged);
      }
    });
  } else if (local.pages.length === incoming.pages.length) {
    const total = local.pages.length;
    for (let index = 0; index < total; index += 1) {
      const merged = mergePagePair(
        local.pages[index],
        incoming.pages[index],
        preference,
        `page-${index + 1}`
      );
      if (merged) {
        mergedPages.push(merged);
      }
    }
  } else if (preference === "incoming") {
    incoming.pages.forEach((incomingPage, index) => {
      const localPage = localById.get(incomingPage.id) ?? local.pages[index];
      const merged = mergePagePair(localPage, incomingPage, preference, `page-${index + 1}`);
      if (merged) {
        mergedPages.push(merged);
      }
    });
  } else {
    const usedIncomingIds = new Set<string>();
    local.pages.forEach((localPage, index) => {
      const incomingPage = incomingById.get(localPage.id) ?? incoming.pages[index];
      if (incomingPage?.id) {
        usedIncomingIds.add(incomingPage.id);
      }

      const merged = mergePagePair(localPage, incomingPage, preference, `page-${index + 1}`);
      if (merged) {
        mergedPages.push(merged);
      }
    });

    incoming.pages.forEach((incomingPage) => {
      if (usedIncomingIds.has(incomingPage.id) || localById.has(incomingPage.id)) {
        return;
      }
      mergedPages.push(incomingPage);
    });
  }

  const preferred = preference === "incoming" ? incoming : local;
  const fallback = preference === "incoming" ? local : incoming;
  const preferredActiveId = preferred.activePageId;
  const activePageExists = mergedPages.some((page) => page.id === preferredActiveId);

  const merged: DrawioDocument = {
    activePageId: activePageExists ? preferredActiveId : (mergedPages[0]?.id ?? preferredActiveId),
    pages: mergedPages
  };

  const host = preferred.host ?? fallback.host;
  if (host) {
    merged.host = host;
  }

  const etag = preferred.etag ?? fallback.etag;
  if (etag) {
    merged.etag = etag;
  }

  const modified = preferred.modified ?? fallback.modified;
  if (modified) {
    merged.modified = modified;
  }

  return merged;
};
