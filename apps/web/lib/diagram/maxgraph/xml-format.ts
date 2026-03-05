import type { DiagramKind } from "@corelia/types";
import pako from "pako";

export type DiagramInputKind = "mxfile" | "mxgraphmodel" | "reactflow-json" | "unknown";

export type DrawioPage = {
  id: string;
  name: string;
  xml: string;
};

export type DrawioDocument = {
  etag?: string;
  host?: string;
  modified?: string;
  activePageId: string;
  pages: DrawioPage[];
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

const nowIso = () => new Date().toISOString();

const randomId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const unescapeXml = (value: string): string =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");

const normalizeGraphModelXml = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.includes("<mxGraphModel")) {
    return trimmed;
  }

  return createEmptyGraphModelXml();
};

const decodeBase64Binary = (input: string): Uint8Array => {
  const decodeFn = (globalThis as { atob?: (value: string) => string }).atob;
  if (typeof decodeFn !== "function") {
    return new Uint8Array();
  }

  const binary = decodeFn(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const decodeMaybeCompressedDiagram = (raw: string): string => {
  const trimmed = raw.trim();

  if (trimmed.startsWith("<mxGraphModel")) {
    return trimmed;
  }

  try {
    const bytes = decodeBase64Binary(trimmed);
    const inflated = pako.inflateRaw(bytes, { to: "string" }) as string;
    const decoded = decodeURIComponent(inflated);
    if (decoded.includes("<mxGraphModel")) {
      return decoded;
    }
  } catch {
    // noop: fallback below
  }

  return createEmptyGraphModelXml();
};

const parseAttributes = (source: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const matcher = /(\w+)="([^"]*)"/g;
  let current: RegExpExecArray | null = matcher.exec(source);

  while (current) {
    const key = current[1];
    const value = current[2];

    if (key && value !== undefined) {
      attributes[key] = unescapeXml(value);
    }

    current = matcher.exec(source);
  }

  return attributes;
};

export const createEmptyGraphModelXml = (): string =>
  '<mxGraphModel dx="1280" dy="720" grid="1" gridSize="16" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

const defaultPageNameByKind: Record<DiagramKind, string> = {
  FLUJO: "Flujo",
  SECUENCIA: "Secuencia",
  UML_CLASES: "Clases UML",
  ENTIDAD_RELACION: "ER",
  ESTADO: "Estados",
  ARQUITECTURA: "Arquitectura C4",
  BPMN: "BPMN"
};

export const createEmptyDrawioDocument = (kind: DiagramKind): DrawioDocument => {
  const pageId = randomId("page");

  return {
    etag: randomId("etag"),
    host: "corelia",
    modified: nowIso(),
    activePageId: pageId,
    pages: [
      {
        id: pageId,
        name: defaultPageNameByKind[kind],
        xml: createEmptyGraphModelXml()
      }
    ]
  };
};

export const detectDiagramInputKind = (raw: string): DiagramInputKind => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "unknown";
  }

  const normalized = trimmed.replace(/^<\?xml[^>]*\?>\s*/i, "");

  if (normalized.startsWith("<mxfile")) {
    return "mxfile";
  }

  if (normalized.startsWith("<mxGraphModel")) {
    return "mxgraphmodel";
  }

  if (normalized.startsWith("{") || normalized.startsWith("[")) {
    return "reactflow-json";
  }

  return "unknown";
};

export const parseMxfile = (xml: string): DrawioDocument => {
  const trimmed = xml.trim();

  const mxfileOpenMatch = trimmed.match(/<mxfile([^>]*)>/i);
  const rootAttributes = parseAttributes(mxfileOpenMatch?.[1] ?? "");

  const pages: DrawioPage[] = [];
  const diagramMatcher = /<diagram([^>]*)>([\s\S]*?)<\/diagram>/gi;
  let current: RegExpExecArray | null = diagramMatcher.exec(trimmed);

  while (current) {
    const attrs = parseAttributes(current[1] ?? "");
    const rawBody = current[2] ?? "";
    const xmlBody = decodeMaybeCompressedDiagram(rawBody);

    const id = attrs.id ?? randomId("page");
    const name = attrs.name ?? `Página ${pages.length + 1}`;

    pages.push({
      id,
      name,
      xml: normalizeGraphModelXml(xmlBody)
    });

    current = diagramMatcher.exec(trimmed);
  }

  const fallbackDoc = createEmptyDrawioDocument("FLUJO");
  if (pages.length === 0) {
    return fallbackDoc;
  }

  const activePageId = pages[0]?.id ?? fallbackDoc.activePageId;

  const parsed: DrawioDocument = {
    activePageId,
    pages
  };

  if (rootAttributes.etag) {
    parsed.etag = rootAttributes.etag;
  }
  if (rootAttributes.host) {
    parsed.host = rootAttributes.host;
  }
  if (rootAttributes.modified) {
    parsed.modified = rootAttributes.modified;
  }

  return parsed;
};

export const serializeMxfile = (document: DrawioDocument): string => {
  const pages = document.pages.length > 0 ? document.pages : createEmptyDrawioDocument("FLUJO").pages;

  const modified = document.modified ?? nowIso();
  const etag = document.etag ?? randomId("etag");
  const host = document.host ?? "corelia";

  const diagrams = pages
    .map((page) => {
      const id = escapeXml(page.id);
      const name = escapeXml(page.name);
      const body = normalizeGraphModelXml(page.xml);

      return `<diagram id="${id}" name="${name}">${body}</diagram>`;
    })
    .join("");

  return `${XML_HEADER}<mxfile host="${escapeXml(host)}" modified="${escapeXml(modified)}" etag="${escapeXml(etag)}" type="device">${diagrams}</mxfile>`;
};

export const wrapGraphModelAsMxfile = (
  graphModelXml: string,
  kind: DiagramKind,
  pageName?: string
): DrawioDocument => {
  const pageId = randomId("page");

  return {
    etag: randomId("etag"),
    host: "corelia",
    modified: nowIso(),
    activePageId: pageId,
    pages: [
      {
        id: pageId,
        name: pageName ?? defaultPageNameByKind[kind],
        xml: normalizeGraphModelXml(graphModelXml)
      }
    ]
  };
};

export const ensureDocumentIntegrity = (document: DrawioDocument, fallbackKind: DiagramKind): DrawioDocument => {
  if (document.pages.length === 0) {
    return createEmptyDrawioDocument(fallbackKind);
  }

  const activeExists = document.pages.some((page) => page.id === document.activePageId);
  const activePageId = activeExists
    ? document.activePageId
    : (document.pages[0]?.id ?? createEmptyDrawioDocument(fallbackKind).activePageId);

  return {
    ...document,
    activePageId,
    pages: document.pages.map((page) => ({
      ...page,
      xml: normalizeGraphModelXml(page.xml)
    }))
  };
};
