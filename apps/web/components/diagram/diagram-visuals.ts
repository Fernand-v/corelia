import type { DiagramKind } from "@corelia/types";
import type { DiagramEdgeRelationType, DiagramNodeElementType } from "@/lib/diagram/diagram-model";

export type DiagramKindVisual = {
  label: string;
  icon: string;
  color: string;
};

export const DIAGRAM_KIND_VISUALS: Record<DiagramKind, DiagramKindVisual> = {
  FLUJO: {
    label: "Flujo",
    icon: "↘",
    color: "#4f6ef7"
  },
  SECUENCIA: {
    label: "Secuencia",
    icon: "⇆",
    color: "#8b5cf6"
  },
  UML_CLASES: {
    label: "UML Clases",
    icon: "⌘",
    color: "#10b981"
  },
  ENTIDAD_RELACION: {
    label: "Entidad-Relación",
    icon: "◈",
    color: "#f97316"
  },
  ESTADO: {
    label: "Estado",
    icon: "◎",
    color: "#06b6d4"
  },
  ARQUITECTURA: {
    label: "Arquitectura C4",
    icon: "▦",
    color: "#1e3a5f"
  },
  BPMN: {
    label: "BPMN",
    icon: "⧉",
    color: "#334155"
  }
};

export type NodeVisualMeta = {
  icon: string;
  shortLabel: string;
};

export const NODE_VISUALS: Record<DiagramNodeElementType, NodeVisualMeta> = {
  GENERIC: { icon: "◻", shortLabel: "Genérico" },
  START_END: { icon: "▶", shortLabel: "Start/End" },
  PROCESS: { icon: "▤", shortLabel: "Proceso" },
  DECISION: { icon: "◆", shortLabel: "Decisión" },
  INPUT_OUTPUT: { icon: "▱", shortLabel: "I/O" },
  CONNECTOR: { icon: "●", shortLabel: "Conector" },
  ACTOR: { icon: "👤", shortLabel: "Actor" },
  PARTICIPANT: { icon: "🖥", shortLabel: "Sistema" },
  LIFELINE: { icon: "⋮", shortLabel: "Línea de vida" },
  ACTIVATION_BAR: { icon: "▮", shortLabel: "Activación" },
  COMBINED_FRAGMENT: { icon: "▣", shortLabel: "Fragmento" },
  CLASS: { icon: "C", shortLabel: "Clase" },
  ENTITY: { icon: "E", shortLabel: "Entidad" },
  ATTRIBUTE: { icon: "◌", shortLabel: "Atributo" },
  PRIMARY_KEY: { icon: "🔑", shortLabel: "Clave" },
  RELATIONSHIP: { icon: "◇", shortLabel: "Relación" },
  INITIAL_STATE: { icon: "●", shortLabel: "Inicial" },
  STATE: { icon: "◍", shortLabel: "Estado" },
  FINAL_STATE: { icon: "◉", shortLabel: "Final" },
  COMPONENT_SERVICE: { icon: "🧩", shortLabel: "Componente" },
  INTERFACE_API: { icon: "⚙", shortLabel: "API" },
  DATABASE_STORAGE: { icon: "🗄", shortLabel: "Base de datos" },
  INFRA_SERVER: { icon: "🖧", shortLabel: "Servidor" },
  INFRA_CLOUD: { icon: "☁", shortLabel: "Cloud" },
  INFRA_CONTAINER: { icon: "📦", shortLabel: "Contenedor" },
  START_EVENT: { icon: "○", shortLabel: "Start event" },
  ACTIVITY_TASK: { icon: "▭", shortLabel: "Activity" },
  GATEWAY: { icon: "◇", shortLabel: "Gateway" },
  END_EVENT: { icon: "◎", shortLabel: "End event" },
  POOL: { icon: "▤", shortLabel: "Pool" },
  LANE: { icon: "▥", shortLabel: "Lane" }
};

export type EdgeVisualMeta = {
  label: string;
  icon: string;
};

export const EDGE_VISUALS: Record<DiagramEdgeRelationType, EdgeVisualMeta> = {
  FLOW_ARROW: { label: "Flow", icon: "→" },
  MESSAGE: { label: "Message", icon: "⇢" },
  ASSOCIATION: { label: "Asociación", icon: "→" },
  INHERITANCE: { label: "Herencia", icon: "▷" },
  AGGREGATION: { label: "Agregación", icon: "◇" },
  COMPOSITION: { label: "Composición", icon: "◆" },
  ER_LINK: { label: "ER Link", icon: "↔" },
  TRANSITION: { label: "Transición", icon: "⤴" },
  CONNECTION: { label: "Conexión", icon: "⇄" },
  SEQUENCE_FLOW: { label: "Secuencia", icon: "⇢" }
};

export const diagramKindOptions = Object.entries(DIAGRAM_KIND_VISUALS).map(([value, visual]) => ({
  value: value as DiagramKind,
  ...visual
}));
