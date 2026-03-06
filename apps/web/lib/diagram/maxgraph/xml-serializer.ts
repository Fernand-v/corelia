import type { DiagramKind } from "@corelia/types";
import type { AbstractGraph } from "@maxgraph/core";
import { ModelXmlSerializer } from "@maxgraph/core";

import {
  createEmptyDrawioDocument,
  detectDiagramInputKind,
  ensureDocumentIntegrity,
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

export const exportGraphModelXml = (graph: AbstractGraph): string => {
  const serializer = new ModelXmlSerializer(graph.getDataModel());
  return serializer.export({ pretty: true });
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
