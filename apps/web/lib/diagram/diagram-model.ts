import type { DiagramKind } from "@corelia/types";
import type { Edge, Node, Viewport } from "reactflow";

export const DIAGRAM_KINDS = [
  "FLUJO",
  "SECUENCIA",
  "UML_CLASES",
  "ENTIDAD_RELACION",
  "ESTADO",
  "ARQUITECTURA",
  "BPMN"
] as const;

export const DIAGRAM_NODE_ELEMENT_TYPES = [
  "GENERIC",
  "START_END",
  "PROCESS",
  "DECISION",
  "INPUT_OUTPUT",
  "CONNECTOR",
  "ACTOR",
  "PARTICIPANT",
  "LIFELINE",
  "ACTIVATION_BAR",
  "COMBINED_FRAGMENT",
  "CLASS",
  "ENTITY",
  "ATTRIBUTE",
  "PRIMARY_KEY",
  "RELATIONSHIP",
  "INITIAL_STATE",
  "STATE",
  "FINAL_STATE",
  "COMPONENT_SERVICE",
  "INTERFACE_API",
  "DATABASE_STORAGE",
  "INFRA_SERVER",
  "INFRA_CLOUD",
  "INFRA_CONTAINER",
  "START_EVENT",
  "ACTIVITY_TASK",
  "GATEWAY",
  "END_EVENT",
  "POOL",
  "LANE"
] as const;

export const DIAGRAM_EDGE_RELATION_TYPES = [
  "FLOW_ARROW",
  "MESSAGE",
  "ASSOCIATION",
  "INHERITANCE",
  "AGGREGATION",
  "COMPOSITION",
  "ER_LINK",
  "TRANSITION",
  "CONNECTION",
  "SEQUENCE_FLOW"
] as const;

export type DiagramNodeElementType = (typeof DIAGRAM_NODE_ELEMENT_TYPES)[number];
export type DiagramEdgeRelationType = (typeof DIAGRAM_EDGE_RELATION_TYPES)[number];

export type DiagramNodeProperties = Record<string, string>;
export type DiagramEdgeProperties = Record<string, string>;

export type DiagramNodeData = {
  label: string;
  elementType: DiagramNodeElementType;
  properties?: DiagramNodeProperties;
};

export type DiagramEdgeData = {
  relationType: DiagramEdgeRelationType;
  properties?: DiagramEdgeProperties;
};

export type DiagramNodeModel = Node<DiagramNodeData>;
export type DiagramEdgeModel = Edge<DiagramEdgeData>;

export type DiagramPayloadState = {
  modelVersion: 2;
  engine: "REACT_FLOW";
  diagramKind: DiagramKind;
  nodes: DiagramNodeModel[];
  edges: DiagramEdgeModel[];
  viewport: Viewport;
};

export const DEFAULT_DIAGRAM_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 1
};

const DIAGRAM_KIND_SET = new Set<string>(DIAGRAM_KINDS);
const NODE_TYPE_SET = new Set<string>(DIAGRAM_NODE_ELEMENT_TYPES);
const RELATION_TYPE_SET = new Set<string>(DIAGRAM_EDGE_RELATION_TYPES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeViewport = (value: unknown): Viewport => {
  if (!isRecord(value)) {
    return DEFAULT_DIAGRAM_VIEWPORT;
  }

  return {
    x: typeof value.x === "number" ? value.x : DEFAULT_DIAGRAM_VIEWPORT.x,
    y: typeof value.y === "number" ? value.y : DEFAULT_DIAGRAM_VIEWPORT.y,
    zoom: typeof value.zoom === "number" ? value.zoom : DEFAULT_DIAGRAM_VIEWPORT.zoom
  };
};

const normalizeStringProperties = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") {
      normalized[key] = raw;
    }
  }

  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized;
};

const normalizeNodeElementType = (value: unknown): DiagramNodeElementType => {
  if (typeof value === "string" && NODE_TYPE_SET.has(value)) {
    return value as DiagramNodeElementType;
  }

  return "GENERIC";
};

const inferRelationTypeByKind = (kind: DiagramKind): DiagramEdgeRelationType => {
  switch (kind) {
    case "SECUENCIA":
      return "MESSAGE";
    case "UML_CLASES":
      return "ASSOCIATION";
    case "ENTIDAD_RELACION":
      return "ER_LINK";
    case "ESTADO":
      return "TRANSITION";
    case "ARQUITECTURA":
      return "CONNECTION";
    case "BPMN":
      return "SEQUENCE_FLOW";
    case "FLUJO":
    default:
      return "FLOW_ARROW";
  }
};

const normalizeRelationType = (value: unknown, kind: DiagramKind): DiagramEdgeRelationType => {
  if (typeof value === "string" && RELATION_TYPE_SET.has(value)) {
    return value as DiagramEdgeRelationType;
  }

  return inferRelationTypeByKind(kind);
};

const normalizeKind = (value: unknown, fallback: DiagramKind): DiagramKind => {
  if (typeof value === "string" && DIAGRAM_KIND_SET.has(value)) {
    return value as DiagramKind;
  }

  return fallback;
};

const makeNode = (
  id: string,
  label: string,
  elementType: DiagramNodeElementType,
  position: { x: number; y: number },
  properties?: DiagramNodeProperties
): DiagramNodeModel => ({
  id,
  type: "diagramNode",
  position,
  data: {
    label,
    elementType,
    ...(properties ? { properties } : {})
  }
});

const makeEdge = (
  id: string,
  source: string,
  target: string,
  relationType: DiagramEdgeRelationType,
  label?: string,
  properties?: DiagramEdgeProperties
): DiagramEdgeModel => ({
  id,
  source,
  target,
  type: "diagramRelation",
  ...(label ? { label } : {}),
  data: {
    relationType,
    ...(properties ? { properties } : {})
  }
});

export const createDefaultStateForKind = (kind: DiagramKind): DiagramPayloadState => {
  switch (kind) {
    case "SECUENCIA":
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Actor", "ACTOR", { x: 80, y: 80 }),
          makeNode("n-2", "Participante", "PARTICIPANT", { x: 320, y: 80 }),
          makeNode("n-3", "Lifeline", "LIFELINE", { x: 560, y: 80 })
        ],
        edges: [makeEdge("e-1", "n-1", "n-2", "MESSAGE", "mensaje")],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
    case "UML_CLASES":
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Clase Usuario", "CLASS", { x: 100, y: 100 }, {
            attributes: "- id: UUID",
            methods: "+ login()"
          }),
          makeNode("n-2", "Clase Proyecto", "CLASS", { x: 420, y: 100 }, {
            attributes: "- id: UUID",
            methods: "+ crear()"
          })
        ],
        edges: [
          makeEdge("e-1", "n-1", "n-2", "ASSOCIATION", "asociacion", {
            sourceMultiplicity: "1",
            targetMultiplicity: "*"
          })
        ],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
    case "ENTIDAD_RELACION":
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Entidad Usuario", "ENTITY", { x: 80, y: 120 }, {
            attributes: "id, email",
            primaryKeys: "id"
          }),
          makeNode("n-2", "Relacion", "RELATIONSHIP", { x: 360, y: 120 }),
          makeNode("n-3", "Entidad Tarea", "ENTITY", { x: 640, y: 120 }, {
            attributes: "id, titulo",
            primaryKeys: "id"
          })
        ],
        edges: [
          makeEdge("e-1", "n-1", "n-2", "ER_LINK", "1:N", {
            sourceCardinality: "1",
            targetCardinality: "N"
          }),
          makeEdge("e-2", "n-2", "n-3", "ER_LINK", "1:N", {
            sourceCardinality: "1",
            targetCardinality: "N"
          })
        ],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
    case "ESTADO":
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Inicial", "INITIAL_STATE", { x: 80, y: 140 }),
          makeNode("n-2", "Estado", "STATE", { x: 340, y: 130 }),
          makeNode("n-3", "Final", "FINAL_STATE", { x: 620, y: 140 })
        ],
        edges: [
          makeEdge("e-1", "n-1", "n-2", "TRANSITION", "evento", { trigger: "iniciar" }),
          makeEdge("e-2", "n-2", "n-3", "TRANSITION", "evento", { trigger: "finalizar" })
        ],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
    case "ARQUITECTURA":
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Servicio", "COMPONENT_SERVICE", { x: 80, y: 120 }),
          makeNode("n-2", "API", "INTERFACE_API", { x: 350, y: 120 }),
          makeNode("n-3", "DB", "DATABASE_STORAGE", { x: 620, y: 120 })
        ],
        edges: [makeEdge("e-1", "n-1", "n-2", "CONNECTION"), makeEdge("e-2", "n-2", "n-3", "CONNECTION")],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
    case "BPMN":
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Inicio", "START_EVENT", { x: 80, y: 130 }),
          makeNode("n-2", "Tarea", "ACTIVITY_TASK", { x: 320, y: 130 }),
          makeNode("n-3", "Fin", "END_EVENT", { x: 560, y: 130 })
        ],
        edges: [
          makeEdge("e-1", "n-1", "n-2", "SEQUENCE_FLOW"),
          makeEdge("e-2", "n-2", "n-3", "SEQUENCE_FLOW")
        ],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
    case "FLUJO":
    default:
      return {
        modelVersion: 2,
        engine: "REACT_FLOW",
        diagramKind: kind,
        nodes: [
          makeNode("n-1", "Inicio", "START_END", { x: 80, y: 130 }),
          makeNode("n-2", "Proceso", "PROCESS", { x: 360, y: 130 }),
          makeNode("n-3", "Fin", "START_END", { x: 640, y: 130 })
        ],
        edges: [
          makeEdge("e-1", "n-1", "n-2", "FLOW_ARROW"),
          makeEdge("e-2", "n-2", "n-3", "FLOW_ARROW")
        ],
        viewport: DEFAULT_DIAGRAM_VIEWPORT
      };
  }
};

const normalizeNode = (value: unknown, index: number): DiagramNodeModel => {
  const source = isRecord(value) ? value : {};
  const sourceData = isRecord(source.data) ? source.data : {};
  const sourcePosition = isRecord(source.position) ? source.position : {};

  const label =
    typeof sourceData.label === "string" && sourceData.label.trim().length > 0
      ? sourceData.label
      : `Nodo ${index + 1}`;

  const elementType = normalizeNodeElementType(sourceData.elementType);
  const normalizedProperties = normalizeStringProperties(sourceData.properties);
  const data: DiagramNodeData = {
    label,
    elementType
  };
  if (normalizedProperties) {
    data.properties = normalizedProperties;
  }

  return {
    id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id : `n-${index + 1}`,
    type: "diagramNode",
    position: {
      x: typeof sourcePosition.x === "number" ? sourcePosition.x : 140 + index * 50,
      y: typeof sourcePosition.y === "number" ? sourcePosition.y : 140
    },
    data,
    selected: Boolean(source.selected)
  };
};

const normalizeEdge = (
  value: unknown,
  index: number,
  diagramKind: DiagramKind
): DiagramEdgeModel | null => {
  const source = isRecord(value) ? value : {};
  if (typeof source.source !== "string" || typeof source.target !== "string") {
    return null;
  }

  const sourceData = isRecord(source.data) ? source.data : {};
  const label = typeof source.label === "string" ? source.label : undefined;
  const relationType = normalizeRelationType(sourceData.relationType, diagramKind);
  const normalizedProperties = normalizeStringProperties(sourceData.properties);
  const data: DiagramEdgeData = {
    relationType
  };
  if (normalizedProperties) {
    data.properties = normalizedProperties;
  }

  const edge: DiagramEdgeModel = {
    id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id : `e-${index + 1}`,
    source: source.source,
    target: source.target,
    type: "diagramRelation",
    data,
    selected: Boolean(source.selected)
  };
  if (label) {
    edge.label = label;
  }
  if (source.markerEnd) {
    edge.markerEnd = source.markerEnd as NonNullable<DiagramEdgeModel["markerEnd"]>;
  }
  if (isRecord(source.style)) {
    edge.style = source.style as NonNullable<DiagramEdgeModel["style"]>;
  }

  return edge;
};

const parseMaybeJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const normalizeDiagramState = (
  value: string,
  fallbackKind: DiagramKind
): DiagramPayloadState => {
  if (!value.trim()) {
    return createDefaultStateForKind(fallbackKind);
  }

  const parsed = parseMaybeJson(value);
  if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return createDefaultStateForKind(fallbackKind);
  }

  const diagramKind = normalizeKind(parsed.diagramKind, fallbackKind);

  const nodes = parsed.nodes.map((node, index) => normalizeNode(node, index));
  const edges = parsed.edges
    .map((edge, index) => normalizeEdge(edge, index, diagramKind))
    .filter((edge): edge is DiagramEdgeModel => Boolean(edge));

  return {
    modelVersion: 2,
    engine: "REACT_FLOW",
    diagramKind,
    nodes,
    edges,
    viewport: normalizeViewport(parsed.viewport)
  };
};

export const serializeDiagramState = (state: DiagramPayloadState): string =>
  JSON.stringify(state);

export const createEdgePropertyPatch = (
  current: DiagramEdgeProperties | undefined,
  key: string,
  value: string
): DiagramEdgeProperties | undefined => {
  const next = {
    ...(current ?? {}),
    [key]: value
  };

  const normalizedEntries = Object.entries(next).filter(([, raw]) => raw.trim().length > 0);
  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries) as DiagramEdgeProperties;
};

export const createNodePropertyPatch = (
  current: DiagramNodeProperties | undefined,
  key: string,
  value: string
): DiagramNodeProperties | undefined => {
  const next = {
    ...(current ?? {}),
    [key]: value
  };

  const normalizedEntries = Object.entries(next).filter(([, raw]) => raw.trim().length > 0);
  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries) as DiagramNodeProperties;
};
