import type { DiagramKind } from "@corelia/types";

export type ShapeTemplate = {
  id: string;
  label: string;
  description: string;
  category: string;
  width: number;
  height: number;
  value?: string;
  style: Record<string, string | number | boolean>;
  diagramKinds?: DiagramKind[];
  remoteLibrary?: string;
};

export type EdgeTemplate = {
  id: string;
  label: string;
  description: string;
  category: string;
  style: Record<string, string | number | boolean>;
  value?: string;
  diagramKinds?: DiagramKind[];
};

export type ShapeLibrary = {
  id: string;
  name: string;
  section: string;
  shapes: ShapeTemplate[];
  edges?: EdgeTemplate[];
};

const ALL_KINDS: DiagramKind[] = [
  "FLUJO",
  "SECUENCIA",
  "UML_CLASES",
  "ENTIDAD_RELACION",
  "ESTADO",
  "ARQUITECTURA",
  "BPMN"
];

const baseShapes: ShapeTemplate[] = [
  {
    id: "rect",
    label: "Rectángulo",
    description: "Forma rectangular básica",
    category: "General",
    width: 180,
    height: 80,
    style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "round-rect",
    label: "Rectángulo redondeado",
    description: "Rectángulo con bordes redondeados",
    category: "General",
    width: 180,
    height: 80,
    style: { rounded: 1, arcSize: 16, fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "ellipse",
    label: "Elipse",
    description: "Elipse/círculo",
    category: "General",
    width: 120,
    height: 80,
    style: { shape: "ellipse", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "diamond",
    label: "Rombo",
    description: "Nodo de decisión",
    category: "General",
    width: 120,
    height: 120,
    style: { shape: "rhombus", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "parallelogram",
    label: "Paralelogramo",
    description: "Entrada/salida",
    category: "General",
    width: 180,
    height: 80,
    style: {
      shape: "parallelogram",
      fillColor: "#ffffff",
      strokeColor: "#64748b",
      whiteSpace: "wrap"
    },
    diagramKinds: ALL_KINDS
  },
  {
    id: "hexagon",
    label: "Hexágono",
    description: "Hexágono",
    category: "General",
    width: 160,
    height: 90,
    style: { shape: "hexagon", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "cloud",
    label: "Nube",
    description: "Nube",
    category: "General",
    width: 170,
    height: 100,
    style: { shape: "cloud", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "cylinder",
    label: "Cilindro",
    description: "Base de datos",
    category: "General",
    width: 170,
    height: 100,
    style: { shape: "cylinder", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "note",
    label: "Nota",
    description: "Rectángulo con esquina doblada",
    category: "Formas Básicas Extra",
    width: 180,
    height: 90,
    style: { shape: "note", fillColor: "#fff9c4", strokeColor: "#bfa13a", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  },
  {
    id: "actor",
    label: "Actor UML",
    description: "Actor tipo persona",
    category: "Formas Básicas Extra",
    width: 80,
    height: 120,
    style: { shape: "umlActor", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" },
    diagramKinds: ALL_KINDS
  }
];

const baseEdges: EdgeTemplate[] = [
  {
    id: "arrow",
    label: "Flecha simple",
    description: "Conector con flecha",
    category: "Conectores",
    style: { endArrow: "block", strokeColor: "#64748b", strokeWidth: 1.8 },
    diagramKinds: ALL_KINDS
  },
  {
    id: "double-arrow",
    label: "Flecha doble",
    description: "Conector bidireccional",
    category: "Conectores",
    style: { startArrow: "block", endArrow: "block", strokeColor: "#64748b", strokeWidth: 1.8 },
    diagramKinds: ALL_KINDS
  },
  {
    id: "line",
    label: "Línea",
    description: "Línea simple sin puntas",
    category: "Conectores",
    style: { endArrow: "none", strokeColor: "#64748b", strokeWidth: 1.8 },
    diagramKinds: ALL_KINDS
  },
  {
    id: "dashed",
    label: "Línea punteada",
    description: "Conector punteado",
    category: "Conectores",
    style: { dashed: 1, endArrow: "none", strokeColor: "#64748b", strokeWidth: 1.8 },
    diagramKinds: ALL_KINDS
  },
  {
    id: "orthogonal",
    label: "Conector ortogonal",
    description: "Conector en ángulos rectos",
    category: "Conectores",
    style: { edgeStyle: "orthogonalEdgeStyle", rounded: 1, endArrow: "block", strokeColor: "#64748b", strokeWidth: 1.8 },
    diagramKinds: ALL_KINDS
  }
];

const diagramSpecificLibraries: ShapeLibrary[] = [
  {
    id: "flow-core",
    name: "Flujo de Proceso",
    section: "Flujo",
    shapes: [
      { id: "flow-start", label: "Start", description: "Inicio", category: "Flujo", width: 140, height: 50, style: { shape: "ellipse", fillColor: "#10b981", strokeColor: "#059669", fontColor: "#ffffff", whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] },
      { id: "flow-end", label: "End", description: "Fin", category: "Flujo", width: 140, height: 50, style: { shape: "ellipse", fillColor: "#ef4444", strokeColor: "#dc2626", fontColor: "#ffffff", whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] },
      { id: "flow-process", label: "Proceso", description: "Paso de proceso", category: "Flujo", width: 180, height: 70, style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#4f6ef7", strokeWidth: 2, whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] },
      { id: "flow-decision", label: "Decisión", description: "Rombo de decisión", category: "Flujo", width: 120, height: 120, style: { shape: "rhombus", fillColor: "#fbbf24", strokeColor: "#d97706", whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] },
      { id: "flow-io", label: "Datos / IO", description: "Entrada y salida", category: "Flujo", width: 180, height: 60, style: { shape: "parallelogram", fillColor: "#8b5cf6", strokeColor: "#7c3aed", fontColor: "#ffffff", whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] },
      { id: "flow-swimlane-h", label: "Swimlane H", description: "Carril horizontal", category: "Flujo", width: 420, height: 180, style: { shape: "swimlane", horizontal: 1, startSize: 32, fillColor: "#eef1fe", strokeColor: "#4f6ef7", whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] },
      { id: "flow-swimlane-v", label: "Swimlane V", description: "Carril vertical", category: "Flujo", width: 220, height: 320, style: { shape: "swimlane", horizontal: 0, startSize: 32, fillColor: "#eef1fe", strokeColor: "#4f6ef7", whiteSpace: "wrap" }, diagramKinds: ["FLUJO"] }
    ],
    edges: [
      { id: "flow-yes", label: "Sí", description: "Ruta positiva", category: "Flujo", style: { endArrow: "block", strokeColor: "#10b981", strokeWidth: 2 }, diagramKinds: ["FLUJO"], value: "Sí" },
      { id: "flow-no", label: "No", description: "Ruta negativa", category: "Flujo", style: { endArrow: "block", strokeColor: "#ef4444", strokeWidth: 2 }, diagramKinds: ["FLUJO"], value: "No" }
    ]
  },
  {
    id: "uml-sequence",
    name: "Secuencia UML",
    section: "Secuencia",
    shapes: [
      { id: "seq-actor", label: "Actor Persona", description: "Actor persona", category: "Secuencia", width: 100, height: 120, style: { shape: "umlActor", fillColor: "#ffffff", strokeColor: "#4f6ef7" }, diagramKinds: ["SECUENCIA"] },
      { id: "seq-system", label: "Actor Sistema", description: "Participante sistema", category: "Secuencia", width: 160, height: 80, style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981", whiteSpace: "wrap" }, diagramKinds: ["SECUENCIA"] },
      { id: "seq-lifeline", label: "Línea de vida", description: "Lifeline vertical", category: "Secuencia", width: 8, height: 260, style: { shape: "line", dashed: 1, strokeColor: "#94a3b8" }, diagramKinds: ["SECUENCIA"] },
      { id: "seq-activation", label: "Activación", description: "Barra de activación", category: "Secuencia", width: 12, height: 120, style: { rounded: 1, fillColor: "#4f6ef7", strokeColor: "#4f6ef7" }, diagramKinds: ["SECUENCIA"] },
      { id: "seq-fragment-loop", label: "Fragmento loop", description: "Fragmento de control", category: "Secuencia", width: 280, height: 160, style: { rounded: 1, fillColor: "#fff7ed", strokeColor: "#f97316", dashed: 1 }, diagramKinds: ["SECUENCIA"], value: "loop" },
      { id: "seq-fragment-alt", label: "Fragmento alt", description: "Fragmento alternativo", category: "Secuencia", width: 280, height: 160, style: { rounded: 1, fillColor: "#f5f3ff", strokeColor: "#8b5cf6", dashed: 1 }, diagramKinds: ["SECUENCIA"], value: "alt" }
    ],
    edges: [
      { id: "seq-sync", label: "Mensaje síncrono", description: "Mensaje síncrono", category: "Secuencia", style: { endArrow: "block", strokeColor: "#111827", strokeWidth: 2 }, diagramKinds: ["SECUENCIA"] },
      { id: "seq-async", label: "Mensaje asíncrono", description: "Mensaje asíncrono", category: "Secuencia", style: { endArrow: "open", strokeColor: "#111827", strokeWidth: 1.6 }, diagramKinds: ["SECUENCIA"] },
      { id: "seq-response", label: "Respuesta", description: "Respuesta punteada", category: "Secuencia", style: { endArrow: "open", dashed: 1, strokeColor: "#94a3b8", strokeWidth: 1.6 }, diagramKinds: ["SECUENCIA"] }
    ]
  },
  {
    id: "uml-classes",
    name: "Clases UML",
    section: "Clases",
    shapes: [
      { id: "class", label: "Clase", description: "Clase UML", category: "Clases", width: 220, height: 160, style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#10b981", whiteSpace: "wrap" }, diagramKinds: ["UML_CLASES"] },
      { id: "interface", label: "Interfaz", description: "Interfaz UML", category: "Clases", width: 220, height: 140, style: { rounded: 0, fillColor: "#f5f3ff", strokeColor: "#8b5cf6", whiteSpace: "wrap" }, diagramKinds: ["UML_CLASES"], value: "«interface»" },
      { id: "enum", label: "Enumeración", description: "Enumeración UML", category: "Clases", width: 220, height: 140, style: { rounded: 0, fillColor: "#ecfeff", strokeColor: "#0891b2", whiteSpace: "wrap" }, diagramKinds: ["UML_CLASES"], value: "«enumeration»" },
      { id: "uml-package", label: "Paquete", description: "Paquete UML", category: "Clases", width: 220, height: 130, style: { shape: "folder", fillColor: "#ffffff", strokeColor: "#64748b", whiteSpace: "wrap" }, diagramKinds: ["UML_CLASES"] }
    ],
    edges: [
      { id: "uml-inherit", label: "Herencia", description: "Relación de herencia", category: "Relaciones UML", style: { endArrow: "blockThin", endFill: 0, strokeColor: "#4f6ef7", strokeWidth: 2 }, diagramKinds: ["UML_CLASES"] },
      { id: "uml-impl", label: "Implementación", description: "Relación de implementación", category: "Relaciones UML", style: { endArrow: "blockThin", endFill: 0, dashed: 1, strokeColor: "#8b5cf6", strokeWidth: 2 }, diagramKinds: ["UML_CLASES"] },
      { id: "uml-assoc", label: "Asociación", description: "Asociación", category: "Relaciones UML", style: { endArrow: "open", strokeColor: "#64748b", strokeWidth: 1.8 }, diagramKinds: ["UML_CLASES"] },
      { id: "uml-agg", label: "Agregación", description: "Agregación", category: "Relaciones UML", style: { startArrow: "diamondThin", startFill: 0, endArrow: "none", strokeColor: "#10b981", strokeWidth: 1.8 }, diagramKinds: ["UML_CLASES"] },
      { id: "uml-comp", label: "Composición", description: "Composición", category: "Relaciones UML", style: { startArrow: "diamond", startFill: 1, endArrow: "none", strokeColor: "#0f172a", strokeWidth: 1.8 }, diagramKinds: ["UML_CLASES"] },
      { id: "uml-dep", label: "Dependencia", description: "Dependencia", category: "Relaciones UML", style: { endArrow: "open", dashed: 1, strokeColor: "#f59e0b", strokeWidth: 1.6 }, diagramKinds: ["UML_CLASES"] }
    ]
  },
  {
    id: "er",
    name: "Entidad-Relación",
    section: "ER",
    shapes: [
      { id: "er-entity", label: "Entidad", description: "Entidad", category: "Entidades", width: 220, height: 130, style: { rounded: 0, fillColor: "#ffffff", strokeColor: "#f97316", whiteSpace: "wrap" }, diagramKinds: ["ENTIDAD_RELACION"] },
      { id: "er-weak-entity", label: "Entidad débil", description: "Entidad débil", category: "Entidades", width: 220, height: 130, style: { rounded: 0, fillColor: "#fff7ed", strokeColor: "#f97316", strokeWidth: 2.2, whiteSpace: "wrap" }, diagramKinds: ["ENTIDAD_RELACION"] },
      { id: "er-attribute", label: "Atributo", description: "Atributo", category: "Atributos", width: 140, height: 70, style: { shape: "ellipse", fillColor: "#ffffff", strokeColor: "#94a3b8", whiteSpace: "wrap" }, diagramKinds: ["ENTIDAD_RELACION"] },
      { id: "er-key", label: "Atributo clave", description: "Atributo clave", category: "Atributos", width: 140, height: 70, style: { shape: "ellipse", fillColor: "#fef9c3", strokeColor: "#ca8a04", whiteSpace: "wrap", fontStyle: 4 }, diagramKinds: ["ENTIDAD_RELACION"] },
      { id: "er-relation", label: "Relación", description: "Relación rombo", category: "Relaciones", width: 130, height: 110, style: { shape: "rhombus", fillColor: "#334155", strokeColor: "#1e293b", fontColor: "#ffffff", whiteSpace: "wrap" }, diagramKinds: ["ENTIDAD_RELACION"] }
    ],
    edges: [
      { id: "er-11", label: "1:1", description: "Cardinalidad 1:1", category: "Cardinalidad", style: { endArrow: "none", strokeColor: "#64748b", strokeWidth: 1.8 }, diagramKinds: ["ENTIDAD_RELACION"], value: "1:1" },
      { id: "er-1n", label: "1:N", description: "Cardinalidad 1:N", category: "Cardinalidad", style: { endArrow: "none", strokeColor: "#64748b", strokeWidth: 1.8 }, diagramKinds: ["ENTIDAD_RELACION"], value: "1:N" },
      { id: "er-nm", label: "N:M", description: "Cardinalidad N:M", category: "Cardinalidad", style: { endArrow: "none", strokeColor: "#64748b", strokeWidth: 1.8 }, diagramKinds: ["ENTIDAD_RELACION"], value: "N:M" }
    ]
  },
  {
    id: "state",
    name: "Estados UML",
    section: "Estado",
    shapes: [
      { id: "state-initial", label: "Inicial", description: "Estado inicial", category: "Estados", width: 24, height: 24, style: { shape: "ellipse", fillColor: "#000000", strokeColor: "#000000" }, diagramKinds: ["ESTADO"] },
      { id: "state-final", label: "Final", description: "Estado final", category: "Estados", width: 28, height: 28, style: { shape: "doubleEllipse", fillColor: "#ffffff", strokeColor: "#000000" }, diagramKinds: ["ESTADO"] },
      { id: "state-simple", label: "Estado", description: "Estado simple", category: "Estados", width: 190, height: 90, style: { rounded: 1, arcSize: 24, fillColor: "#ffffff", strokeColor: "#4f6ef7", whiteSpace: "wrap" }, diagramKinds: ["ESTADO"] },
      { id: "state-composite", label: "Compuesto", description: "Estado compuesto", category: "Estados", width: 260, height: 180, style: { rounded: 1, arcSize: 24, fillColor: "#ffffff", strokeColor: "#4f6ef7", dashed: 1, whiteSpace: "wrap" }, diagramKinds: ["ESTADO"] },
      { id: "state-fork", label: "Fork/Join", description: "Barra fork/join", category: "Pseudoestados", width: 200, height: 8, style: { rounded: 0, fillColor: "#111827", strokeColor: "#111827" }, diagramKinds: ["ESTADO"] },
      { id: "state-decision", label: "Decisión", description: "Pseudoestado decisión", category: "Pseudoestados", width: 90, height: 90, style: { shape: "rhombus", fillColor: "#ffffff", strokeColor: "#334155" }, diagramKinds: ["ESTADO"] }
    ],
    edges: [
      { id: "state-transition", label: "Transición", description: "Transición de estado", category: "Transiciones", style: { endArrow: "block", strokeColor: "#64748b", strokeWidth: 1.8, rounded: 1 }, diagramKinds: ["ESTADO"] }
    ]
  },
  {
    id: "c4",
    name: "Arquitectura C4",
    section: "C4",
    shapes: [
      { id: "c4-person", label: "Persona", description: "Persona del contexto", category: "Nivel 1", width: 220, height: 130, style: { rounded: 1, fillColor: "#1168BD", strokeColor: "#0c4f95", fontColor: "#ffffff", whiteSpace: "wrap" }, diagramKinds: ["ARQUITECTURA"] },
      { id: "c4-system", label: "Sistema", description: "Sistema software", category: "Nivel 1", width: 260, height: 150, style: { rounded: 1, fillColor: "#438DD5", strokeColor: "#1168BD", whiteSpace: "wrap" }, diagramKinds: ["ARQUITECTURA"] },
      { id: "c4-container", label: "Contenedor", description: "Contenedor tecnológico", category: "Nivel 2", width: 250, height: 140, style: { rounded: 1, fillColor: "#85BBF0", strokeColor: "#438DD5", whiteSpace: "wrap" }, diagramKinds: ["ARQUITECTURA"] },
      { id: "c4-component", label: "Componente", description: "Componente interno", category: "Nivel 3", width: 220, height: 120, style: { rounded: 1, fillColor: "#ecfdf5", strokeColor: "#10b981", whiteSpace: "wrap" }, diagramKinds: ["ARQUITECTURA"] },
      { id: "c4-database", label: "Base de Datos", description: "Cilindro DB", category: "Infraestructura", width: 220, height: 130, style: { shape: "cylinder", fillColor: "#336791", strokeColor: "#234a67", fontColor: "#ffffff", whiteSpace: "wrap" }, diagramKinds: ["ARQUITECTURA"] },
      { id: "c4-boundary", label: "System Boundary", description: "Contenedor boundary", category: "Infraestructura", width: 420, height: 300, style: { rounded: 1, fillColor: "none", strokeColor: "#94a3b8", dashed: 1, whiteSpace: "wrap" }, diagramKinds: ["ARQUITECTURA"] }
    ],
    edges: [
      { id: "c4-sync", label: "Relación síncrona", description: "Relación C4", category: "Relaciones", style: { endArrow: "block", strokeColor: "#64748b", strokeWidth: 1.8 }, diagramKinds: ["ARQUITECTURA"] },
      { id: "c4-async", label: "Relación asíncrona", description: "Relación C4 asíncrona", category: "Relaciones", style: { endArrow: "block", dashed: 1, strokeColor: "#64748b", strokeWidth: 1.8 }, diagramKinds: ["ARQUITECTURA"] }
    ]
  },
  {
    id: "bpmn",
    name: "BPMN",
    section: "BPMN",
    shapes: [
      { id: "bpmn-start", label: "Start Event", description: "Evento de inicio", category: "Eventos", width: 60, height: 60, style: { shape: "ellipse", fillColor: "#ffffff", strokeColor: "#2563eb", strokeWidth: 2 }, diagramKinds: ["BPMN"] },
      { id: "bpmn-task", label: "Task", description: "Actividad", category: "Actividades", width: 180, height: 90, style: { rounded: 1, fillColor: "#ffffff", strokeColor: "#2563eb", whiteSpace: "wrap" }, diagramKinds: ["BPMN"] },
      { id: "bpmn-gateway", label: "Gateway", description: "Compuerta", category: "Control", width: 120, height: 120, style: { shape: "rhombus", fillColor: "#ffffff", strokeColor: "#2563eb", whiteSpace: "wrap" }, diagramKinds: ["BPMN"] },
      { id: "bpmn-end", label: "End Event", description: "Evento de fin", category: "Eventos", width: 60, height: 60, style: { shape: "ellipse", fillColor: "#ffffff", strokeColor: "#ef4444", strokeWidth: 3 }, diagramKinds: ["BPMN"] },
      { id: "bpmn-pool", label: "Pool", description: "Pool BPMN", category: "Swimlanes", width: 420, height: 220, style: { shape: "swimlane", horizontal: 1, startSize: 36, fillColor: "#eff6ff", strokeColor: "#2563eb", whiteSpace: "wrap" }, diagramKinds: ["BPMN"] },
      { id: "bpmn-lane", label: "Lane", description: "Lane BPMN", category: "Swimlanes", width: 420, height: 110, style: { shape: "swimlane", horizontal: 1, startSize: 26, fillColor: "#f8fafc", strokeColor: "#64748b", whiteSpace: "wrap" }, diagramKinds: ["BPMN"] }
    ],
    edges: [
      { id: "bpmn-sequence", label: "Sequence Flow", description: "Flujo de secuencia", category: "Relaciones", style: { endArrow: "block", strokeColor: "#334155", strokeWidth: 1.8 }, diagramKinds: ["BPMN"] }
    ]
  }
];

export const GENERAL_LIBRARY: ShapeLibrary = {
  id: "general",
  name: "General",
  section: "General",
  shapes: baseShapes,
  edges: baseEdges
};

export const BUILTIN_LIBRARIES: ShapeLibrary[] = [GENERAL_LIBRARY, ...diagramSpecificLibraries];

const includesKind = (kind: DiagramKind, templateKinds?: DiagramKind[]) => {
  if (!templateKinds || templateKinds.length === 0) {
    return true;
  }
  return templateKinds.includes(kind);
};

export const getPaletteForKind = (
  kind: DiagramKind,
  remoteLibraries: ShapeLibrary[] = []
): ShapeLibrary[] =>
  [...BUILTIN_LIBRARIES, ...remoteLibraries]
    .map((library) => ({
      ...library,
      shapes: library.shapes.filter((shape) => includesKind(kind, shape.diagramKinds)),
      edges: (library.edges ?? []).filter((edge) => includesKind(kind, edge.diagramKinds))
    }))
    .filter((library) => library.shapes.length > 0 || (library.edges?.length ?? 0) > 0);
