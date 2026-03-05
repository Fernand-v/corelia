"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { DiagramKind } from "@corelia/types";
import * as Y from "yjs";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type Viewport
} from "reactflow";
import { toPng, toSvg } from "html-to-image";

import "reactflow/dist/style.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

type DiagramEngineMode = "EXCALIDRAW" | "REACT_FLOW";

type ReactFlowDiagramState = {
  engine: "REACT_FLOW";
  diagramKind: DiagramKind;
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
};

const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 1
};

const normalizeViewport = (value: unknown): Viewport => {
  if (!value || typeof value !== "object") {
    return DEFAULT_VIEWPORT;
  }

  const source = value as Partial<Viewport>;
  return {
    x: typeof source.x === "number" ? source.x : DEFAULT_VIEWPORT.x,
    y: typeof source.y === "number" ? source.y : DEFAULT_VIEWPORT.y,
    zoom: typeof source.zoom === "number" ? source.zoom : DEFAULT_VIEWPORT.zoom
  };
};

const normalizeNode = (value: unknown, index: number): Node => {
  const source = (value ?? {}) as Partial<Node>;
  const positionSource = (source.position ?? {}) as { x?: unknown; y?: unknown };

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : `n-${index + 1}`,
    type: typeof source.type === "string" ? source.type : undefined,
    position: {
      x: typeof positionSource.x === "number" ? positionSource.x : 160 * index,
      y: typeof positionSource.y === "number" ? positionSource.y : 140
    },
    data:
      source.data && typeof source.data === "object"
        ? source.data
        : { label: `Nodo ${index + 1}` }
  };
};

const normalizeEdge = (value: unknown, index: number): Edge | null => {
  const source = (value ?? {}) as Partial<Edge>;
  if (typeof source.source !== "string" || typeof source.target !== "string") {
    return null;
  }

  const edge: Edge = {
    id: typeof source.id === "string" && source.id.trim() ? source.id : `e-${index + 1}`,
    source: source.source,
    target: source.target,
    ...(typeof source.label === "string" ? { label: source.label } : {}),
    ...(source.animated ? { animated: true } : {}),
    ...(typeof source.type === "string" ? { type: source.type } : {}),
    ...(source.markerEnd ? { markerEnd: source.markerEnd } : {})
  };

  return edge;
};

const createTemplateByKind = (kind: DiagramKind): ReactFlowDiagramState => {
  if (kind === "SECUENCIA") {
    return {
      engine: "REACT_FLOW",
      diagramKind: kind,
      nodes: [
        { id: "n-1", position: { x: 80, y: 70 }, data: { label: "Cliente" } },
        { id: "n-2", position: { x: 320, y: 70 }, data: { label: "API" } },
        { id: "n-3", position: { x: 560, y: 70 }, data: { label: "DB" } }
      ],
      edges: [
        { id: "e-1", source: "n-1", target: "n-2", label: "request" },
        { id: "e-2", source: "n-2", target: "n-3", label: "query" },
        { id: "e-3", source: "n-3", target: "n-2", label: "result" },
        { id: "e-4", source: "n-2", target: "n-1", label: "response" }
      ],
      viewport: DEFAULT_VIEWPORT
    };
  }

  if (kind === "UML_CLASES") {
    return {
      engine: "REACT_FLOW",
      diagramKind: kind,
      nodes: [
        { id: "n-1", position: { x: 80, y: 90 }, data: { label: "Usuario\n- id\n- email" } },
        { id: "n-2", position: { x: 370, y: 90 }, data: { label: "Proyecto\n- id\n- nombre" } }
      ],
      edges: [{ id: "e-1", source: "n-1", target: "n-2", label: "1..*" }],
      viewport: DEFAULT_VIEWPORT
    };
  }

  if (kind === "ENTIDAD_RELACION") {
    return {
      engine: "REACT_FLOW",
      diagramKind: kind,
      nodes: [
        { id: "n-1", position: { x: 80, y: 120 }, data: { label: "USERS" } },
        { id: "n-2", position: { x: 360, y: 120 }, data: { label: "TASKS" } },
        { id: "n-3", position: { x: 640, y: 120 }, data: { label: "PROJECTS" } }
      ],
      edges: [
        { id: "e-1", source: "n-1", target: "n-2", label: "1:N" },
        { id: "e-2", source: "n-3", target: "n-2", label: "1:N" }
      ],
      viewport: DEFAULT_VIEWPORT
    };
  }

  if (kind === "ESTADO") {
    return {
      engine: "REACT_FLOW",
      diagramKind: kind,
      nodes: [
        { id: "n-1", position: { x: 80, y: 140 }, data: { label: "Pendiente" } },
        { id: "n-2", position: { x: 340, y: 140 }, data: { label: "En proceso" } },
        { id: "n-3", position: { x: 600, y: 140 }, data: { label: "Completado" } }
      ],
      edges: [
        { id: "e-1", source: "n-1", target: "n-2" },
        { id: "e-2", source: "n-2", target: "n-3" }
      ],
      viewport: DEFAULT_VIEWPORT
    };
  }

  if (kind === "ARQUITECTURA") {
    return {
      engine: "REACT_FLOW",
      diagramKind: kind,
      nodes: [
        { id: "n-1", position: { x: 80, y: 120 }, data: { label: "Frontend" } },
        { id: "n-2", position: { x: 360, y: 120 }, data: { label: "Backend" } },
        { id: "n-3", position: { x: 640, y: 120 }, data: { label: "Base de Datos" } }
      ],
      edges: [
        { id: "e-1", source: "n-1", target: "n-2" },
        { id: "e-2", source: "n-2", target: "n-3" }
      ],
      viewport: DEFAULT_VIEWPORT
    };
  }

  if (kind === "BPMN") {
    return {
      engine: "REACT_FLOW",
      diagramKind: kind,
      nodes: [
        { id: "n-1", position: { x: 80, y: 130 }, data: { label: "Inicio" } },
        { id: "n-2", position: { x: 320, y: 130 }, data: { label: "Tarea" } },
        { id: "n-3", position: { x: 560, y: 130 }, data: { label: "Fin" } }
      ],
      edges: [
        { id: "e-1", source: "n-1", target: "n-2" },
        { id: "e-2", source: "n-2", target: "n-3" }
      ],
      viewport: DEFAULT_VIEWPORT
    };
  }

  return {
    engine: "REACT_FLOW",
    diagramKind: kind,
    nodes: [
      { id: "n-1", position: { x: 80, y: 130 }, data: { label: "Inicio" } },
      { id: "n-2", position: { x: 360, y: 130 }, data: { label: "Proceso" } },
      { id: "n-3", position: { x: 640, y: 130 }, data: { label: "Fin" } }
    ],
    edges: [
      { id: "e-1", source: "n-1", target: "n-2" },
      { id: "e-2", source: "n-2", target: "n-3" }
    ],
    viewport: DEFAULT_VIEWPORT
  };
};

const parseScene = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as {
      elements?: readonly unknown[];
      appState?: Record<string, unknown>;
      files?: Record<string, unknown>;
    };
  } catch {
    return null;
  }
};

const parseReactFlowState = (value: string, diagramKind: DiagramKind): ReactFlowDiagramState => {
  if (!value.trim()) {
    return createTemplateByKind(diagramKind);
  }

  try {
    const parsed = JSON.parse(value) as Partial<ReactFlowDiagramState> & {
      nodes?: unknown[];
      edges?: unknown[];
      viewport?: unknown;
      diagramKind?: DiagramKind;
    };

    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return createTemplateByKind(diagramKind);
    }

    return {
      engine: "REACT_FLOW",
      diagramKind: parsed.diagramKind ?? diagramKind,
      nodes: parsed.nodes.map((node, index) => normalizeNode(node, index)),
      edges: parsed.edges
        .map((edge, index) => normalizeEdge(edge, index))
        .filter((edge): edge is Edge => Boolean(edge)),
      viewport: normalizeViewport(parsed.viewport)
    };
  } catch {
    return createTemplateByKind(diagramKind);
  }
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
};

export const DocumentsEditorDiagram = ({
  documentId,
  value,
  readOnly,
  provider,
  diagramEngine,
  diagramKind,
  onChange
}: {
  documentId: string;
  value: string;
  readOnly: boolean;
  provider?: HocuspocusProvider | null;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  diagramEngine?: "EXCALIDRAW" | "REACT_FLOW" | null;
  diagramKind?: DiagramKind | null;
  onChange: (value: string) => void;
}) => {
  const fallbackDocRef = useRef<Y.Doc | null>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const engine: DiagramEngineMode = diagramEngine === "REACT_FLOW" ? "REACT_FLOW" : "EXCALIDRAW";
  const kind = diagramKind ?? "FLUJO";

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const yText = useMemo(() => yDoc.getText(`doc:${documentId}:diagram`), [documentId, yDoc]);
  const apiRef = useRef<any>(null);
  const applyingRemoteRef = useRef(false);
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);

  const [scenePayload, setScenePayload] = useState<string>(() => value || yText.toString());
  const [flowState, setFlowState] = useState<ReactFlowDiagramState>(() =>
    parseReactFlowState(value || yText.toString(), kind)
  );

  const persistPayload = useCallback(
    (payload: string) => {
      onChange(payload);
      applyingRemoteRef.current = true;
      yText.delete(0, yText.length);
      yText.insert(0, payload);
      applyingRemoteRef.current = false;
    },
    [onChange, yText]
  );

  const persistFlowState = useCallback(
    (nextState: ReactFlowDiagramState) => {
      setFlowState(nextState);
      persistPayload(JSON.stringify(nextState));
    },
    [persistPayload]
  );

  useEffect(() => {
    if (!yText.toString() && value.trim()) {
      yText.insert(0, value);
    }
  }, [value, yText]);

  useEffect(() => {
    const syncFromYjs = () => {
      if (applyingRemoteRef.current) {
        return;
      }

      const nextValue = yText.toString();
      if (engine === "EXCALIDRAW") {
        setScenePayload(nextValue);
        const parsed = parseScene(nextValue);
        if (parsed && apiRef.current) {
          apiRef.current.updateScene(parsed);
        }
        return;
      }

      setFlowState(parseReactFlowState(nextValue, kind));
    };

    yText.observe(syncFromYjs);
    return () => {
      yText.unobserve(syncFromYjs);
    };
  }, [engine, kind, yText]);

  useEffect(() => {
    if (!value.trim()) {
      return;
    }

    if (engine === "EXCALIDRAW") {
      if (value === scenePayload) {
        return;
      }

      setScenePayload(value);
      const parsed = parseScene(value);
      if (parsed && apiRef.current) {
        apiRef.current.updateScene(parsed);
      }
      return;
    }

    setFlowState(parseReactFlowState(value, kind));
  }, [engine, kind, scenePayload, value]);

  const initialData = useMemo(() => {
    const parsed = parseScene(scenePayload);
    return parsed ?? { elements: [] };
  }, [scenePayload]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) {
        return;
      }

      persistFlowState({
        ...flowState,
        nodes: applyNodeChanges(changes, flowState.nodes)
      });
    },
    [flowState, persistFlowState, readOnly]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) {
        return;
      }

      persistFlowState({
        ...flowState,
        edges: applyEdgeChanges(changes, flowState.edges)
      });
    },
    [flowState, persistFlowState, readOnly]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) {
        return;
      }

      persistFlowState({
        ...flowState,
        edges: addEdge(connection, flowState.edges)
      });
    },
    [flowState, persistFlowState, readOnly]
  );

  const addNode = () => {
    if (readOnly) {
      return;
    }

    const id = `n-${Date.now()}`;
    persistFlowState({
      ...flowState,
      nodes: [
        ...flowState.nodes,
        {
          id,
          position: {
            x: 120 + flowState.nodes.length * 60,
            y: 120 + (flowState.nodes.length % 4) * 70
          },
          data: {
            label: `Nodo ${flowState.nodes.length + 1}`
          }
        }
      ]
    });
  };

  const exportPng = async () => {
    if (!flowWrapperRef.current) {
      return;
    }

    const dataUrl = await toPng(flowWrapperRef.current, {
      cacheBust: true,
      backgroundColor: "#ffffff"
    });
    downloadDataUrl(dataUrl, `${documentId}.png`);
  };

  const exportSvg = async () => {
    if (!flowWrapperRef.current) {
      return;
    }

    const dataUrl = await toSvg(flowWrapperRef.current, {
      cacheBust: true,
      backgroundColor: "#ffffff"
    });
    downloadDataUrl(dataUrl, `${documentId}.svg`);
  };

  if (engine === "EXCALIDRAW") {
    return (
      <div className="h-full min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Excalidraw
          initialData={initialData as any}
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          viewModeEnabled={readOnly}
          onChange={(elements, appState, files) => {
            if (readOnly) {
              return;
            }

            const payload = JSON.stringify({ elements, appState, files });
            setScenePayload(payload);
            persistPayload(payload);
          }}
        />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-full min-h-[520px] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">React Flow · Tipo: {kind.replaceAll("_", " ")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addNode}
              disabled={readOnly}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Nodo
            </button>
            <button
              type="button"
              onClick={() => {
                void exportPng();
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              Exportar PNG
            </button>
            <button
              type="button"
              onClick={() => {
                void exportSvg();
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              Exportar SVG
            </button>
          </div>
        </div>

        <div
          ref={flowWrapperRef}
          className="h-[520px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <ReactFlow
            nodes={flowState.nodes}
            edges={flowState.edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onMoveEnd={(_, viewport) => {
              if (readOnly) {
                return;
              }

              persistFlowState({
                ...flowState,
                viewport
              });
            }}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            minZoom={0.2}
            maxZoom={2}
            nodesConnectable={!readOnly}
            nodesDraggable={!readOnly}
            elementsSelectable
            defaultViewport={flowState.viewport}
            panOnDrag
          >
            <MiniMap />
            <Controls />
            <Background gap={20} />
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  );
};
