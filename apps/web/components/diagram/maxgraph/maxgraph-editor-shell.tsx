"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { DiagramKind } from "@corelia/types";
import type { AbstractGraph, Outline, UndoManager } from "@maxgraph/core";

import { MaxGraphContextMenu, type MaxGraphContextMenuState } from "@/components/diagram/maxgraph/maxgraph-context-menu";
import { UiModal } from "@/components/ui-modal";
import { MaxGraphPalette } from "@/components/diagram/maxgraph/maxgraph-palette";
import { MaxGraphPagesTabs } from "@/components/diagram/maxgraph/maxgraph-pages-tabs";
import {
  MaxGraphPropertiesPanel,
  type SelectedCellView
} from "@/components/diagram/maxgraph/maxgraph-properties-panel";
import { MaxGraphStyleEditorModal } from "@/components/diagram/maxgraph/maxgraph-style-editor-modal";
import { MaxGraphTemplatesModal } from "@/components/diagram/maxgraph/maxgraph-templates-modal";
import { MaxGraphToolbar } from "@/components/diagram/maxgraph/maxgraph-toolbar";
import type {
  ActiveTool,
  CanvasMode,
  DiagramOfflineMode,
  DiagramSyncLifecycle,
  GridMode,
  RemoteCursorPresence
} from "@/components/diagram/maxgraph/types";
import {
  getPaletteForAllKinds,
  type EdgeTemplate,
  type ShapeLibrary,
  type ShapeTemplate
} from "@/lib/diagram/maxgraph/palette-catalog";
import { DIAGRAM_THEME_BY_KIND } from "@/lib/diagram/maxgraph/themes";
import {
  createEmptyDrawioDocument,
  serializeMxfile,
  type DrawioDocument
} from "@/lib/diagram/maxgraph/xml-format";
import { getActivePage } from "@/lib/diagram/maxgraph/xml-pages";
import {
  backgroundByMode,
  buildSelectedCellView,
  graphToScreenPoint
} from "@/components/diagram/maxgraph/maxgraph-editor-shell-utils";
import { useMaxGraphEditorRuntime } from "@/components/diagram/maxgraph/maxgraph-editor-runtime";
import { useMaxGraphEditorHandlers } from "@/components/diagram/maxgraph/maxgraph-editor-handlers";
import { useMaxGraphEditorToolbar } from "@/components/diagram/maxgraph/maxgraph-editor-toolbar-hook";

export const MaxGraphEditorShell = memo(({
  documentId,
  value,
  readOnly,
  provider,
  currentUser,
  diagramKind,
  offlineMode = "readonly",
  connectionState = "connected",
  onLegacyMigration,
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
  offlineMode?: DiagramOfflineMode;
  connectionState?: "connected" | "reconnecting" | "offline";
  onLegacyMigration?: (input: {
    droppedPageIds: string[];
    activePageId: string;
    backupSnapshot: string;
  }) => void | Promise<void>;
  onChange: (value: string) => void;
}) => {
  const fallbackKind = diagramKind ?? "FLUJO";

  const fallbackDocRef = useRef<any>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const yText = useMemo(() => yDoc.getText(`doc:${documentId}:diagram`), [documentId, yDoc]);
  const yDiagramMap = useMemo(() => yDoc.getMap(`doc:${documentId}:diagram:v3`), [documentId, yDoc]);
  const canonicalPageId = useMemo(
    () => `p-${documentId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "main"}`,
    [documentId]
  );

  const initialDocumentRef = useRef<DrawioDocument | null>(null);
  if (!initialDocumentRef.current) {
    const seed = createEmptyDrawioDocument(fallbackKind);
    const seedPage = seed.pages[0];
    initialDocumentRef.current = {
      ...seed,
      activePageId: canonicalPageId,
      pages: [
        {
          id: canonicalPageId,
          name: seedPage?.name ?? "Diagrama",
          xml: seedPage?.xml ?? ""
        }
      ]
    };
  }

  const [currentKind, setCurrentKind] = useState<DiagramKind>(fallbackKind);
  const [drawioDocument, setDrawioDocument] = useState<DrawioDocument>(
    initialDocumentRef.current
  );
  const drawioDocumentRef = useRef<DrawioDocument>(
    initialDocumentRef.current
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
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [viewRevision, setViewRevision] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [remoteLibraries, setRemoteLibraries] = useState<ShapeLibrary[]>([]);
  const [selectedEdgeTemplateId, setSelectedEdgeTemplateId] = useState<string | null>(null);
  const [remotePresence, setRemotePresence] = useState<RemoteCursorPresence[]>([]);
  const [remoteSelectionBoxes, setRemoteSelectionBoxes] = useState<
    Array<{ id: string; x: number; y: number; width: number; height: number; color: string; name: string }>
  >([]);
  const remotePresenceRef = useRef<RemoteCursorPresence[]>([]);

  const [contextMenu, setContextMenu] = useState<MaxGraphContextMenuState>({ open: false, x: 0, y: 0 });
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"none" | "palette" | "properties">("none");
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const [renamePageModal, setRenamePageModal] = useState<{
    open: boolean;
    pageId: string;
    currentName: string;
    inputValue: string;
  }>({ open: false, pageId: "", currentName: "", inputValue: "" });
  const [addPageModal, setAddPageModal] = useState<{
    open: boolean;
    inputValue: string;
  }>({ open: false, inputValue: "" });
  const [runtimeSyncLifecycle, setRuntimeSyncLifecycle] = useState<"bootstrap" | "live">(
    provider ? "bootstrap" : "live"
  );
  const [concurrentFlash, setConcurrentFlash] = useState(false);
  const concurrentFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyingRemoteRef = useRef(false);
  const lastSyncedPayloadRef = useRef("");
  const needsMigrationPersistRef = useRef(false);
  const copiedStyleRef = useRef<Record<string, unknown> | null>(null);
  const selectedEdgeTemplateRef = useRef<EdgeTemplate | null>(null);
  const activeToolRef = useRef<ActiveTool>("select");
  const readOnlyRef = useRef(readOnly);
  const connectSourceCellIdRef = useRef<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const outlineContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const graphRef = useRef<AbstractGraph | null>(null);
  const outlineRef = useRef<Outline | null>(null);
  const undoManagerRef = useRef<UndoManager | null>(null);

  const allLibraries = useMemo(() => getPaletteForAllKinds(remoteLibraries), [remoteLibraries]);

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

  useEffect(() => {
    selectedEdgeTemplateRef.current = selectedEdgeTemplate;
  }, [selectedEdgeTemplate]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    setRuntimeSyncLifecycle(provider ? "bootstrap" : "live");
  }, [documentId, provider]);

  useEffect(() => {
    setMobilePanel("none");
  }, [documentId]);

  const diagramSyncLifecycle: DiagramSyncLifecycle = useMemo(() => {
    if (connectionState === "reconnecting") {
      return "reconnecting";
    }

    if (connectionState === "offline" && offlineMode === "queue") {
      return "offline_queue";
    }

    if (runtimeSyncLifecycle === "bootstrap") {
      return "bootstrap";
    }

    return "live";
  }, [connectionState, offlineMode, runtimeSyncLifecycle]);

  const effectiveReadOnly = readOnly || runtimeSyncLifecycle === "bootstrap";
  const singlePageMode = true;

  useEffect(() => {
    readOnlyRef.current = effectiveReadOnly;
  }, [effectiveReadOnly]);

  const {
    syncPayload,
    refreshSelectedState,
    commitDocument,
    saveCurrentPageSnapshot,
    applyToolMode,
    updateLocalAwareness
  } = useMaxGraphEditorRuntime({
    documentId,
    value,
    readOnly: effectiveReadOnly,
    currentKind,
    currentUser,
    provider,
    yText,
    yDiagramMap,
    onChange,
    drawioDocumentRef,
    setDrawioDocument,
    graphRef,
    outlineRef,
    undoManagerRef,
    graphContainerRef,
    outlineContainerRef,
    activeToolRef,
    readOnlyRef,
    selectedEdgeTemplateRef,
    connectSourceCellIdRef,
    applyingRemoteRef,
    lastSyncedPayloadRef,
    needsMigrationPersistRef,
    remotePresence,
    remotePresenceRef,
    setRemotePresence,
    setRemoteSelectionBoxes,
    allLibraries,
    edgeTemplateIndex,
    selectedEdgeTemplate,
    setSelectedCell,
    setZoomPercent,
    setViewRevision,
    setRemoteLibraries,
    setCollapsedSections,
    setSelectedEdgeTemplateId,
    setContextMenu,
    setActiveTool,
    snapEnabled,
    guidesEnabled,
    minimapEnabled,
    ...(onLegacyMigration ? { onLegacyMigration } : {}),
    onSyncLifecycleChange: setRuntimeSyncLifecycle,
    onConcurrentRemoteApplied: () => {
      setConcurrentFlash(true);
      if (concurrentFlashTimerRef.current) {
        clearTimeout(concurrentFlashTimerRef.current);
      }
      concurrentFlashTimerRef.current = setTimeout(() => {
        setConcurrentFlash(false);
        concurrentFlashTimerRef.current = null;
      }, 2000);
    }
  });

  useEffect(() => {
    const onForceSync = (event: Event) => {
      const custom = event as CustomEvent<{ documentId?: string }>;
      if (custom.detail?.documentId !== documentId) {
        return;
      }
      saveCurrentPageSnapshot();
    };

    const onRequestSnapshot = (event: Event) => {
      const custom = event as CustomEvent<{
        documentId?: string;
        capture?: (payload: string) => void;
      }>;
      if (custom.detail?.documentId !== documentId) {
        return;
      }
      if (typeof custom.detail.capture !== "function") {
        return;
      }
      saveCurrentPageSnapshot();
      custom.detail.capture(serializeMxfile(drawioDocumentRef.current).trim());
    };

    window.addEventListener("corelia:diagram-force-sync", onForceSync as EventListener);
    window.addEventListener("corelia:diagram-request-snapshot", onRequestSnapshot as EventListener);
    return () => {
      window.removeEventListener("corelia:diagram-force-sync", onForceSync as EventListener);
      window.removeEventListener("corelia:diagram-request-snapshot", onRequestSnapshot as EventListener);
    };
  }, [documentId, drawioDocumentRef, saveCurrentPageSnapshot]);

  const handlers = useMaxGraphEditorHandlers({
    documentId,
    currentKind,
    readOnly: effectiveReadOnly,
    activeTool,
    selectedCell,
    drawioDocumentRef,
    graphRef,
    graphContainerRef,
    canvasWrapperRef,
    rootRef,
    applyingRemoteRef,
    copiedStyleRef,
    shapeTemplateIndex,
    setAddPageModal,
    setRenamePageModal,
    setConfirmModal,
    setTemplatesOpen,
    setStyleEditorOpen,
    setContextMenu,
    setCurrentKind,
    setDrawioDocument,
    setFullscreen,
    setCollapsedSections,
    canvasMode,
    refreshSelectedState,
    syncPayload,
    commitDocument,
    saveCurrentPageSnapshot,
    updateLocalAwareness
  });

  const { toolbarState, toolbarActions } = useMaxGraphEditorToolbar({
    activeTool,
    zoomPercent,
    canvasMode,
    gridMode,
    snapEnabled,
    guidesEnabled,
    minimapEnabled,
    fullscreen,
    readOnly: effectiveReadOnly,
    setCanvasMode,
    setGridMode,
    setSnapEnabled,
    setGuidesEnabled,
    setMinimapEnabled,
    setTemplatesOpen,
    graphRef,
    undoManagerRef,
    fileInputRef,
    applyToolMode,
    toggleFullscreen: handlers.toggleFullscreen,
    onDeleteSelection: handlers.onDeleteSelection,
    exportPng: handlers.exportPng,
    exportSvg: handlers.exportSvg,
    exportPdf: handlers.exportPdf,
    exportXml: handlers.exportXml,
    copyShareLink: handlers.copyShareLink
  });

  useEffect(() => {
    const onFullScreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  // Scroll wheel sin Ctrl/Meta → pan del canvas en lugar de nada
  // Scroll wheel con Ctrl/Meta → MaxGraph maneja el zoom (no interceptamos)
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // dejar que MaxGraph maneje el zoom
      const graph = graphRef.current;
      if (!graph) return;

      e.preventDefault();
      e.stopPropagation();

      // deltaMode: 0 = px, 1 = lines (~30px), 2 = pages (~300px)
      const factor = e.deltaMode === 1 ? 30 : e.deltaMode === 2 ? 300 : 1;
      const dx = e.deltaX * factor;
      const dy = e.deltaY * factor;

      const view = graph.getView();
      const t = view.translate;
      view.setTranslate(t.x - dx, t.y - dy);
    };

    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [canvasWrapperRef, graphRef]);

  const paletteViewModel = {
    kind: currentKind,
    libraries: allLibraries,
    search,
    collapsed: collapsedSections,
    readOnly: effectiveReadOnly,
    selectedEdgeTemplateId
  };

  const activePageId = drawioDocument.activePageId;
  const peersInCurrentPage = useMemo(
    () => (singlePageMode
      ? remotePresence
      : remotePresence.filter((peer) => peer.pageId === activePageId)),
    [remotePresence, activePageId, singlePageMode]
  );
  const peersInOtherPages = useMemo(
    () => (singlePageMode
      ? []
      : remotePresence.filter((peer) => peer.pageId !== activePageId)),
    [remotePresence, activePageId, singlePageMode]
  );

  const renderableRemoteCursors = useMemo(
    () => {
      void viewRevision;
      return peersInCurrentPage
        .map((peer) => {
          if (!peer.cursor) {
            return null;
          }

          const graph = graphRef.current;
          const cursor = graph ? graphToScreenPoint(graph, peer.cursor) : peer.cursor;
          return {
            id: `cursor-${peer.userId}`,
            name: peer.name,
            color: peer.color,
            cursor
          };
        })
        .filter((item): item is { id: string; name: string; color: string; cursor: { x: number; y: number } } => Boolean(item));
    },
    [graphRef, peersInCurrentPage, viewRevision]
  );

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e2e8f2] bg-white shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept=".drawio,.xml,text/xml,application/xml"
        className="hidden"
        onChange={handlers.onImportFileSelected}
      />

      <MaxGraphToolbar state={toolbarState} actions={toolbarActions} />

      <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f2] bg-slate-50 px-2 py-1.5 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobilePanel("palette")}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
          >
            Paleta
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("properties")}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
          >
            Propiedades
          </button>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {diagramSyncLifecycle === "bootstrap"
            ? "bootstrap"
            : diagramSyncLifecycle === "reconnecting"
              ? "reconnecting"
              : diagramSyncLifecycle === "offline_queue"
                ? "offline queue"
                : "live"}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        <div className="hidden min-h-0 lg:col-start-1 lg:block">
          <MaxGraphPalette
            viewModel={paletteViewModel}
            actions={{
              onSearch: setSearch,
              toggleSection: handlers.toggleSection,
              selectDiagramKind: handlers.onChangeDiagramKind,
              insertShape: handlers.insertShape,
              selectEdgeTemplate: (template) => {
                setSelectedEdgeTemplateId(template.id);
                applyToolMode("connect");
              }
            }}
          />
        </div>

        <div className="order-1 flex min-h-0 flex-col lg:order-none lg:col-start-2">
          <div
            ref={canvasWrapperRef}
            className="relative min-h-0 flex-1 overflow-hidden"
            style={backgroundByMode(canvasMode, gridMode, currentKind)}
            onDrop={handlers.onCanvasDrop}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDoubleClick={handlers.onDoubleClickCanvas}
            onClick={() => setContextMenu({ open: false, x: 0, y: 0 })}
          >
            <div ref={graphContainerRef} className="h-full w-full" />

            <div className="pointer-events-none absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
              {peersInCurrentPage.map((peer) => (
                <div
                  key={`presence-on-page-${peer.userId}`}
                  className="rounded-md border border-white/70 bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow"
                >
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: peer.color }} />
                  <span className="align-middle">{peer.name}</span>
                  <span className="ml-1 align-middle text-slate-500">
                    {Array.isArray(peer.selectedCellIds) && peer.selectedCellIds.length > 0
                      ? `selecciona ${peer.selectedCellIds.length}`
                      : "navegando"}
                  </span>
                </div>
              ))}
              {peersInOtherPages.map((peer) => (
                <div
                  key={`presence-other-page-${peer.userId}`}
                  className="rounded-md border border-amber-200 bg-amber-50/95 px-2 py-1 text-[11px] font-semibold text-amber-700 shadow"
                >
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: peer.color }} />
                  <span className="align-middle">{peer.name}</span>
                  <span className="ml-1 align-middle text-amber-600">en otra página</span>
                </div>
              ))}
            </div>

            <div className="pointer-events-none absolute left-3 bottom-3 z-20 rounded bg-white/85 px-2 py-1 text-xs font-semibold text-slate-700 shadow">
              {zoomPercent}%
            </div>

            {diagramSyncLifecycle !== "live" ? (
              <div
                className={`pointer-events-none absolute right-3 bottom-3 z-20 rounded px-2 py-1 text-[11px] font-semibold shadow ${
                  diagramSyncLifecycle === "bootstrap"
                    ? "bg-blue-100 text-blue-700"
                    : diagramSyncLifecycle === "reconnecting"
                      ? "animate-pulse bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {diagramSyncLifecycle === "bootstrap"
                  ? "Sincronizando..."
                  : diagramSyncLifecycle === "reconnecting"
                    ? "Reconectando..."
                    : "Sin conexión"}
              </div>
            ) : null}

            {concurrentFlash ? (
              <div className="pointer-events-none absolute left-1/2 bottom-10 z-40 -translate-x-1/2 rounded-lg bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                Cambios remotos aplicados
              </div>
            ) : null}

            {minimapEnabled ? (
              <div
                ref={outlineContainerRef}
                className="absolute right-2 bottom-14 z-20 hidden h-[120px] w-[160px] overflow-hidden rounded-lg border border-slate-300 bg-white/80 shadow-lg backdrop-blur md:block lg:bottom-3 lg:h-[150px] lg:w-[200px]"
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
                  backgroundColor: `${box.color}0D`,
                  boxShadow: `0 0 0 2px ${box.color}33`,
                  transition: "left 100ms ease-out, top 100ms ease-out, width 100ms ease-out, height 100ms ease-out"
                }}
              >
                <span
                  className="absolute -top-5 left-0 rounded px-1 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap"
                  style={{ backgroundColor: box.color }}
                >
                  {box.name}
                </span>
              </div>
            ))}

            {renderableRemoteCursors.map((peer) => (
              <div
                key={peer.id}
                className="pointer-events-none absolute z-40"
                style={{ left: peer.cursor.x, top: peer.cursor.y, transition: "left 100ms ease-out, top 100ms ease-out" }}
              >
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ backgroundColor: peer.color }} />
                <span
                  className="ml-1 mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow"
                  style={{ backgroundColor: peer.color }}
                >
                  {peer.name}
                </span>
              </div>
            ))}

            <MaxGraphContextMenu
              state={contextMenu}
              onClose={() => setContextMenu({ open: false, x: 0, y: 0 })}
              onEditStyle={() => setStyleEditorOpen(true)}
              onEditData={() => setStyleEditorOpen(true)}
              onSelectConnected={handlers.onContextSelectConnected}
              onSelectSameType={handlers.onContextSelectSameType}
              onGroup={() => toolbarActions.groupSelection()}
              onBringToFront={handlers.onContextBringToFront}
              onSendToBack={handlers.onContextSendToBack}
              onLockToggle={handlers.onContextLockToggle}
              onCopyStyle={handlers.onContextCopyStyle}
              onPasteStyle={handlers.onContextPasteStyle}
              onDelete={handlers.onDeleteSelection}
            />
          </div>

          <MaxGraphPagesTabs
            document={drawioDocument}
            readOnly={effectiveReadOnly || singlePageMode}
            onAdd={handlers.onAddPage}
            onRename={handlers.onRenamePage}
            onDuplicate={handlers.onDuplicatePage}
            onRemove={handlers.onRemovePage}
            onSetActive={handlers.onSetActivePage}
          />
        </div>

        <div className="hidden min-h-0 lg:col-start-3 lg:block">
          <MaxGraphPropertiesPanel
            diagramKind={currentKind}
            readOnly={effectiveReadOnly}
            selected={selectedCell}
            onLabelChange={handlers.onLabelChange}
            onStylePatch={handlers.onStylePatch}
            onReplaceStyle={handlers.onReplaceStyle}
            onGeometryPatch={handlers.onGeometryPatch}
            onCenter={handlers.onCenterCell}
            onHighlightConnection={handlers.onHighlightConnection}
            onDeleteConnection={handlers.onDeleteConnection}
            onAddMetadata={handlers.onAddMetadata}
            onUpdateMetadata={handlers.onUpdateMetadata}
            onRemoveMetadata={handlers.onRemoveMetadata}
            onOpenStyleEditor={() => setStyleEditorOpen(true)}
          />
        </div>
      </div>

      {mobilePanel !== "none" ? (
        <div className="absolute inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35"
            aria-label="Cerrar panel"
            onClick={() => setMobilePanel("none")}
          />
          <div
            className={`absolute top-0 bottom-0 z-10 w-[min(92vw,360px)] overflow-hidden bg-white shadow-xl ${
              mobilePanel === "palette" ? "left-0 border-r border-[#e2e8f2]" : "right-0 border-l border-[#e2e8f2]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f2] px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {mobilePanel === "palette" ? "Paleta" : "Propiedades"}
              </p>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                onClick={() => setMobilePanel("none")}
              >
                Cerrar
              </button>
            </div>
            <div className="h-[calc(100%-45px)]">
              {mobilePanel === "palette" ? (
                <MaxGraphPalette
                  viewModel={paletteViewModel}
                  actions={{
                    onSearch: setSearch,
                    toggleSection: handlers.toggleSection,
                    selectDiagramKind: handlers.onChangeDiagramKind,
                    insertShape: handlers.insertShape,
                    selectEdgeTemplate: (template) => {
                      setSelectedEdgeTemplateId(template.id);
                      applyToolMode("connect");
                      setMobilePanel("none");
                    }
                  }}
                />
              ) : (
                <MaxGraphPropertiesPanel
                  diagramKind={currentKind}
                  readOnly={effectiveReadOnly}
                  selected={selectedCell}
                  onLabelChange={handlers.onLabelChange}
                  onStylePatch={handlers.onStylePatch}
                  onReplaceStyle={handlers.onReplaceStyle}
                  onGeometryPatch={handlers.onGeometryPatch}
                  onCenter={handlers.onCenterCell}
                  onHighlightConnection={handlers.onHighlightConnection}
                  onDeleteConnection={handlers.onDeleteConnection}
                  onAddMetadata={handlers.onAddMetadata}
                  onUpdateMetadata={handlers.onUpdateMetadata}
                  onRemoveMetadata={handlers.onRemoveMetadata}
                  onOpenStyleEditor={() => setStyleEditorOpen(true)}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <MaxGraphStyleEditorModal
        open={styleEditorOpen}
        style={selectedCell.style}
        onClose={() => setStyleEditorOpen(false)}
        onApply={handlers.onReplaceStyle}
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
        onApply={handlers.applyTemplate}
      />

      <UiModal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        title={confirmModal.title}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal((prev) => ({ ...prev, open: false }));
              }}
            >
              Continuar
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700">{confirmModal.message}</p>
      </UiModal>

      <UiModal
        open={renamePageModal.open}
        onClose={() => setRenamePageModal((prev) => ({ ...prev, open: false }))}
        title="Renombrar página"
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setRenamePageModal((prev) => ({ ...prev, open: false }))}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                handlers.onRenamePageConfirm(renamePageModal.pageId, renamePageModal.inputValue);
                setRenamePageModal((prev) => ({ ...prev, open: false }));
              }}
            >
              Renombrar
            </button>
          </>
        }
      >
        <input
          type="text"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={renamePageModal.inputValue}
          onChange={(e) => setRenamePageModal((prev) => ({ ...prev, inputValue: e.target.value }))}
          onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              handlers.onRenamePageConfirm(renamePageModal.pageId, renamePageModal.inputValue);
              setRenamePageModal((prev) => ({ ...prev, open: false }));
            }
          }}
          autoFocus
        />
      </UiModal>

      <UiModal
        open={addPageModal.open}
        onClose={() => setAddPageModal((prev) => ({ ...prev, open: false }))}
        title="Nueva página"
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setAddPageModal((prev) => ({ ...prev, open: false }))}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                handlers.onAddPageConfirm(addPageModal.inputValue);
                setAddPageModal((prev) => ({ ...prev, open: false }));
              }}
            >
              Crear
            </button>
          </>
        }
      >
        <input
          type="text"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={addPageModal.inputValue}
          onChange={(e) => setAddPageModal((prev) => ({ ...prev, inputValue: e.target.value }))}
          onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              handlers.onAddPageConfirm(addPageModal.inputValue);
              setAddPageModal((prev) => ({ ...prev, open: false }));
            }
          }}
          autoFocus
        />
      </UiModal>
    </div>
  );
});
