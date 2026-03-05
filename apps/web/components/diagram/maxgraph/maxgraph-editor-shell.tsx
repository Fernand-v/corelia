"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { DiagramKind } from "@corelia/types";
import {
  Clipboard,
  Graph,
  InternalEvent,
  Outline,
  UndoManager,
  type AbstractGraph,
  type Cell,
  type EventObject
} from "@maxgraph/core";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";

import { MaxGraphContextMenu, type MaxGraphContextMenuState } from "@/components/diagram/maxgraph/maxgraph-context-menu";
import { MaxGraphPalette, loadPaletteSectionState, persistPaletteSectionState } from "@/components/diagram/maxgraph/maxgraph-palette";
import { MaxGraphPagesTabs } from "@/components/diagram/maxgraph/maxgraph-pages-tabs";
import {
  MaxGraphPropertiesPanel,
  type SelectedCellView
} from "@/components/diagram/maxgraph/maxgraph-properties-panel";
import {
  MaxGraphStyleEditorModal,
  styleObjectToString
} from "@/components/diagram/maxgraph/maxgraph-style-editor-modal";
import {
  MaxGraphTemplatesModal,
  type DiagramTemplatePreset
} from "@/components/diagram/maxgraph/maxgraph-templates-modal";
import { MaxGraphToolbar } from "@/components/diagram/maxgraph/maxgraph-toolbar";
import type {
  ActiveTool,
  CanvasMode,
  GraphToolbarActions,
  GraphToolbarState,
  GridMode,
  RemoteCursorPresence
} from "@/components/diagram/maxgraph/types";
import {
  getPaletteForKind,
  type EdgeTemplate,
  type ShapeLibrary,
  type ShapeTemplate
} from "@/lib/diagram/maxgraph/palette-catalog";
import {
  fitGraph,
  getViewportCenter,
  insertShapeTemplate,
  moveCellToCenter,
  resetView,
  zoomToPercent
} from "@/lib/diagram/maxgraph/shape-factory";
import { loadRemoteStencilLibraries } from "@/lib/diagram/maxgraph/stencil-loader";
import { DIAGRAM_THEME_BY_KIND } from "@/lib/diagram/maxgraph/themes";
import {
  createEmptyDrawioDocument,
  ensureDocumentIntegrity,
  serializeMxfile,
  type DrawioDocument
} from "@/lib/diagram/maxgraph/xml-format";
import {
  addPage,
  duplicatePage,
  getActivePage,
  removePage,
  renamePage,
  setActivePage,
  updatePageXml
} from "@/lib/diagram/maxgraph/xml-pages";
import {
  exportGraphModelXml,
  importGraphModelXml,
  parseDiagramSource
} from "@/lib/diagram/maxgraph/xml-serializer";

const AWARENESS_KEY = "diagram-maxgraph-presence";

const backgroundByMode = (
  canvasMode: CanvasMode,
  gridMode: GridMode,
  kind: DiagramKind
): React.CSSProperties => {
  const theme = DIAGRAM_THEME_BY_KIND[kind];

  if (gridMode === "none") {
    return {
      background: canvasMode === "light" ? theme.canvasBackgroundLight : theme.canvasBackgroundDark
    };
  }

  if (gridMode === "lines") {
    const color = canvasMode === "light" ? theme.gridColorLight : theme.gridColorDark;
    return {
      backgroundColor:
        canvasMode === "light" ? theme.canvasBackgroundLight : theme.canvasBackgroundDark,
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: "16px 16px"
    };
  }

  const color = canvasMode === "light" ? theme.gridColorLight : theme.gridColorDark;
  return {
    backgroundColor: canvasMode === "light" ? theme.canvasBackgroundLight : theme.canvasBackgroundDark,
    backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
    backgroundSize: "16px 16px"
  };
};

const stringifyValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const parseMeta = (style: Record<string, unknown>): Array<{ key: string; value: string }> => {
  const raw = style.meta;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Array<{ key: string; value: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item.key === "string").map((item) => ({
      key: item.key,
      value: typeof item.value === "string" ? item.value : ""
    }));
  } catch {
    return [];
  }
};

const encodeMeta = (items: Array<{ key: string; value: string }>): string =>
  encodeURIComponent(JSON.stringify(items.filter((item) => item.key.trim().length > 0)));

const toStyleRecord = (style: unknown): Record<string, unknown> => {
  if (!style || typeof style !== "object") {
    return {};
  }

  return { ...(style as Record<string, unknown>) };
};

const buildSelectedCellView = (
  graph: AbstractGraph | null,
  document: DrawioDocument
): SelectedCellView => {
  if (!graph) {
    return {
      type: "none",
      id: null,
      label: "",
      style: {},
      geometry: null,
      connections: [],
      metadata: [],
      diagramInfo: {
        totalCells: 0,
        totalVertices: 0,
        totalEdges: 0,
        pageName: getActivePage(document)?.name ?? ""
      }
    };
  }

  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const edges = graph.getChildEdges(parent);
  const selectedCell = graph.getSelectionCell();

  if (!selectedCell) {
    return {
      type: "none",
      id: null,
      label: "",
      style: {},
      geometry: null,
      connections: [],
      metadata: [],
      diagramInfo: {
        totalCells: vertices.length + edges.length,
        totalVertices: vertices.length,
        totalEdges: edges.length,
        pageName: getActivePage(document)?.name ?? ""
      }
    };
  }

  const style = toStyleRecord(selectedCell.getStyle());
  const geometry = selectedCell.getGeometry();
  const label = stringifyValue(selectedCell.getValue());

  const connections = selectedCell.isVertex()
    ? [
        ...graph.getIncomingEdges(selectedCell, null).map((edge) => ({
          id: edge.getId() ?? "",
          label: stringifyValue(edge.getValue()) || edge.getId() || "edge",
          direction: "in" as const
        })),
        ...graph.getOutgoingEdges(selectedCell, null).map((edge) => ({
          id: edge.getId() ?? "",
          label: stringifyValue(edge.getValue()) || edge.getId() || "edge",
          direction: "out" as const
        }))
      ]
    : [];

  return {
    type: selectedCell.isEdge() ? "edge" : "vertex",
    id: selectedCell.getId(),
    label,
    style,
    geometry: geometry
      ? {
          x: geometry.x ?? 0,
          y: geometry.y ?? 0,
          width: geometry.width ?? 0,
          height: geometry.height ?? 0
        }
      : null,
    connections,
    metadata: parseMeta(style),
    diagramInfo: {
      totalCells: vertices.length + edges.length,
      totalVertices: vertices.length,
      totalEdges: edges.length,
      pageName: getActivePage(document)?.name ?? ""
    }
  };
};

const applyThemeToGraph = (graph: AbstractGraph, kind: DiagramKind) => {
  const theme = DIAGRAM_THEME_BY_KIND[kind];
  graph.getStylesheet().putCellStyle("defaultVertex", theme.defaultVertexStyle as any);
  graph.getStylesheet().putCellStyle("defaultEdge", theme.defaultEdgeStyle as any);
};

const cloneStyle = (style: Record<string, unknown>): Record<string, unknown> => ({ ...style });

export const MaxGraphEditorShell = ({
  documentId,
  value,
  readOnly,
  provider,
  currentUser,
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
  diagramKind?: DiagramKind | null;
  onChange: (value: string) => void;
}) => {
  const fallbackKind = diagramKind ?? "FLUJO";

  const fallbackDocRef = useRef<any>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const yText = useMemo(() => yDoc.getText(`doc:${documentId}:diagram`), [documentId, yDoc]);

  const initialPayload = value.trim() || yText.toString().trim();
  const initialParsed = useMemo(
    () => parseDiagramSource(initialPayload, fallbackKind),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [currentKind, setCurrentKind] = useState<DiagramKind>(fallbackKind);
  const [drawioDocument, setDrawioDocument] = useState<DrawioDocument>(
    ensureDocumentIntegrity(initialParsed.document, fallbackKind)
  );
  const drawioDocumentRef = useRef<DrawioDocument>(
    ensureDocumentIntegrity(initialParsed.document, fallbackKind)
  );

  const [selectedCell, setSelectedCell] = useState<SelectedCellView>(() => ({
    type: "none",
    id: null,
    label: "",
    style: {},
    geometry: null,
    connections: [],
    metadata: [],
    diagramInfo: {
      totalCells: 0,
      totalVertices: 0,
      totalEdges: 0,
      pageName: getActivePage(drawioDocumentRef.current)?.name ?? ""
    }
  }));

  const [canvasMode, setCanvasMode] = useState<CanvasMode>("light");
  const [gridMode, setGridMode] = useState<GridMode>("dots");
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guidesEnabled, setGuidesEnabled] = useState(true);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [remoteLibraries, setRemoteLibraries] = useState<ShapeLibrary[]>([]);
  const [selectedEdgeTemplateId, setSelectedEdgeTemplateId] = useState<string | null>(null);
  const [remotePresence, setRemotePresence] = useState<RemoteCursorPresence[]>([]);
  const [remoteSelectionBoxes, setRemoteSelectionBoxes] = useState<
    Array<{ id: string; x: number; y: number; width: number; height: number; color: string; name: string }>
  >([]);

  const [contextMenu, setContextMenu] = useState<MaxGraphContextMenuState>({ open: false, x: 0, y: 0 });
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const applyingRemoteRef = useRef(false);
  const lastSyncedPayloadRef = useRef("");
  const needsMigrationPersistRef = useRef(initialParsed.migratedFromLegacy);
  const copiedStyleRef = useRef<Record<string, unknown> | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const outlineContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const graphRef = useRef<AbstractGraph | null>(null);
  const outlineRef = useRef<Outline | null>(null);
  const undoManagerRef = useRef<UndoManager | null>(null);

  const allLibraries = useMemo(
    () => getPaletteForKind(currentKind, remoteLibraries),
    [currentKind, remoteLibraries]
  );

  const shapeTemplateIndex = useMemo(() => {
    const index = new Map<string, ShapeTemplate>();
    allLibraries.forEach((library) => {
      library.shapes.forEach((shape) => index.set(shape.id, shape));
    });
    return index;
  }, [allLibraries]);

  const edgeTemplateIndex = useMemo(() => {
    const index = new Map<string, EdgeTemplate>();
    allLibraries.forEach((library) => {
      (library.edges ?? []).forEach((edge) => index.set(edge.id, edge));
    });
    return index;
  }, [allLibraries]);

  const selectedEdgeTemplate = useMemo(() => {
    if (!selectedEdgeTemplateId) {
      return edgeTemplateIndex.values().next().value ?? null;
    }
    return edgeTemplateIndex.get(selectedEdgeTemplateId) ?? edgeTemplateIndex.values().next().value ?? null;
  }, [edgeTemplateIndex, selectedEdgeTemplateId]);

  const syncPayload = useCallback(
    (payload: string) => {
      lastSyncedPayloadRef.current = payload;
      onChange(payload);
      applyingRemoteRef.current = true;
      yText.delete(0, yText.length);
      yText.insert(0, payload);
      applyingRemoteRef.current = false;
    },
    [onChange, yText]
  );

  const refreshSelectedState = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    setSelectedCell(buildSelectedCellView(graph, drawioDocumentRef.current));
  }, []);

  const refreshRemoteSelectionBoxes = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const boxes: Array<{ id: string; x: number; y: number; width: number; height: number; color: string; name: string }> = [];

    for (const peer of remotePresence) {
      const selectedCellIds = Array.isArray(peer.selectedCellIds) ? peer.selectedCellIds : [];
      selectedCellIds.forEach((cellId) => {
        const cell = graph.getDataModel().getCell(cellId);
        if (!cell) {
          return;
        }

        const state = graph.getView().getState(cell);
        if (!state) {
          return;
        }

        boxes.push({
          id: `${peer.userId}:${cellId}`,
          x: state.x,
          y: state.y,
          width: Math.max(0, state.width),
          height: Math.max(0, state.height),
          color: peer.color,
          name: peer.name
        });
      });
    }

    setRemoteSelectionBoxes(boxes);
  }, [remotePresence]);

  const commitDocument = useCallback(
    (
      updater: (current: DrawioDocument) => DrawioDocument,
      options?: {
        sync?: boolean;
        importActivePage?: boolean;
      }
    ) => {
      const sync = options?.sync !== false;
      const importActivePage = options?.importActivePage === true;

      const next = ensureDocumentIntegrity(updater(drawioDocumentRef.current), currentKind);
      drawioDocumentRef.current = next;
      setDrawioDocument(next);

      if (importActivePage && graphRef.current) {
        const active = getActivePage(next);
        if (active) {
          applyingRemoteRef.current = true;
          importGraphModelXml(graphRef.current, active.xml);
          applyingRemoteRef.current = false;
          refreshSelectedState();
        }
      }

      if (sync) {
        syncPayload(serializeMxfile(next));
      }
    },
    [currentKind, refreshSelectedState, syncPayload]
  );

  const saveCurrentPageSnapshot = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const activePage = getActivePage(drawioDocumentRef.current);
    if (!activePage) {
      return;
    }

    const modelXml = exportGraphModelXml(graph);
    drawioDocumentRef.current = updatePageXml(drawioDocumentRef.current, activePage.id, modelXml);
    setDrawioDocument(drawioDocumentRef.current);
  }, []);

  const applyToolMode = useCallback(
    (tool: ActiveTool) => {
      const graph = graphRef.current;
      if (!graph) {
        return;
      }

      setActiveTool(tool);
      const panningHandler = (graph as any).panningHandler;

      if (tool === "pan") {
        graph.setPanning(true);
        if (panningHandler) {
          panningHandler.useLeftButtonForPanning = true;
          panningHandler.panningEnabled = true;
        }
        return;
      }

      if (tool === "connect") {
        graph.setConnectable(!readOnly);
        if (panningHandler) {
          panningHandler.useLeftButtonForPanning = false;
        }
        return;
      }

      if (tool === "text") {
        if (panningHandler) {
          panningHandler.useLeftButtonForPanning = false;
        }
        return;
      }

      if (panningHandler) {
        panningHandler.useLeftButtonForPanning = false;
      }
    },
    [readOnly]
  );

  const updateLocalAwareness = useCallback(
    (patch: Partial<RemoteCursorPresence>) => {
      const awareness = provider?.awareness;
      if (!awareness || !currentUser.id) {
        return;
      }

      const previous = (awareness.getLocalState()?.[AWARENESS_KEY] as RemoteCursorPresence | undefined) ?? {
        documentId,
        pageId: drawioDocumentRef.current.activePageId,
        userId: currentUser.id,
        name: currentUser.name,
        color: currentUser.color
      };

      awareness.setLocalStateField(AWARENESS_KEY, {
        ...previous,
        documentId,
        pageId: drawioDocumentRef.current.activePageId,
        userId: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        ...patch
      });
    },
    [currentUser.color, currentUser.id, currentUser.name, documentId, provider?.awareness]
  );

  useEffect(() => {
    if (!yText.toString() && value.trim()) {
      yText.insert(0, value);
    }
  }, [value, yText]);

  useEffect(() => {
    const graphContainer = graphContainerRef.current;
    if (!graphContainer || graphRef.current) {
      return;
    }

    const graph = new Graph(graphContainer);
    graphRef.current = graph;

    applyThemeToGraph(graph, currentKind);

    graph.setConnectable(!readOnly);
    graph.setMultigraph(false);
    graph.setAllowDanglingEdges(false);
    graph.setEdgeLabelsMovable(true);
    graph.setVertexLabelsMovable(false);
    graph.setCellsEditable(!readOnly);
    graph.setTooltips(true);
    graph.setPanning(true);
    graph.setAutoSizeCells(true);
    graph.gridSize = 16;
    graph.setGridEnabled(true);

    const graphHandler = (graph as any).graphHandler;
    if (graphHandler) {
      graphHandler.guidesEnabled = true;
    }

    const undoManager = new UndoManager(200);
    undoManagerRef.current = undoManager;

    const undoListener = (_sender: unknown, evt: EventObject) => {
      const edit = evt.getProperty("edit");
      if (edit) {
        undoManager.undoableEditHappened(edit);
      }
    };

    graph.getDataModel().addListener(InternalEvent.UNDO, undoListener);
    graph.getView().addListener(InternalEvent.UNDO, undoListener);

    const modelChangeListener = () => {
      if (applyingRemoteRef.current) {
        return;
      }

      const activePage = getActivePage(drawioDocumentRef.current);
      if (!activePage) {
        return;
      }

      const modelXml = exportGraphModelXml(graph);
      const updated = updatePageXml(drawioDocumentRef.current, activePage.id, modelXml);
      drawioDocumentRef.current = updated;
      setDrawioDocument(updated);
      syncPayload(serializeMxfile(updated));
      refreshSelectedState();
      refreshRemoteSelectionBoxes();
    };

    const selectionListener = () => {
      refreshSelectedState();
      const selectedIds = graph
        .getSelectionCells()
        .map((cell) => cell.getId())
        .filter((value): value is string => Boolean(value));
      updateLocalAwareness({ selectedCellIds: selectedIds });
      refreshRemoteSelectionBoxes();
    };

    const viewListener = () => {
      setZoomPercent(Math.round(graph.getView().scale * 100));
      refreshRemoteSelectionBoxes();
    };

    graph.getDataModel().addListener(InternalEvent.CHANGE, modelChangeListener);
    graph.getSelectionModel().addListener(InternalEvent.CHANGE, selectionListener);
    graph.getView().addListener(InternalEvent.SCALE, viewListener);
    graph.getView().addListener(InternalEvent.TRANSLATE, viewListener);

    if (outlineContainerRef.current) {
      outlineRef.current = new Outline(graph, outlineContainerRef.current);
      outlineRef.current.updateOnPan = true;
    }

    const active = getActivePage(drawioDocumentRef.current);
    if (active) {
      applyingRemoteRef.current = true;
      importGraphModelXml(graph, active.xml);
      applyingRemoteRef.current = false;
    }

    refreshSelectedState();
    setZoomPercent(Math.round(graph.getView().scale * 100));

    if (needsMigrationPersistRef.current) {
      needsMigrationPersistRef.current = false;
      syncPayload(serializeMxfile(drawioDocumentRef.current));
    }

    return () => {
      graph.getDataModel().removeListener(undoListener);
      graph.getView().removeListener(undoListener);
      graph.getDataModel().removeListener(modelChangeListener);
      graph.getSelectionModel().removeListener(selectionListener);
      graph.getView().removeListener(viewListener);

      outlineRef.current?.destroy();
      outlineRef.current = null;

      graph.destroy();
      graphRef.current = null;
    };
  }, [
    currentKind,
    readOnly,
    refreshRemoteSelectionBoxes,
    refreshSelectedState,
    syncPayload,
    updateLocalAwareness
  ]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.setCellsEditable(!readOnly);
    graph.setConnectable(!readOnly);
  }, [readOnly]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    applyThemeToGraph(graph, currentKind);
  }, [currentKind]);

  useEffect(() => {
    const syncFromY = () => {
      if (applyingRemoteRef.current) {
        return;
      }

      const payload = yText.toString().trim();
      if (!payload || payload === lastSyncedPayloadRef.current) {
        return;
      }

      const parsed = parseDiagramSource(payload, currentKind);
      const normalized = ensureDocumentIntegrity(parsed.document, currentKind);

      lastSyncedPayloadRef.current = payload;
      drawioDocumentRef.current = normalized;
      setDrawioDocument(normalized);

      const graph = graphRef.current;
      if (graph) {
        const active = getActivePage(normalized);
        if (active) {
          applyingRemoteRef.current = true;
          importGraphModelXml(graph, active.xml);
          applyingRemoteRef.current = false;
        }
        refreshSelectedState();
      }
    };

    yText.observe(syncFromY);
    return () => {
      yText.unobserve(syncFromY);
    };
  }, [currentKind, refreshSelectedState, yText]);

  useEffect(() => {
    const payload = value.trim();
    if (!payload || payload === lastSyncedPayloadRef.current || provider) {
      return;
    }

    const parsed = parseDiagramSource(payload, currentKind);
    const normalized = ensureDocumentIntegrity(parsed.document, currentKind);
    lastSyncedPayloadRef.current = payload;
    drawioDocumentRef.current = normalized;
    setDrawioDocument(normalized);

    const graph = graphRef.current;
    if (graph) {
      const active = getActivePage(normalized);
      if (active) {
        applyingRemoteRef.current = true;
        importGraphModelXml(graph, active.xml);
        applyingRemoteRef.current = false;
      }
      refreshSelectedState();
    }
  }, [currentKind, provider, refreshSelectedState, value]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    void loadRemoteStencilLibraries(currentKind, controller.signal).then((libraries) => {
      if (!active) {
        return;
      }
      setRemoteLibraries(libraries);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentKind]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    allLibraries.forEach((library) => {
      const sectionId = `${library.section}:${library.id}`;
      next[sectionId] = loadPaletteSectionState(sectionId);
    });
    setCollapsedSections(next);
  }, [allLibraries]);

  useEffect(() => {
    setSelectedEdgeTemplateId((current) => {
      if (current && edgeTemplateIndex.has(current)) {
        return current;
      }

      const first = edgeTemplateIndex.values().next().value;
      return first?.id ?? null;
    });
  }, [edgeTemplateIndex]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedEdgeTemplate) {
      return;
    }
    graph.getStylesheet().putCellStyle("defaultEdge", selectedEdgeTemplate.style as any);
  }, [selectedEdgeTemplate]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.setGridEnabled(snapEnabled);
  }, [snapEnabled]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const graphHandler = (graph as any).graphHandler;
    if (graphHandler) {
      graphHandler.guidesEnabled = guidesEnabled;
    }
  }, [guidesEnabled]);

  useEffect(() => {
    outlineRef.current?.setEnabled(minimapEnabled);
  }, [minimapEnabled]);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      setRemotePresence([]);
      return;
    }

    const refresh = () => {
      const peers: RemoteCursorPresence[] = [];
      awareness.getStates().forEach((state: any) => {
        const payload = state?.[AWARENESS_KEY] as RemoteCursorPresence | undefined;
        if (!payload || payload.documentId !== documentId || payload.userId === currentUser.id) {
          return;
        }

        peers.push(payload);
      });
      setRemotePresence(peers);
    };

    refresh();
    awareness.on("change", refresh);

    return () => {
      awareness.off("change", refresh);
    };
  }, [currentUser.id, documentId, provider?.awareness]);

  useEffect(() => {
    refreshRemoteSelectionBoxes();
  }, [refreshRemoteSelectionBoxes]);

  useEffect(() => {
    const graphContainer = graphContainerRef.current;
    if (!graphContainer) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const rect = graphContainer.getBoundingClientRect();
      updateLocalAwareness({
        cursor: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        }
      });
    };

    const onMouseLeave = () => {
      updateLocalAwareness({ cursor: null });
    };

    graphContainer.addEventListener("mousemove", onMouseMove);
    graphContainer.addEventListener("mouseleave", onMouseLeave);

    return () => {
      graphContainer.removeEventListener("mousemove", onMouseMove);
      graphContainer.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [updateLocalAwareness]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();

      const rect = graphContainerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const pt = graph.getPointForEvent(event);
      const cell = graph.getCellAt(pt.x, pt.y);
      if (cell) {
        graph.setSelectionCell(cell);
      }

      setContextMenu({
        open: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    };

    const container = graphContainerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("contextmenu", onContextMenu);
    return () => {
      container.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((current) => {
      const next = !current[sectionId];
      persistPaletteSectionState(sectionId, next);
      return {
        ...current,
        [sectionId]: next
      };
    });
  }, []);

  const insertShape = useCallback(
    (template: ShapeTemplate) => {
      if (readOnly) {
        return;
      }
      const graph = graphRef.current;
      if (!graph) {
        return;
      }

      insertShapeTemplate(graph, template, {
        container: graphContainerRef.current
      });

      refreshSelectedState();
    },
    [readOnly, refreshSelectedState]
  );

  const onCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (readOnly) {
        return;
      }

      const graph = graphRef.current;
      if (!graph) {
        return;
      }

      const payloadRaw = event.dataTransfer.getData("application/corelia-maxgraph-template");
      if (!payloadRaw) {
        return;
      }

      try {
        const parsed = JSON.parse(payloadRaw) as { templateId: string; kind: "shape" };
        const template = shapeTemplateIndex.get(parsed.templateId);
        if (!template) {
          return;
        }

        insertShapeTemplate(graph, template, {
          screenPoint: {
            x: event.clientX - (graphContainerRef.current?.getBoundingClientRect().left ?? 0),
            y: event.clientY - (graphContainerRef.current?.getBoundingClientRect().top ?? 0)
          }
        });
      } catch {
        return;
      }

      refreshSelectedState();
    },
    [readOnly, refreshSelectedState, shapeTemplateIndex]
  );

  const onDoubleClickCanvas = useCallback(() => {
    if (readOnly || activeTool !== "text") {
      return;
    }

    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const center = graphContainerRef.current
      ? getViewportCenter(graph, graphContainerRef.current)
      : { x: 120, y: 120 };

    graph.batchUpdate(() => {
      graph.insertVertex({
        parent: graph.getDefaultParent(),
        value: "Texto",
        position: [center.x - 80, center.y - 20],
        size: [160, 40],
        style: {
          rounded: 1,
          fillColor: "#ffffff",
          strokeColor: "#94a3b8",
          whiteSpace: "wrap",
          fontSize: 14,
          fontFamily: "DM Sans"
        } as any
      });
    });

    refreshSelectedState();
  }, [activeTool, readOnly, refreshSelectedState]);

  const withSelectedCell = useCallback(
    <T,>(fn: (graph: AbstractGraph, cell: Cell) => T): T | null => {
      const graph = graphRef.current;
      if (!graph) {
        return null;
      }

      const cell = graph.getSelectionCell();
      if (!cell) {
        return null;
      }

      return fn(graph, cell);
    },
    []
  );

  const onLabelChange = useCallback(
    (nextValue: string) => {
      if (readOnly) {
        return;
      }

      withSelectedCell((graph, cell) => {
        graph.batchUpdate(() => {
          graph.getDataModel().setValue(cell, nextValue);
        });
      });
    },
    [readOnly, withSelectedCell]
  );

  const onStylePatch = useCallback(
    (patch: Record<string, string | number | boolean>) => {
      if (readOnly) {
        return;
      }

      withSelectedCell((graph, cell) => {
        Object.entries(patch).forEach(([key, value]) => {
          graph.setCellStyles(key as any, value as any, [cell]);
        });
      });
    },
    [readOnly, withSelectedCell]
  );

  const onReplaceStyle = useCallback(
    (style: Record<string, string>) => {
      if (readOnly) {
        return;
      }

      withSelectedCell((graph, cell) => {
        graph.batchUpdate(() => {
          graph.getDataModel().setStyle(cell, style as any);
        });
      });

      setStyleEditorOpen(false);
    },
    [readOnly, withSelectedCell]
  );

  const onGeometryPatch = useCallback(
    (patch: Partial<{ x: number; y: number; width: number; height: number }>) => {
      if (readOnly) {
        return;
      }

      withSelectedCell((graph, cell) => {
        const geometry = cell.getGeometry();
        if (!geometry) {
          return;
        }

        const next = geometry.clone();
        if (typeof patch.x === "number") {
          next.x = graph.snap(patch.x);
        }
        if (typeof patch.y === "number") {
          next.y = graph.snap(patch.y);
        }
        if (typeof patch.width === "number") {
          next.width = Math.max(10, patch.width);
        }
        if (typeof patch.height === "number") {
          next.height = Math.max(10, patch.height);
        }

        graph.batchUpdate(() => {
          graph.getDataModel().setGeometry(cell, next);
        });
      });
    },
    [readOnly, withSelectedCell]
  );

  const onCenterCell = useCallback(() => {
    if (readOnly) {
      return;
    }

    withSelectedCell((graph, cell) => {
      if (!graphContainerRef.current) {
        return;
      }
      moveCellToCenter(graph, cell, graphContainerRef.current);
    });
  }, [readOnly, withSelectedCell]);

  const onHighlightConnection = useCallback((edgeId: string) => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const edge = graph.getDataModel().getCell(edgeId);
    if (!edge) {
      return;
    }

    graph.setSelectionCell(edge);
  }, []);

  const onDeleteConnection = useCallback(
    (edgeId: string) => {
      if (readOnly) {
        return;
      }

      const graph = graphRef.current;
      if (!graph) {
        return;
      }

      const edge = graph.getDataModel().getCell(edgeId);
      if (!edge) {
        return;
      }

      graph.removeCells([edge]);
    },
    [readOnly]
  );

  const onAddMetadata = useCallback(() => {
    const metadata = [...selectedCell.metadata, { key: "", value: "" }];
    onStylePatch({ meta: encodeMeta(metadata) });
  }, [onStylePatch, selectedCell.metadata]);

  const onUpdateMetadata = useCallback(
    (index: number, patch: Partial<{ key: string; value: string }>) => {
      const metadata = selectedCell.metadata.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      );
      onStylePatch({ meta: encodeMeta(metadata) });
    },
    [onStylePatch, selectedCell.metadata]
  );

  const onRemoveMetadata = useCallback(
    (index: number) => {
      const metadata = selectedCell.metadata.filter((_, itemIndex) => itemIndex !== index);
      onStylePatch({ meta: encodeMeta(metadata) });
    },
    [onStylePatch, selectedCell.metadata]
  );

  const onAddPage = useCallback(() => {
    const name = window.prompt("Nombre de la página", `Página ${drawioDocumentRef.current.pages.length + 1}`);
    if (!name) {
      return;
    }

    saveCurrentPageSnapshot();
    commitDocument(
      (current) =>
        addPage(current, {
          name,
          xml: createEmptyDrawioDocument(currentKind).pages[0]?.xml ?? ""
        }),
      { importActivePage: true }
    );
  }, [commitDocument, currentKind, saveCurrentPageSnapshot]);

  const onRenamePage = useCallback(
    (pageId: string) => {
      const current = drawioDocumentRef.current.pages.find((page) => page.id === pageId);
      const nextName = window.prompt("Nuevo nombre", current?.name ?? "Página");
      if (!nextName) {
        return;
      }

      commitDocument((value) => renamePage(value, pageId, nextName));
    },
    [commitDocument]
  );

  const onDuplicatePage = useCallback(
    (pageId: string) => {
      saveCurrentPageSnapshot();
      commitDocument((value) => duplicatePage(value, pageId), { importActivePage: true });
    },
    [commitDocument, saveCurrentPageSnapshot]
  );

  const onRemovePage = useCallback(
    (pageId: string) => {
      if (drawioDocumentRef.current.pages.length <= 1) {
        return;
      }

      const shouldDelete = window.confirm("¿Eliminar esta página?");
      if (!shouldDelete) {
        return;
      }

      saveCurrentPageSnapshot();
      commitDocument((value) => removePage(value, pageId), { importActivePage: true });
    },
    [commitDocument, saveCurrentPageSnapshot]
  );

  const onSetActivePage = useCallback(
    (pageId: string) => {
      if (drawioDocumentRef.current.activePageId === pageId) {
        return;
      }

      saveCurrentPageSnapshot();
      commitDocument((value) => setActivePage(value, pageId), { importActivePage: true });
      updateLocalAwareness({ pageId });
    },
    [commitDocument, saveCurrentPageSnapshot, updateLocalAwareness]
  );

  const applyTemplate = useCallback(
    (template: DiagramTemplatePreset, mode: "replace" | "append") => {
      if (readOnly) {
        return;
      }

      const graph = graphRef.current;
      if (!graph) {
        return;
      }

      graph.batchUpdate(() => {
        if (mode === "replace") {
          const cells = graph.getChildCells(graph.getDefaultParent(), true, true);
          if (cells.length > 0) {
            graph.removeCells(cells);
          }
        }

        template.nodes.forEach((node) => {
          graph.insertVertex({
            parent: graph.getDefaultParent(),
            value: node.value,
            position: [node.x, node.y],
            size: [node.width, node.height],
            style: node.style as any
          });
        });
      });

      setTemplatesOpen(false);
      refreshSelectedState();
    },
    [readOnly, refreshSelectedState]
  );

  const onImportFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const content = await file.text();
      const shouldReplace = window.confirm("El XML importado reemplazará el contenido actual. ¿Continuar?");
      if (!shouldReplace) {
        event.target.value = "";
        return;
      }

      const parsed = parseDiagramSource(content, currentKind);
      const normalized = ensureDocumentIntegrity(parsed.document, currentKind);
      drawioDocumentRef.current = normalized;
      setDrawioDocument(normalized);

      const graph = graphRef.current;
      if (graph) {
        const active = getActivePage(normalized);
        if (active) {
          applyingRemoteRef.current = true;
          importGraphModelXml(graph, active.xml);
          applyingRemoteRef.current = false;
        }
      }

      syncPayload(serializeMxfile(normalized));
      refreshSelectedState();

      event.target.value = "";
    },
    [currentKind, refreshSelectedState, syncPayload]
  );

  const exportPng = useCallback(async () => {
    if (!canvasWrapperRef.current) {
      return;
    }

    const dataUrl = await toPng(canvasWrapperRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor:
        canvasMode === "light"
          ? DIAGRAM_THEME_BY_KIND[currentKind].canvasBackgroundLight
          : DIAGRAM_THEME_BY_KIND[currentKind].canvasBackgroundDark
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${documentId}.png`;
    link.click();
  }, [canvasMode, currentKind, documentId]);

  const exportSvg = useCallback(async () => {
    if (!canvasWrapperRef.current) {
      return;
    }

    const dataUrl = await toSvg(canvasWrapperRef.current, {
      cacheBust: true,
      backgroundColor:
        canvasMode === "light"
          ? DIAGRAM_THEME_BY_KIND[currentKind].canvasBackgroundLight
          : DIAGRAM_THEME_BY_KIND[currentKind].canvasBackgroundDark
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${documentId}.svg`;
    link.click();
  }, [canvasMode, currentKind, documentId]);

  const exportPdf = useCallback(async () => {
    if (!canvasWrapperRef.current) {
      return;
    }

    const dataUrl = await toPng(canvasWrapperRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor:
        canvasMode === "light"
          ? DIAGRAM_THEME_BY_KIND[currentKind].canvasBackgroundLight
          : DIAGRAM_THEME_BY_KIND[currentKind].canvasBackgroundDark
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, "PNG", 16, 16, pageWidth - 32, pageHeight - 32, undefined, "FAST");
    pdf.save(`${documentId}.pdf`);
  }, [canvasMode, currentKind, documentId]);

  const exportXml = useCallback(() => {
    const xml = serializeMxfile(drawioDocumentRef.current);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentId}.drawio`;
    link.click();

    URL.revokeObjectURL(url);
  }, [documentId]);

  const copyShareLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("diagramPage", drawioDocumentRef.current.activePageId);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url.toString());
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = url.toString();
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }, []);

  const onChangeDiagramKind = useCallback(
    (nextKind: DiagramKind) => {
      if (nextKind === currentKind || readOnly) {
        return;
      }

      const graph = graphRef.current;
      const hasContent = graph
        ? graph.getChildCells(graph.getDefaultParent(), true, true).length > 0
        : drawioDocumentRef.current.pages.length > 0;

      if (hasContent) {
        const proceed = window.confirm(
          `Cambiar a ${nextKind} puede reiniciar el canvas para aplicar librerías y tema. ¿Deseas continuar?`
        );
        if (!proceed) {
          return;
        }
      }

      setCurrentKind(nextKind);

      const nextDocument = createEmptyDrawioDocument(nextKind);
      drawioDocumentRef.current = nextDocument;
      setDrawioDocument(nextDocument);

      const graphInstance = graphRef.current;
      if (graphInstance) {
        const active = getActivePage(nextDocument);
        if (active) {
          applyingRemoteRef.current = true;
          importGraphModelXml(graphInstance, active.xml);
          applyingRemoteRef.current = false;
        }
      }

      syncPayload(serializeMxfile(nextDocument));
      refreshSelectedState();
    },
    [currentKind, readOnly, refreshSelectedState, syncPayload]
  );

  const onDeleteSelection = useCallback(() => {
    if (readOnly) {
      return;
    }

    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const selection = graph.getSelectionCells();
    if (selection.length === 0) {
      return;
    }

    graph.removeCells(selection);
    setContextMenu({ open: false, x: 0, y: 0 });
  }, [readOnly]);

  const toggleFullscreen = useCallback(() => {
    if (!rootRef.current) {
      return;
    }

    if (!document.fullscreenElement) {
      void rootRef.current.requestFullscreen();
      setFullscreen(true);
      return;
    }

    void document.exitFullscreen();
    setFullscreen(false);
  }, []);

  useEffect(() => {
    const onFullScreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  const toolbarState: GraphToolbarState = {
    activeTool,
    zoomPercent,
    canvasMode,
    gridMode,
    snapEnabled,
    guidesEnabled,
    minimapEnabled,
    fullscreen,
    canUndo: undoManagerRef.current?.canUndo() ?? false,
    canRedo: undoManagerRef.current?.canRedo() ?? false,
    readOnly
  };

  const toolbarActions: GraphToolbarActions = {
    setTool: applyToolMode,
    zoomIn: () => graphRef.current?.zoomIn(),
    zoomOut: () => graphRef.current?.zoomOut(),
    zoomToPercent: (percent) => {
      const graph = graphRef.current;
      if (!graph) {
        return;
      }
      zoomToPercent(graph, percent);
    },
    fit: () => {
      const graph = graphRef.current;
      if (!graph) {
        return;
      }
      fitGraph(graph);
    },
    resetZoom: () => {
      const graph = graphRef.current;
      if (!graph) {
        return;
      }
      resetView(graph);
    },
    toggleCanvasMode: () => setCanvasMode((current) => (current === "light" ? "dark" : "light")),
    setGridMode,
    toggleSnap: () => setSnapEnabled((current) => !current),
    toggleGuides: () => setGuidesEnabled((current) => !current),
    toggleMinimap: () => setMinimapEnabled((current) => !current),
    toggleFullscreen,
    undo: () => undoManagerRef.current?.undo(),
    redo: () => undoManagerRef.current?.redo(),
    cut: () => {
      const graph = graphRef.current;
      if (graph && !readOnly) {
        Clipboard.cut(graph);
      }
    },
    copy: () => {
      const graph = graphRef.current;
      if (graph) {
        Clipboard.copy(graph);
      }
    },
    paste: () => {
      const graph = graphRef.current;
      if (graph && !readOnly) {
        Clipboard.paste(graph);
      }
    },
    duplicate: () => {
      const graph = graphRef.current;
      if (!graph || readOnly) {
        return;
      }

      const copied = Clipboard.copy(graph);
      if (!copied || copied.length === 0) {
        return;
      }

      Clipboard.paste(graph);
    },
    removeSelection: onDeleteSelection,
    selectAll: () => graphRef.current?.selectAll(graphRef.current.getDefaultParent(), true),
    groupSelection: () => {
      const graph = graphRef.current;
      if (!graph || readOnly) {
        return;
      }
      graph.groupCells(undefined as any, 12, graph.getSelectionCells());
    },
    ungroupSelection: () => {
      const graph = graphRef.current;
      if (!graph || readOnly) {
        return;
      }
      graph.ungroupCells(graph.getSelectionCells());
    },
    openTemplates: () => setTemplatesOpen(true),
    openImportDialog: () => fileInputRef.current?.click(),
    exportPng,
    exportSvg,
    exportPdf,
    exportXml,
    copyShareLink
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);

      if (isEditable) {
        return;
      }

      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (ctrl && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          toolbarActions.redo();
        } else {
          toolbarActions.undo();
        }
        return;
      }

      if (ctrl && key === "y") {
        event.preventDefault();
        toolbarActions.redo();
        return;
      }

      if (ctrl && key === "x") {
        event.preventDefault();
        toolbarActions.cut();
        return;
      }

      if (ctrl && key === "c") {
        event.preventDefault();
        toolbarActions.copy();
        return;
      }

      if (ctrl && key === "v") {
        event.preventDefault();
        toolbarActions.paste();
        return;
      }

      if (ctrl && key === "a") {
        event.preventDefault();
        toolbarActions.selectAll();
        return;
      }

      if (ctrl && key === "d") {
        event.preventDefault();
        toolbarActions.duplicate();
        return;
      }

      if (ctrl && key === "g") {
        event.preventDefault();
        if (event.shiftKey) {
          toolbarActions.ungroupSelection();
        } else {
          toolbarActions.groupSelection();
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        toolbarActions.removeSelection();
        return;
      }

      if (event.key === "Escape") {
        toolbarActions.setTool("select");
        return;
      }

      if (key === "s") {
        toolbarActions.setTool("select");
        return;
      }

      if (key === "h" || event.code === "Space") {
        toolbarActions.setTool("pan");
        return;
      }

      if (key === "c") {
        toolbarActions.setTool("connect");
        return;
      }

      if (key === "t") {
        toolbarActions.setTool("text");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toolbarActions]);

  const paletteViewModel = {
    kind: currentKind,
    libraries: allLibraries,
    search,
    collapsed: collapsedSections,
    readOnly,
    selectedEdgeTemplateId
  };

  return (
    <div ref={rootRef} className="flex h-full min-h-[600px] flex-col rounded-xl border border-[#e2e8f2] bg-white shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept=".drawio,.xml,text/xml,application/xml"
        className="hidden"
        onChange={onImportFileSelected}
      />

      <MaxGraphToolbar
        state={toolbarState}
        actions={toolbarActions}
        diagramKind={currentKind}
        onChangeDiagramKind={onChangeDiagramKind}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        <MaxGraphPalette
          viewModel={paletteViewModel}
          actions={{
            onSearch: setSearch,
            toggleSection,
            insertShape,
            selectEdgeTemplate: (template) => setSelectedEdgeTemplateId(template.id)
          }}
        />

        <div className="flex min-h-0 flex-col">
          <div
            ref={canvasWrapperRef}
            className="relative min-h-[520px] flex-1 overflow-hidden"
            style={backgroundByMode(canvasMode, gridMode, currentKind)}
            onDrop={onCanvasDrop}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDoubleClick={onDoubleClickCanvas}
            onClick={() => setContextMenu({ open: false, x: 0, y: 0 })}
          >
            <div ref={graphContainerRef} className="h-full w-full" />

            <div className="pointer-events-none absolute left-3 bottom-3 z-20 rounded bg-white/85 px-2 py-1 text-xs font-semibold text-slate-700 shadow">
              {zoomPercent}%
            </div>

            {minimapEnabled ? (
              <div
                ref={outlineContainerRef}
                className="absolute right-3 bottom-3 z-20 h-[150px] w-[200px] overflow-hidden rounded-lg border border-slate-300 bg-white/80 shadow-lg backdrop-blur"
              />
            ) : null}

            {remoteSelectionBoxes.map((box) => (
              <div
                key={box.id}
                className="pointer-events-none absolute z-30 rounded border-2"
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  borderColor: box.color,
                  boxShadow: `0 0 0 2px ${box.color}33`
                }}
                title={box.name}
              />
            ))}

            {remotePresence.map((peer) =>
              peer.cursor ? (
                <div
                  key={`cursor-${peer.userId}`}
                  className="pointer-events-none absolute z-40"
                  style={{ left: peer.cursor.x, top: peer.cursor.y }}
                >
                  <div className="h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: peer.color }} />
                  <span
                    className="ml-1 mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
                    style={{ backgroundColor: peer.color }}
                  >
                    {peer.name}
                  </span>
                </div>
              ) : null
            )}

            <MaxGraphContextMenu
              state={contextMenu}
              onClose={() => setContextMenu({ open: false, x: 0, y: 0 })}
              onEditStyle={() => setStyleEditorOpen(true)}
              onEditData={() => {
                // focus metadata section indirectly by opening style editor for now
                setStyleEditorOpen(true);
              }}
              onSelectConnected={() => {
                const graph = graphRef.current;
                if (!graph) {
                  return;
                }
                const selected = graph.getSelectionCell();
                if (!selected) {
                  return;
                }
                if (selected.isEdge()) {
                  return;
                }
                const edges = graph.getEdges(selected, null, true, true, true, true);
                graph.setSelectionCells([selected, ...edges]);
              }}
              onSelectSameType={() => {
                const graph = graphRef.current;
                if (!graph) {
                  return;
                }
                const selected = graph.getSelectionCell();
                if (!selected) {
                  return;
                }

                const style = styleObjectToString(toStyleRecord(selected.getStyle()));
                const cells = graph
                  .getChildCells(graph.getDefaultParent(), true, true)
                  .filter((cell) => styleObjectToString(toStyleRecord(cell.getStyle())) === style);

                graph.setSelectionCells(cells);
              }}
              onGroup={() => toolbarActions.groupSelection()}
              onBringToFront={() => {
                const graph = graphRef.current;
                if (!graph || readOnly) {
                  return;
                }
                graph.orderCells(false, graph.getSelectionCells());
              }}
              onSendToBack={() => {
                const graph = graphRef.current;
                if (!graph || readOnly) {
                  return;
                }
                graph.orderCells(true, graph.getSelectionCells());
              }}
              onLockToggle={() => {
                const graph = graphRef.current;
                if (!graph || readOnly) {
                  return;
                }

                const selected = graph.getSelectionCell();
                if (!selected) {
                  return;
                }

                const style = toStyleRecord(selected.getStyle());
                const nextLocked = String(style.locked ?? "0") !== "1";
                graph.setCellStyles("locked" as any, nextLocked ? 1 : 0, [selected]);
              }}
              onCopyStyle={() => {
                const graph = graphRef.current;
                const selected = graph?.getSelectionCell();
                if (!selected) {
                  return;
                }
                copiedStyleRef.current = cloneStyle(toStyleRecord(selected.getStyle()));
              }}
              onPasteStyle={() => {
                if (readOnly) {
                  return;
                }
                const graph = graphRef.current;
                const selected = graph?.getSelectionCell();
                if (!graph || !selected || !copiedStyleRef.current) {
                  return;
                }
                graph.batchUpdate(() => {
                  graph.getDataModel().setStyle(selected, copiedStyleRef.current as any);
                });
              }}
              onDelete={onDeleteSelection}
            />
          </div>

          <MaxGraphPagesTabs
            document={drawioDocument}
            readOnly={readOnly}
            onAdd={onAddPage}
            onRename={onRenamePage}
            onDuplicate={onDuplicatePage}
            onRemove={onRemovePage}
            onSetActive={onSetActivePage}
          />
        </div>

        <MaxGraphPropertiesPanel
          diagramKind={currentKind}
          readOnly={readOnly}
          selected={selectedCell}
          onLabelChange={onLabelChange}
          onStylePatch={onStylePatch}
          onReplaceStyle={onReplaceStyle}
          onGeometryPatch={onGeometryPatch}
          onCenter={onCenterCell}
          onHighlightConnection={onHighlightConnection}
          onDeleteConnection={onDeleteConnection}
          onAddMetadata={onAddMetadata}
          onUpdateMetadata={onUpdateMetadata}
          onRemoveMetadata={onRemoveMetadata}
          onOpenStyleEditor={() => setStyleEditorOpen(true)}
        />
      </div>

      <MaxGraphStyleEditorModal
        open={styleEditorOpen}
        style={selectedCell.style}
        onClose={() => setStyleEditorOpen(false)}
        onApply={onReplaceStyle}
        onReset={() => {
          const graph = graphRef.current;
          const selected = graph?.getSelectionCell();
          if (!graph || !selected) {
            return;
          }

          const theme = DIAGRAM_THEME_BY_KIND[currentKind];
          if (selected.isEdge()) {
            graph.getDataModel().setStyle(selected, theme.defaultEdgeStyle as any);
          } else {
            graph.getDataModel().setStyle(selected, theme.defaultVertexStyle as any);
          }
        }}
      />

      <MaxGraphTemplatesModal
        open={templatesOpen}
        kind={currentKind}
        onClose={() => setTemplatesOpen(false)}
        onApply={applyTemplate}
      />
    </div>
  );
};
