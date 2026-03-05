import type { DiagramKind } from "@corelia/types";
import type { DiagramEdgeProperties, DiagramEdgeRelationType, DiagramNodeElementType, DiagramNodeProperties } from "@/lib/diagram/diagram-model";

export type DiagramNodeTemplate = {
  id: DiagramNodeElementType;
  label: string;
  icon: string;
  category: string;
  tooltip: string;
  defaultLabel?: string;
  defaultProperties?: DiagramNodeProperties;
};

export type DiagramEdgeTemplate = {
  id: DiagramEdgeRelationType;
  label: string;
  icon: string;
  category: string;
  tooltip: string;
  defaultLabel?: string;
  defaultProperties?: DiagramEdgeProperties;
};

export type DiagramPaletteDefinition = {
  nodeTemplates: DiagramNodeTemplate[];
  edgeTemplates: DiagramEdgeTemplate[];
};

const FLOW_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    { id: "START_END", label: "Start/End", icon: "SE", category: "Basicos", tooltip: "Nodo de inicio o fin", defaultLabel: "Start/End" },
    { id: "PROCESS", label: "Process", icon: "PR", category: "Basicos", tooltip: "Paso de proceso", defaultLabel: "Process" },
    { id: "DECISION", label: "Decision", icon: "?", category: "Basicos", tooltip: "Nodo de decision", defaultLabel: "Decision" },
    { id: "INPUT_OUTPUT", label: "Input/Output", icon: "IO", category: "Basicos", tooltip: "Entrada o salida", defaultLabel: "Input/Output" },
    { id: "CONNECTOR", label: "Connector", icon: "C", category: "Basicos", tooltip: "Conector de flujo", defaultLabel: "Connector" }
  ],
  edgeTemplates: [
    { id: "FLOW_ARROW", label: "Flow arrow", icon: "->", category: "Relaciones", tooltip: "Flecha de flujo" }
  ]
};

const SEQUENCE_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    { id: "ACTOR", label: "Actor", icon: "A", category: "Participantes", tooltip: "Actor externo", defaultLabel: "Actor" },
    { id: "PARTICIPANT", label: "Participant", icon: "P", category: "Participantes", tooltip: "Participante interno", defaultLabel: "Participant" },
    { id: "LIFELINE", label: "Lifeline", icon: "LL", category: "Participantes", tooltip: "Linea de vida", defaultLabel: "Lifeline" },
    { id: "ACTIVATION_BAR", label: "Activation", icon: "AB", category: "Control", tooltip: "Barra de activacion", defaultLabel: "Activation" },
    { id: "COMBINED_FRAGMENT", label: "Fragment", icon: "CF", category: "Control", tooltip: "Fragmento loop/alt/opt", defaultLabel: "Fragment", defaultProperties: { fragmentType: "loop" } }
  ],
  edgeTemplates: [
    { id: "MESSAGE", label: "Message", icon: "M", category: "Relaciones", tooltip: "Mensaje entre participantes", defaultLabel: "message", defaultProperties: { messageType: "sync" } }
  ]
};

const UML_CLASS_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    {
      id: "CLASS",
      label: "Class",
      icon: "CL",
      category: "Modelo",
      tooltip: "Clase UML",
      defaultLabel: "Class",
      defaultProperties: {
        attributes: "- id: UUID",
        methods: "+ save()"
      }
    }
  ],
  edgeTemplates: [
    { id: "ASSOCIATION", label: "Association", icon: "AS", category: "Relaciones", tooltip: "Asociacion UML", defaultProperties: { sourceMultiplicity: "1", targetMultiplicity: "*" } },
    { id: "INHERITANCE", label: "Inheritance", icon: "IN", category: "Relaciones", tooltip: "Herencia UML" },
    { id: "AGGREGATION", label: "Aggregation", icon: "AG", category: "Relaciones", tooltip: "Agregacion UML" },
    { id: "COMPOSITION", label: "Composition", icon: "CO", category: "Relaciones", tooltip: "Composicion UML" }
  ]
};

const ER_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    {
      id: "ENTITY",
      label: "Entity",
      icon: "EN",
      category: "Modelo",
      tooltip: "Entidad",
      defaultLabel: "Entity",
      defaultProperties: { attributes: "id, name", primaryKeys: "id" }
    },
    { id: "ATTRIBUTE", label: "Attribute", icon: "AT", category: "Modelo", tooltip: "Atributo", defaultLabel: "Attribute" },
    { id: "PRIMARY_KEY", label: "Primary key", icon: "PK", category: "Modelo", tooltip: "Clave primaria", defaultLabel: "Primary Key" },
    { id: "RELATIONSHIP", label: "Relationship", icon: "RE", category: "Modelo", tooltip: "Relacion entre entidades", defaultLabel: "Relationship" }
  ],
  edgeTemplates: [
    {
      id: "ER_LINK",
      label: "ER link",
      icon: "ER",
      category: "Relaciones",
      tooltip: "Relacion ER",
      defaultProperties: {
        sourceCardinality: "1",
        targetCardinality: "N"
      }
    }
  ]
};

const STATE_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    { id: "INITIAL_STATE", label: "Initial", icon: "I", category: "Estados", tooltip: "Estado inicial", defaultLabel: "Initial" },
    { id: "STATE", label: "State", icon: "S", category: "Estados", tooltip: "Estado", defaultLabel: "State" },
    { id: "FINAL_STATE", label: "Final", icon: "F", category: "Estados", tooltip: "Estado final", defaultLabel: "Final" }
  ],
  edgeTemplates: [
    {
      id: "TRANSITION",
      label: "Transition",
      icon: "TR",
      category: "Relaciones",
      tooltip: "Transicion entre estados",
      defaultLabel: "transition",
      defaultProperties: { trigger: "event" }
    }
  ]
};

const ARCHITECTURE_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    { id: "COMPONENT_SERVICE", label: "Component/Service", icon: "SV", category: "Componentes", tooltip: "Componente o servicio", defaultLabel: "Service" },
    { id: "INTERFACE_API", label: "Interface/API", icon: "API", category: "Componentes", tooltip: "Interfaz o API", defaultLabel: "API", defaultProperties: { protocol: "HTTP", endpoint: "/v1" } },
    { id: "DATABASE_STORAGE", label: "Database/Storage", icon: "DB", category: "Datos", tooltip: "Base de datos o storage", defaultLabel: "Database", defaultProperties: { engine: "PostgreSQL" } },
    { id: "INFRA_SERVER", label: "Server", icon: "SRV", category: "Infra", tooltip: "Servidor", defaultLabel: "Server" },
    { id: "INFRA_CLOUD", label: "Cloud", icon: "CLD", category: "Infra", tooltip: "Servicio cloud", defaultLabel: "Cloud" },
    { id: "INFRA_CONTAINER", label: "Container", icon: "CTR", category: "Infra", tooltip: "Contenedor", defaultLabel: "Container" }
  ],
  edgeTemplates: [
    { id: "CONNECTION", label: "Connection", icon: "CN", category: "Relaciones", tooltip: "Conexion entre componentes" }
  ]
};

const BPMN_PALETTE: DiagramPaletteDefinition = {
  nodeTemplates: [
    { id: "START_EVENT", label: "Start event", icon: "ST", category: "Eventos", tooltip: "Evento de inicio", defaultLabel: "Start" },
    { id: "ACTIVITY_TASK", label: "Activity/Task", icon: "TK", category: "Actividades", tooltip: "Actividad o tarea", defaultLabel: "Task" },
    { id: "GATEWAY", label: "Gateway", icon: "GW", category: "Control", tooltip: "Compuerta de decision", defaultLabel: "Gateway" },
    { id: "END_EVENT", label: "End event", icon: "EN", category: "Eventos", tooltip: "Evento de fin", defaultLabel: "End" },
    { id: "POOL", label: "Pool", icon: "PL", category: "Swimlanes", tooltip: "Pool BPMN", defaultLabel: "Pool" },
    { id: "LANE", label: "Lane", icon: "LN", category: "Swimlanes", tooltip: "Lane BPMN", defaultLabel: "Lane" }
  ],
  edgeTemplates: [
    { id: "SEQUENCE_FLOW", label: "Sequence flow", icon: "SF", category: "Relaciones", tooltip: "Flujo de secuencia BPMN" }
  ]
};

export const DIAGRAM_PALETTE_CATALOG: Record<DiagramKind, DiagramPaletteDefinition> = {
  FLUJO: FLOW_PALETTE,
  SECUENCIA: SEQUENCE_PALETTE,
  UML_CLASES: UML_CLASS_PALETTE,
  ENTIDAD_RELACION: ER_PALETTE,
  ESTADO: STATE_PALETTE,
  ARQUITECTURA: ARCHITECTURE_PALETTE,
  BPMN: BPMN_PALETTE
};

export const getPaletteForKind = (kind: DiagramKind): DiagramPaletteDefinition =>
  DIAGRAM_PALETTE_CATALOG[kind];
