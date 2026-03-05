import type { DiagramKind } from "@corelia/types";

import {
  createEmptyDrawioDocument,
  createEmptyGraphModelXml,
  escapeXml,
  type DrawioDocument,
  type DrawioPage
} from "@/lib/diagram/maxgraph/xml-format";

type LegacyNode = {
  id: string;
  data?: {
    label?: string;
    elementType?: string;
    properties?: Record<string, string | undefined>;
  };
  width?: number;
  height?: number;
  position?: { x?: number; y?: number };
};

type LegacyEdge = {
  id: string;
  source?: string;
  target?: string;
  label?: string;
  data?: {
    relationType?: string;
    properties?: Record<string, string | undefined>;
  };
};

type LegacyPayload = {
  diagramKind?: DiagramKind;
  nodes?: LegacyNode[];
  edges?: LegacyEdge[];
};

const nodeStyleByType: Record<string, string> = {
  START_END: "shape=ellipse;whiteSpace=wrap;html=1;fillColor=#10b981;strokeColor=#059669;fontColor=#ffffff;",
  PROCESS: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#4f6ef7;strokeWidth=2;",
  DECISION: "shape=rhombus;whiteSpace=wrap;html=1;fillColor=#fbbf24;strokeColor=#d97706;",
  INPUT_OUTPUT: "shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#8b5cf6;strokeColor=#7c3aed;fontColor=#ffffff;",
  CONNECTOR: "shape=ellipse;whiteSpace=wrap;html=1;fillColor=#06b6d4;strokeColor=#0891b2;fontColor=#ffffff;",
  CLASS: "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#10b981;",
  ENTITY: "rounded=0;whiteSpace=wrap;html=1;fillColor=#fff7ed;strokeColor=#f97316;",
  RELATIONSHIP: "shape=rhombus;whiteSpace=wrap;html=1;fillColor=#334155;strokeColor=#1e293b;fontColor=#ffffff;",
  STATE: "rounded=1;arcSize=20;whiteSpace=wrap;html=1;fillColor=#f0f9ff;strokeColor=#06b6d4;",
  INITIAL_STATE: "shape=ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;fontColor=#ffffff;",
  FINAL_STATE: "shape=doubleEllipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;"
};

const edgeStyleByType: Record<string, string> = {
  FLOW_ARROW: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;strokeColor=#64748b;",
  MESSAGE: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;strokeColor=#0f172a;",
  ASSOCIATION: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=open;strokeColor=#64748b;",
  INHERITANCE: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=blockThin;strokeColor=#4f6ef7;",
  AGGREGATION: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;startArrow=diamondThin;endArrow=open;strokeColor=#10b981;",
  COMPOSITION: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;startArrow=diamond;endArrow=open;strokeColor=#0f172a;",
  ER_LINK: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=open;strokeColor=#64748b;",
  TRANSITION: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;strokeColor=#64748b;",
  CONNECTION: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;strokeColor=#64748b;",
  SEQUENCE_FLOW: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;dashed=1;strokeColor=#475569;"
};

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const sanitizeId = (prefix: string, value: string): string => {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${prefix}-${safe || Math.random().toString(36).slice(2, 8)}`;
};

const buildNodeXml = (node: LegacyNode): { id: string; xml: string } => {
  const nodeId = sanitizeId("n", node.id || Math.random().toString(36).slice(2, 8));
  const width = toNumber(node.width, toNumber(node.data?.properties?.nodeWidth ? Number(node.data.properties.nodeWidth) : undefined, 180));
  const height = toNumber(node.height, toNumber(node.data?.properties?.nodeHeight ? Number(node.data.properties.nodeHeight) : undefined, 80));
  const x = toNumber(node.position?.x, 80);
  const y = toNumber(node.position?.y, 80);
  const elementType = node.data?.elementType ?? "PROCESS";
  const style = nodeStyleByType[elementType] ?? nodeStyleByType.PROCESS;
  const value = escapeXml(node.data?.label ?? elementType);

  const xml = `<mxCell id="${nodeId}" value="${value}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${Math.max(40, width)}" height="${Math.max(24, height)}" as="geometry"/></mxCell>`;

  return { id: nodeId, xml };
};

const buildEdgeXml = (edge: LegacyEdge, nodeMap: Map<string, string>, index: number): string | null => {
  if (!edge.source || !edge.target) {
    return null;
  }

  const source = nodeMap.get(edge.source);
  const target = nodeMap.get(edge.target);
  if (!source || !target) {
    return null;
  }

  const relationType = edge.data?.relationType ?? "FLOW_ARROW";
  const style = edgeStyleByType[relationType] ?? edgeStyleByType.FLOW_ARROW;
  const label = edge.label ? ` value="${escapeXml(edge.label)}"` : "";

  return `<mxCell id="e-${index}"${label} style="${style}" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
};

const legacyPayloadToGraphModelXml = (payload: LegacyPayload): string => {
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];

  if (nodes.length === 0) {
    return createEmptyGraphModelXml();
  }

  const nodeMap = new Map<string, string>();
  const nodeCells: string[] = [];

  for (const node of nodes) {
    const rendered = buildNodeXml(node);
    nodeMap.set(node.id, rendered.id);
    nodeCells.push(rendered.xml);
  }

  const edgeCells: string[] = [];
  edges.forEach((edge, index) => {
    const edgeXml = buildEdgeXml(edge, nodeMap, index + 1);
    if (edgeXml) {
      edgeCells.push(edgeXml);
    }
  });

  return `<mxGraphModel dx="1280" dy="720" grid="1" gridSize="16" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${nodeCells.join("")}${edgeCells.join("")}</root></mxGraphModel>`;
};

export const migrateLegacyReactFlowPayload = (
  raw: string,
  fallbackKind: DiagramKind
): { document: DrawioDocument; migratedFromLegacy: boolean } => {
  try {
    const parsed = JSON.parse(raw) as LegacyPayload;
    const kind = parsed.diagramKind ?? fallbackKind;
    const document = createEmptyDrawioDocument(kind);

    const migratedXml = legacyPayloadToGraphModelXml(parsed);
    const firstPage = document.pages[0];
    if (!firstPage) {
      return { document, migratedFromLegacy: false };
    }

    const migratedPage: DrawioPage = {
      ...firstPage,
      xml: migratedXml
    };

    return {
      document: {
        ...document,
        pages: [migratedPage]
      },
      migratedFromLegacy: true
    };
  } catch {
    return {
      document: createEmptyDrawioDocument(fallbackKind),
      migratedFromLegacy: false
    };
  }
};
