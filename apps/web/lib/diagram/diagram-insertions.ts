import { MarkerType, type Connection, type EdgeMarker } from "reactflow";
import type { CSSProperties } from "react";
import type { DiagramEdgeModel, DiagramNodeModel, DiagramPayloadState } from "@/lib/diagram/diagram-model";
import type { DiagramEdgeTemplate, DiagramNodeTemplate } from "@/lib/diagram/diagram-palette-catalog";

const buildId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneProperties = (value: Record<string, string>): Record<string, string> => ({ ...value });

const resolveEdgeStyle = (relationType: DiagramEdgeTemplate["id"]): CSSProperties => {
  switch (relationType) {
    case "MESSAGE":
      return { stroke: "#2563eb", strokeWidth: 2 };
    case "INHERITANCE":
      return { stroke: "#0f172a", strokeWidth: 2 };
    case "AGGREGATION":
      return { stroke: "#0f172a", strokeDasharray: "6 4" };
    case "COMPOSITION":
      return { stroke: "#0f172a", strokeWidth: 3 };
    case "ER_LINK":
      return { stroke: "#16a34a", strokeWidth: 2 };
    case "TRANSITION":
      return { stroke: "#ea580c", strokeWidth: 2 };
    case "CONNECTION":
      return { stroke: "#334155", strokeWidth: 2 };
    case "SEQUENCE_FLOW":
      return { stroke: "#0f172a", strokeWidth: 2, strokeDasharray: "8 4" };
    case "FLOW_ARROW":
    case "ASSOCIATION":
    default:
      return { stroke: "#475569", strokeWidth: 2 };
  }
};

const resolveMarker = (relationType: DiagramEdgeTemplate["id"]): EdgeMarker | undefined => {
  switch (relationType) {
    case "ASSOCIATION":
    case "ER_LINK":
      return undefined;
    case "INHERITANCE":
      return { type: MarkerType.ArrowClosed, color: "#0f172a", width: 20, height: 20 };
    case "AGGREGATION":
    case "COMPOSITION":
      return { type: MarkerType.ArrowClosed, color: "#0f172a", width: 14, height: 14 };
    case "MESSAGE":
      return { type: MarkerType.Arrow, color: "#2563eb", width: 16, height: 16 };
    case "TRANSITION":
      return { type: MarkerType.ArrowClosed, color: "#ea580c", width: 16, height: 16 };
    case "CONNECTION":
      return { type: MarkerType.ArrowClosed, color: "#334155", width: 14, height: 14 };
    case "SEQUENCE_FLOW":
      return { type: MarkerType.ArrowClosed, color: "#0f172a", width: 14, height: 14 };
    case "FLOW_ARROW":
    default:
      return { type: MarkerType.ArrowClosed, color: "#475569", width: 14, height: 14 };
  }
};

export const insertNodeFromTemplate = (
  state: DiagramPayloadState,
  template: DiagramNodeTemplate,
  input: {
    canvasWidth: number;
    canvasHeight: number;
    position?: {
      x: number;
      y: number;
    };
  }
): DiagramPayloadState => {
  const safeCanvasWidth = Math.max(300, input.canvasWidth || 0);
  const safeCanvasHeight = Math.max(240, input.canvasHeight || 0);

  const centerX = (safeCanvasWidth / 2 - state.viewport.x) / state.viewport.zoom;
  const centerY = (safeCanvasHeight / 2 - state.viewport.y) / state.viewport.zoom;
  const basePosition = input.position ?? { x: centerX, y: centerY };

  const offsetIndex = state.nodes.length;
  const offsetX = (offsetIndex % 5) * 28;
  const offsetY = Math.floor(offsetIndex / 5) * 22;

  const nextNodeData: DiagramNodeModel["data"] = {
    label: template.defaultLabel ?? template.label,
    elementType: template.id
  };
  if (template.defaultProperties) {
    nextNodeData.properties = cloneProperties(template.defaultProperties);
  }

  const nextNode: DiagramNodeModel = {
    id: buildId("n"),
    type: "diagramNode",
    position: {
      x: basePosition.x + offsetX,
      y: basePosition.y + offsetY
    },
    data: nextNodeData
  };

  return {
    ...state,
    nodes: [...state.nodes, nextNode]
  };
};

export const connectWithEdgeTemplate = (
  state: DiagramPayloadState,
  template: DiagramEdgeTemplate,
  connection: Connection
): DiagramPayloadState => {
  if (!connection.source || !connection.target) {
    return state;
  }

  const marker = resolveMarker(template.id);
  const nextEdgeData: DiagramEdgeModel["data"] = {
    relationType: template.id
  };
  if (template.defaultProperties) {
    nextEdgeData.properties = cloneProperties(template.defaultProperties);
  }

  const nextEdge: DiagramEdgeModel = {
    id: buildId("e"),
    source: connection.source,
    target: connection.target,
    type: "diagramRelation",
    ...(template.defaultLabel ? { label: template.defaultLabel } : {}),
    style: resolveEdgeStyle(template.id),
    ...(marker ? { markerEnd: marker } : {}),
    animated: template.id === "MESSAGE",
    data: nextEdgeData
  };

  return {
    ...state,
    edges: [...state.edges, nextEdge]
  };
};
