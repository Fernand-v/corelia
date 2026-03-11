import type { DiagramKind } from "@corelia/types";
import type { AbstractGraph } from "@maxgraph/core";
import { ModelXmlSerializer } from "@maxgraph/core";

import {
  createEmptyDrawioDocument,
  detectDiagramInputKind,
  ensureDocumentIntegrity,
  normalizeMaxGraphAttributes,
  parseMxfile,
  serializeMxfile,
  wrapGraphModelAsMxfile,
  type DrawioDocument
} from "@/lib/diagram/maxgraph/xml-format";
import { migrateLegacyReactFlowPayload } from "@/lib/diagram/maxgraph/xml-migration";

export type ParsedDiagramSource = {
  document: DrawioDocument;
  migratedFromLegacy: boolean;
};

export const parseDiagramSource = (raw: string, fallbackKind: DiagramKind): ParsedDiagramSource => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      document: createEmptyDrawioDocument(fallbackKind),
      migratedFromLegacy: false
    };
  }

  const inputKind = detectDiagramInputKind(trimmed);
  if (inputKind === "mxfile") {
    return {
      document: ensureDocumentIntegrity(parseMxfile(trimmed), fallbackKind),
      migratedFromLegacy: false
    };
  }

  if (inputKind === "mxgraphmodel") {
    return {
      document: wrapGraphModelAsMxfile(trimmed, fallbackKind),
      migratedFromLegacy: false
    };
  }

  if (inputKind === "reactflow-json") {
    return migrateLegacyReactFlowPayload(trimmed, fallbackKind);
  }

  return {
    document: createEmptyDrawioDocument(fallbackKind),
    migratedFromLegacy: false
  };
};

/**
 * maxGraph (v0.10+) exports XML with its own tag names (GraphDataModel, Cell,
 * Geometry, Point) instead of the classic mxGraph names (mxGraphModel, mxCell,
 * mxGeometry, mxPoint).  All downstream XML processing (regex-based parsers in
 * xml-format.ts & diagram-collab-v3.ts) expects the classic mxGraph names, so
 * we normalise the output here.
 */
const toMxGraphXml = (xml: string): string => {
  const tagConverted = xml
    .replace(/<GraphDataModel\b/g, "<mxGraphModel")
    .replace(/<\/GraphDataModel>/g, "</mxGraphModel>")
    .replace(/<Cell\b/g, "<mxCell")
    .replace(/<\/Cell>/g, "</mxCell>")
    .replace(/<Geometry\b/g, "<mxGeometry")
    .replace(/<\/Geometry>/g, "</mxGeometry>")
    .replace(/<Point\b/g, "<mxPoint")
    .replace(/<\/Point>/g, "</mxPoint>");
  return normalizeMaxGraphAttributes(tagConverted);
};

export const exportGraphModelXml = (graph: AbstractGraph): string => {
  const serializer = new ModelXmlSerializer(graph.getDataModel());
  const raw = serializer.export({ pretty: true });
  return toMxGraphXml(raw);
};

export const importGraphModelXml = (graph: AbstractGraph, xml: string): void => {
  const parent = graph.getDefaultParent();
  graph.batchUpdate(() => {
    const existing = graph.getChildCells(parent, true, true);
    if (existing.length > 0) {
      const model = graph.getDataModel();
      existing.forEach((cell) => model.remove(cell));
    }
    const serializer = new ModelXmlSerializer(graph.getDataModel());
    serializer.import(xml);
  });
};

export const serializeDrawioDocument = (document: DrawioDocument): string => serializeMxfile(document);
