import type { DiagramKind } from "@corelia/types";

export type MaxGraphTheme = {
  primary: string;
  canvasBackgroundLight: string;
  canvasBackgroundDark: string;
  gridColorLight: string;
  gridColorDark: string;
  defaultVertexStyle: Record<string, string | number | boolean>;
  defaultEdgeStyle: Record<string, string | number | boolean>;
};

export const DIAGRAM_THEME_BY_KIND: Record<DiagramKind, MaxGraphTheme> = {
  FLUJO: {
    primary: "#4f6ef7",
    canvasBackgroundLight: "#f8faff",
    canvasBackgroundDark: "#0f172a",
    gridColorLight: "#dde3f0",
    gridColorDark: "#1e293b",
    defaultVertexStyle: {
      rounded: 1,
      fillColor: "#ffffff",
      strokeColor: "#4f6ef7",
      strokeWidth: 1.6,
      fontFamily: "DM Sans",
      fontColor: "#0f172a",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#64748b",
      endArrow: "block",
      strokeWidth: 1.8,
      rounded: 1
    }
  },
  SECUENCIA: {
    primary: "#8b5cf6",
    canvasBackgroundLight: "#fafaf9",
    canvasBackgroundDark: "#111827",
    gridColorLight: "#e5e7eb",
    gridColorDark: "#334155",
    defaultVertexStyle: {
      rounded: 1,
      fillColor: "#ffffff",
      strokeColor: "#8b5cf6",
      fontFamily: "DM Sans",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#0f172a",
      endArrow: "block",
      strokeWidth: 1.8
    }
  },
  UML_CLASES: {
    primary: "#10b981",
    canvasBackgroundLight: "#f0f4f9",
    canvasBackgroundDark: "#0f172a",
    gridColorLight: "#d9e2ec",
    gridColorDark: "#334155",
    defaultVertexStyle: {
      rounded: 0,
      fillColor: "#ffffff",
      strokeColor: "#10b981",
      fontFamily: "DM Sans",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#64748b",
      endArrow: "open",
      strokeWidth: 1.8
    }
  },
  ENTIDAD_RELACION: {
    primary: "#f97316",
    canvasBackgroundLight: "#fff9f0",
    canvasBackgroundDark: "#111827",
    gridColorLight: "#f1dec5",
    gridColorDark: "#374151",
    defaultVertexStyle: {
      rounded: 0,
      fillColor: "#ffffff",
      strokeColor: "#f97316",
      fontFamily: "DM Sans",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#64748b",
      endArrow: "none",
      strokeWidth: 1.8
    }
  },
  ESTADO: {
    primary: "#06b6d4",
    canvasBackgroundLight: "#f0f9ff",
    canvasBackgroundDark: "#0f172a",
    gridColorLight: "#d5edf5",
    gridColorDark: "#334155",
    defaultVertexStyle: {
      rounded: 1,
      arcSize: 20,
      fillColor: "#ffffff",
      strokeColor: "#06b6d4",
      fontFamily: "DM Sans",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#64748b",
      endArrow: "block",
      strokeWidth: 1.8,
      rounded: 1
    }
  },
  ARQUITECTURA: {
    primary: "#1e3a5f",
    canvasBackgroundLight: "#f8faff",
    canvasBackgroundDark: "#0f172a",
    gridColorLight: "#dce6f5",
    gridColorDark: "#334155",
    defaultVertexStyle: {
      rounded: 1,
      fillColor: "#ffffff",
      strokeColor: "#1168BD",
      fontFamily: "DM Sans",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#64748b",
      endArrow: "block",
      strokeWidth: 1.8
    }
  },
  BPMN: {
    primary: "#2563eb",
    canvasBackgroundLight: "#f8faff",
    canvasBackgroundDark: "#0f172a",
    gridColorLight: "#dbeafe",
    gridColorDark: "#1e293b",
    defaultVertexStyle: {
      rounded: 1,
      fillColor: "#ffffff",
      strokeColor: "#2563eb",
      fontFamily: "DM Sans",
      whiteSpace: "wrap"
    },
    defaultEdgeStyle: {
      strokeColor: "#334155",
      endArrow: "block",
      strokeWidth: 1.8
    }
  }
};
