import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { DiagramKind } from "@corelia/types";
import {
  AbstractCanvas2D,
  ActorShape,
  Graph,
  InternalEvent,
  Morphing,
  Outline,
  ShapeRegistry,
  UndoManager,
  type AbstractGraph,
  type Cell,
  type EventObject
} from "@maxgraph/core";
import * as Y from "yjs";

import type {
  MaxGraphContextMenuState
} from "@/components/diagram/maxgraph/maxgraph-context-menu";
import { loadPaletteSectionState } from "@/components/diagram/maxgraph/maxgraph-palette";
import type { SelectedCellView } from "@/components/diagram/maxgraph/maxgraph-properties-panel";
import type {
  ActiveTool,
  RemoteCursorPresence
} from "@/components/diagram/maxgraph/types";
import {
  type EdgeTemplate,
  type ShapeLibrary
} from "@/lib/diagram/maxgraph/palette-catalog";
import { loadRemoteStencilLibraries } from "@/lib/diagram/maxgraph/stencil-loader";
import {
  createEmptyDrawioDocument,
  ensureDocumentIntegrity,
  serializeMxfile,
  type DrawioDocument
} from "@/lib/diagram/maxgraph/xml-format";
import {
  getActivePage,
  updatePageXml
} from "@/lib/diagram/maxgraph/xml-pages";
import {
  exportGraphModelXml,
  importGraphModelXml,
  parseDiagramSource
} from "@/lib/diagram/maxgraph/xml-serializer";
import {
  applyGraphModelXmlToDiagramV3Page,
  DIAGRAM_V3_LOCAL_ORIGIN,
  DIAGRAM_V3_MIGRATION_ORIGIN,
  exportDiagramV3ToDrawioDocument,
  getDiagramV3Diagnostics,
  hasDiagramV3Data,
  writeDrawioDocumentToDiagramV3
} from "@/lib/diagram/maxgraph/diagram-collab-v3";
import {
  AWARENESS_KEY,
  applyThemeToGraph,
  areRemotePresenceEqual,
  baseConnectorStyle,
  buildSelectedCellView,
  resolveConnectableVertex,
  screenToGraphPoint
} from "@/components/diagram/maxgraph/maxgraph-editor-shell-utils";

/**
 * Custom UML Actor shape that draws a stick figure (person icon) instead of
 * the default maxGraph "actor" blob shape.
 */
class UmlActorShape extends ActorShape {
  override redrawPath(c: AbstractCanvas2D, _x: number, _y: number, w: number, h: number): void {
    const cx = w / 2;
    const headR = Math.min(w, h) * 0.15;
    const headCy = headR + 2;
    const bodyTop = headCy + headR;
    const bodyBottom = h * 0.65;
    const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;
    const armSpan = w * 0.38;
    const legSpan = w * 0.3;
    const legBottom = h * 0.85;

    // Head
    c.ellipse(cx - headR, headCy - headR, headR * 2, headR * 2);
    c.fillAndStroke();

    // Body
    c.begin();
    c.moveTo(cx, bodyTop);
    c.lineTo(cx, bodyBottom);
    c.stroke();

    // Arms
    c.begin();
    c.moveTo(cx - armSpan, armY);
    c.lineTo(cx + armSpan, armY);
    c.stroke();

    // Left leg
    c.begin();
    c.moveTo(cx, bodyBottom);
    c.lineTo(cx - legSpan, legBottom);
    c.stroke();

    // Right leg
    c.begin();
    c.moveTo(cx, bodyBottom);
    c.lineTo(cx + legSpan, legBottom);
    c.stroke();
  }
}

// Register umlActor shape once at module load
if (!ShapeRegistry.get("umlActor")) {
  ShapeRegistry.add("umlActor", UmlActorShape);
}

export type MaxGraphEditorRuntimeOptions = {
  documentId: string;
  value: string;
  readOnly: boolean;
  currentKind: DiagramKind;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  provider?: HocuspocusProvider | null | undefined;
  yText: Y.Text;
  yDiagramMap: Y.Map<unknown>;
  onChange: (value: string) => void;

  drawioDocumentRef: MutableRefObject<DrawioDocument>;
  setDrawioDocument: Dispatch<SetStateAction<DrawioDocument>>;

  graphRef: MutableRefObject<AbstractGraph | null>;
  outlineRef: MutableRefObject<Outline | null>;
  undoManagerRef: MutableRefObject<UndoManager | null>;

  graphContainerRef: MutableRefObject<HTMLDivElement | null>;
  outlineContainerRef: MutableRefObject<HTMLDivElement | null>;

  activeToolRef: MutableRefObject<ActiveTool>;
  readOnlyRef: MutableRefObject<boolean>;
  selectedEdgeTemplateRef: MutableRefObject<EdgeTemplate | null>;
  connectSourceCellIdRef: MutableRefObject<string | null>;
  applyingRemoteRef: MutableRefObject<boolean>;
  lastSyncedPayloadRef: MutableRefObject<string>;
  needsMigrationPersistRef: MutableRefObject<boolean>;

  remotePresence: RemoteCursorPresence[];
  remotePresenceRef: MutableRefObject<RemoteCursorPresence[]>;
  setRemotePresence: Dispatch<SetStateAction<RemoteCursorPresence[]>>;
  setRemoteSelectionBoxes: Dispatch<SetStateAction<Array<{ id: string; x: number; y: number; width: number; height: number; color: string; name: string }>>>;

  allLibraries: ShapeLibrary[];
  edgeTemplateIndex: Map<string, EdgeTemplate>;
  selectedEdgeTemplate: EdgeTemplate | null;

  setSelectedCell: Dispatch<SetStateAction<SelectedCellView>>;
  setZoomPercent: Dispatch<SetStateAction<number>>;
  setViewRevision: Dispatch<SetStateAction<number>>;
  setRemoteLibraries: Dispatch<SetStateAction<ShapeLibrary[]>>;
  setCollapsedSections: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSelectedEdgeTemplateId: Dispatch<SetStateAction<string | null>>;
  setContextMenu: Dispatch<SetStateAction<MaxGraphContextMenuState>>;

  setActiveTool: Dispatch<SetStateAction<ActiveTool>>;
  snapEnabled: boolean;
  guidesEnabled: boolean;
  minimapEnabled: boolean;
  onLegacyMigration?: (input: {
    droppedPageIds: string[];
    activePageId: string;
    backupSnapshot: string;
  }) => void | Promise<void>;
  onSyncLifecycleChange?: (state: "bootstrap" | "live") => void;
};

const PRESENCE_STALE_MS = 15_000;
const PRESENCE_REFRESH_THROTTLE_MS = 120;
const CURSOR_THROTTLE_MS = 120;
const MIN_CURSOR_DELTA = 1.5;
const MODEL_SYNC_DEBOUNCE_MS = 250;
const BOOTSTRAP_TIMEOUT_MS = 2_500;
const DRAG_MORPH_STEPS = 4;
const DRAG_MORPH_EASE = 1.6;
const DRAG_MORPH_DELAY = 12;
const MAX_LIVE_PREVIEW_CELLS = 100;
type RemoteSelectionBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  name: string;
};

const areRemoteSelectionBoxesEqual = (
  left: RemoteSelectionBox[],
  right: RemoteSelectionBox[]
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];
    if (!current || !next) {
      return false;
    }
    if (
      current.id !== next.id ||
      current.x !== next.x ||
      current.y !== next.y ||
      current.width !== next.width ||
      current.height !== next.height ||
      current.color !== next.color ||
      current.name !== next.name
    ) {
      return false;
    }
  }

  return true;
};

export const useMaxGraphEditorRuntime = (options: MaxGraphEditorRuntimeOptions) => {
  const {
    documentId,
    value,
    readOnly,
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
    onLegacyMigration,
    onSyncLifecycleChange
  } = options;
  const canonicalPageId = `p-${documentId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "main"}`;

  const bootstrapCompleteRef = useRef(!provider);
  const fallbackSeededRef = useRef(false);
  const providerRef = useRef(provider);
  const pendingModelSyncFrameRef = useRef<number | null>(null);
  const pendingModelSyncTimerRef = useRef<number | null>(null);
  const pendingViewRefreshFrameRef = useRef<number | null>(null);
  const pendingRemovedCellIdsRef = useRef<Set<string>>(new Set());
  const lastZoomPercentRef = useRef(100);
  const lastSelectionSignatureRef = useRef("");
  const lastRemoteOpRef = useRef("none");
  const latestValueRef = useRef(value);
  const latestOnChangeRef = useRef(onChange);
  const onLegacyMigrationRef = useRef(onLegacyMigration);
  const migratedLegacySignatureRef = useRef<Set<string>>(new Set());
  const debugEnabled = process.env.NEXT_PUBLIC_DOCS_DEBUG === "true" && process.env.NODE_ENV !== "test";

  useEffect(() => {
    onLegacyMigrationRef.current = onLegacyMigration;
  }, [onLegacyMigration]);

  useEffect(() => {
    migratedLegacySignatureRef.current.clear();
  }, [documentId]);

  // Refs for callbacks used inside the graph-init effect so that the effect
  // does NOT depend on them (prevents destroy/recreate cycles).
  const scheduleModelSyncRef = useRef<() => void>(() => {});
  const flushPendingModelSyncRef = useRef<() => void>(() => {});
  const syncPayloadRef = useRef<(payload: string) => void>(() => {});
  const refreshSelectedStateRef = useRef<() => void>(() => {});
  const refreshRemoteSelectionBoxesRef = useRef<() => void>(() => {});
  const updateLocalAwarenessRef = useRef<(patch: Partial<RemoteCursorPresence>) => void>(() => {});
  const currentKindRef = useRef(currentKind);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    latestOnChangeRef.current = onChange;
  }, [onChange]);

  const debugSync = useCallback(
    (event: string, detail?: Record<string, unknown>) => {
      if (!debugEnabled) {
        return;
      }
      if (detail) {
        console.debug("[maxgraph-collab]", event, { documentId, ...detail });
        return;
      }
      console.debug("[maxgraph-collab]", event, { documentId });
    },
    [debugEnabled, documentId]
  );

  const normalizeSinglePageDocument = useCallback(
    (document: DrawioDocument): DrawioDocument => {
      const normalized = ensureDocumentIntegrity(document, currentKindRef.current);
      const active = normalized.pages.find((page) => page.id === normalized.activePageId) ?? normalized.pages[0];
      const droppedPageIds = normalized.pages
        .map((page) => page.id)
        .filter((pageId) => pageId !== active?.id);
      if (droppedPageIds.length > 0) {
        const signature = `${active?.id ?? normalized.activePageId}|${droppedPageIds.join(",")}`;
        if (!migratedLegacySignatureRef.current.has(signature)) {
          migratedLegacySignatureRef.current.add(signature);
          const migrationCallback = onLegacyMigrationRef.current;
          if (migrationCallback) {
            void Promise.resolve(
              migrationCallback({
                droppedPageIds,
                activePageId: active?.id ?? normalized.activePageId,
                backupSnapshot: serializeMxfile(normalized)
              })
            );
          }
        }
      }
      const fallback = createEmptyDrawioDocument(currentKindRef.current).pages[0];
      const nextDocument: DrawioDocument = {
        activePageId: canonicalPageId,
        pages: [
          {
            id: canonicalPageId,
            name: active?.name ?? fallback?.name ?? "Diagrama",
            xml: active?.xml ?? fallback?.xml ?? ""
          }
        ]
      };
      if (normalized.host) {
        nextDocument.host = normalized.host;
      }
      if (normalized.etag) {
        nextDocument.etag = normalized.etag;
      }
      if (normalized.modified) {
        nextDocument.modified = normalized.modified;
      }

      return ensureDocumentIntegrity(
        nextDocument,
        currentKindRef.current
      );
    },
    [canonicalPageId]
  );

  const markBootstrapLive = useCallback(
    (source: string) => {
      if (bootstrapCompleteRef.current) {
        return;
      }
      bootstrapCompleteRef.current = true;
      onSyncLifecycleChange?.("live");
      debugSync("bootstrap_complete", { source });
    },
    [debugSync, onSyncLifecycleChange]
  );

  useEffect(() => {
    bootstrapCompleteRef.current = !provider;
    fallbackSeededRef.current = false;
    onSyncLifecycleChange?.(provider ? "bootstrap" : "live");
    debugSync(provider ? "bootstrap_start" : "bootstrap_local_mode");
  }, [debugSync, documentId, onSyncLifecycleChange, provider]);

  const emitSnapshotPayload = useCallback(
    (
      payload: string,
      source: string,
      options?: {
        writeYText?: boolean;
      }
    ) => {
      const writeYText = options?.writeYText !== false;
      lastSyncedPayloadRef.current = payload;
      latestOnChangeRef.current(payload);

      if (writeYText) {
        const current = yText.toString();
        if (current !== payload) {
          applyingRemoteRef.current = true;
          try {
            yText.delete(0, yText.length);
            yText.insert(0, payload);
          } finally {
            applyingRemoteRef.current = false;
          }
        }
      }

      debugSync("snapshot_emit", {
        source,
        bytes: payload.length,
        yText: writeYText
      });
    },
    [applyingRemoteRef, debugSync, lastSyncedPayloadRef, yText]
  );

  const applyDocumentLocally = useCallback(
    (
      document: DrawioDocument,
      source: string,
      options?: {
        importActivePage?: boolean;
      }
    ) => {
      const importActivePage = options?.importActivePage !== false;
      const previous = drawioDocumentRef.current;
      drawioDocumentRef.current = document;
      setDrawioDocument(document);

      if (importActivePage) {
        const graph = graphRef.current;
        const active = getActivePage(document);
        const previousActive = getActivePage(previous);
        const shouldImport =
          graph &&
          active &&
          (!previousActive || previousActive.id !== active.id || previousActive.xml !== active.xml);

        if (graph && active && shouldImport) {
          applyingRemoteRef.current = true;
          try {
            importGraphModelXml(graph, active.xml);
          } finally {
            applyingRemoteRef.current = false;
          }
        }
      }

      refreshSelectedStateRef.current();
      refreshRemoteSelectionBoxesRef.current();
      debugSync("document_apply_local", {
        source,
        pages: document.pages.length,
        activePageId: document.activePageId
      });
    },
    [applyingRemoteRef, debugSync, drawioDocumentRef, graphRef, setDrawioDocument]
  );

  const publishDiagramFromV3 = useCallback(
    (
      source: string,
      options?: {
        importActivePage?: boolean;
        writeYText?: boolean;
      }
    ) => {
      const exported = normalizeSinglePageDocument(
        exportDiagramV3ToDrawioDocument(yDiagramMap, currentKindRef.current),
      );
      const isCanonicalSinglePage =
        exported.pages.length === 1 &&
        exported.activePageId === canonicalPageId &&
        exported.pages[0]?.id === canonicalPageId;
      if (!isCanonicalSinglePage) {
        writeDrawioDocumentToDiagramV3(
          yDiagramMap,
          exported,
          {
            actorId: currentUser.id,
            operation: `${source}_canonicalize`,
            origin: DIAGRAM_V3_LOCAL_ORIGIN
          }
        );
      }
      applyDocumentLocally(
        exported,
        source,
        options?.importActivePage === undefined
          ? undefined
          : { importActivePage: options.importActivePage }
      );
      emitSnapshotPayload(
        serializeMxfile(exported),
        source,
        options?.writeYText === undefined
          ? undefined
          : { writeYText: options.writeYText }
      );

      if (debugEnabled) {
        const diagnostics = getDiagramV3Diagnostics(yDiagramMap);
        debugSync("diagram_v3_diagnostics", {
          source,
          lastRemoteOp: lastRemoteOpRef.current,
          ...diagnostics
        });
      }

      return exported;
    },
    [applyDocumentLocally, canonicalPageId, currentUser.id, debugEnabled, debugSync, emitSnapshotPayload, normalizeSinglePageDocument, yDiagramMap]
  );

  const syncPayload = useCallback(
    (payload: string) => {
      const parsed = parseDiagramSource(payload, currentKindRef.current);
      const normalized = normalizeSinglePageDocument(parsed.document);
      if (parsed.migratedFromLegacy) {
        needsMigrationPersistRef.current = true;
      }

      writeDrawioDocumentToDiagramV3(
        yDiagramMap,
        normalized,
        {
          actorId: currentUser.id,
          operation: "sync_payload",
          origin: DIAGRAM_V3_LOCAL_ORIGIN
        }
      );
      publishDiagramFromV3("sync_payload", {
        importActivePage: true
      });
    },
    [currentUser.id, needsMigrationPersistRef, normalizeSinglePageDocument, publishDiagramFromV3, yDiagramMap]
  );

  const refreshSelectedState = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    setSelectedCell(buildSelectedCellView(graph, drawioDocumentRef.current));
  }, [drawioDocumentRef, graphRef, setSelectedCell]);

  const refreshRemoteSelectionBoxes = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const activePageId = drawioDocumentRef.current.activePageId;
    const singlePageMode = drawioDocumentRef.current.pages.length <= 1;
    const boxes: RemoteSelectionBox[] = [];

    for (const peer of remotePresenceRef.current) {
      if (!singlePageMode && peer.pageId !== activePageId) {
        continue;
      }
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

    setRemoteSelectionBoxes((current) =>
      areRemoteSelectionBoxesEqual(current, boxes) ? current : boxes
    );
  }, [drawioDocumentRef, graphRef, remotePresenceRef, setRemoteSelectionBoxes]);

  const flushModelSync = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || applyingRemoteRef.current) {
      return;
    }

    const activePage = getActivePage(drawioDocumentRef.current);
    if (!activePage) {
      return;
    }

    const modelXml = exportGraphModelXml(graph);
    if (activePage.xml === modelXml) {
      return;
    }
    applyGraphModelXmlToDiagramV3Page(
      yDiagramMap,
      {
        pageId: activePage.id,
        pageName: activePage.name,
        xml: modelXml,
        setActive: true,
        preserveMissing: false
      },
      {
        actorId: currentUser.id,
        operation: "flush_model_sync",
        origin: DIAGRAM_V3_LOCAL_ORIGIN
      }
    );
    pendingRemovedCellIdsRef.current.clear();
    publishDiagramFromV3("flush_model_sync", { importActivePage: false });
    refreshSelectedState();
    refreshRemoteSelectionBoxes();
  }, [
    applyingRemoteRef,
    currentUser.id,
    drawioDocumentRef,
    graphRef,
    publishDiagramFromV3,
    refreshRemoteSelectionBoxes,
    refreshSelectedState,
    yDiagramMap
  ]);

  const scheduleModelSync = useCallback(() => {
    if (pendingModelSyncFrameRef.current !== null || pendingModelSyncTimerRef.current !== null) {
      return;
    }

    pendingModelSyncFrameRef.current = window.requestAnimationFrame(() => {
      pendingModelSyncFrameRef.current = null;
      pendingModelSyncTimerRef.current = window.setTimeout(() => {
        pendingModelSyncTimerRef.current = null;
        flushModelSync();
      }, MODEL_SYNC_DEBOUNCE_MS);
    });
  }, [flushModelSync]);

  const flushPendingModelSync = useCallback(() => {
    if (pendingModelSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingModelSyncFrameRef.current);
      pendingModelSyncFrameRef.current = null;
    }
    if (pendingModelSyncTimerRef.current !== null) {
      window.clearTimeout(pendingModelSyncTimerRef.current);
      pendingModelSyncTimerRef.current = null;
    }
    flushModelSync();
  }, [flushModelSync]);

  const applyIncomingPayload = useCallback(
    (payload: string, source: string) => {
      const parsed = parseDiagramSource(payload, currentKindRef.current);
      const normalized = normalizeSinglePageDocument(parsed.document);
      if (parsed.migratedFromLegacy) {
        needsMigrationPersistRef.current = true;
      }

      writeDrawioDocumentToDiagramV3(
        yDiagramMap,
        normalized,
        {
          actorId: currentUser.id,
          operation: source,
          origin: DIAGRAM_V3_MIGRATION_ORIGIN
        }
      );
      publishDiagramFromV3(source, {
        importActivePage: true
      });
      debugSync("payload_apply_to_v3", {
        source,
        bytes: payload.length
      });
    },
    [
      currentUser.id,
      debugSync,
      needsMigrationPersistRef,
      normalizeSinglePageDocument,
      publishDiagramFromV3,
      yDiagramMap
    ]
  );

  useEffect(() => {
    remotePresenceRef.current = remotePresence;
  }, [remotePresence, remotePresenceRef]);

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
      const next = normalizeSinglePageDocument(updater(drawioDocumentRef.current));

      if (!sync) {
        applyDocumentLocally(next, "commit_document_local", {
          importActivePage
        });
        return;
      }

      writeDrawioDocumentToDiagramV3(
        yDiagramMap,
        next,
        {
          actorId: currentUser.id,
          operation: "commit_document",
          origin: DIAGRAM_V3_LOCAL_ORIGIN
        }
      );
      publishDiagramFromV3("commit_document", {
        importActivePage
      });
    },
    [
      applyDocumentLocally,
      currentUser.id,
      drawioDocumentRef,
      normalizeSinglePageDocument,
      publishDiagramFromV3,
      yDiagramMap
    ]
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
    const updated = updatePageXml(drawioDocumentRef.current, activePage.id, modelXml);
    drawioDocumentRef.current = updated;
    setDrawioDocument(updated);

    applyGraphModelXmlToDiagramV3Page(
      yDiagramMap,
      {
        pageId: activePage.id,
        pageName: activePage.name,
        xml: modelXml,
        setActive: false,
        preserveMissing: false
      },
      {
        actorId: currentUser.id,
        operation: "save_current_page_snapshot",
        origin: DIAGRAM_V3_LOCAL_ORIGIN
      }
    );
    pendingRemovedCellIdsRef.current.clear();
    publishDiagramFromV3("save_current_page_snapshot", {
      importActivePage: false
    });
  }, [currentUser.id, drawioDocumentRef, graphRef, pendingRemovedCellIdsRef, publishDiagramFromV3, setDrawioDocument, yDiagramMap]);

  const applyToolMode = useCallback(
    (tool: ActiveTool) => {
      const graph = graphRef.current;
      if (!graph) {
        return;
      }

      setActiveTool(tool);
      if (tool !== "connect") {
        connectSourceCellIdRef.current = null;
      }
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
    [connectSourceCellIdRef, graphRef, readOnly, setActiveTool]
  );

  const updateLocalAwareness = useCallback(
    (patch: Partial<RemoteCursorPresence>) => {
      const awareness = provider?.awareness;
      if (!awareness || !currentUser.id) {
        return;
      }

      const previous = (awareness.getLocalState()?.[AWARENESS_KEY] as RemoteCursorPresence | undefined) ?? {
        documentId,
        pageId: canonicalPageId,
        userId: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        updatedAt: Date.now()
      };

      awareness.setLocalStateField(AWARENESS_KEY, {
        ...previous,
        documentId,
        pageId: canonicalPageId,
        userId: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        updatedAt: Date.now(),
        ...patch
      });
    },
    [canonicalPageId, currentUser.color, currentUser.id, currentUser.name, documentId, provider?.awareness]
  );

  // Keep callback refs in sync so the graph-init effect always calls the latest
  // version without needing these callbacks in its dependency array.
  scheduleModelSyncRef.current = scheduleModelSync;
  flushPendingModelSyncRef.current = flushPendingModelSync;
  syncPayloadRef.current = syncPayload;
  refreshSelectedStateRef.current = refreshSelectedState;
  refreshRemoteSelectionBoxesRef.current = refreshRemoteSelectionBoxes;
  updateLocalAwarenessRef.current = updateLocalAwareness;
  currentKindRef.current = currentKind;
  providerRef.current = provider;

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness || !currentUser.id) {
      return;
    }

    updateLocalAwareness({
      pageId: canonicalPageId,
      cursor: null,
      selectedCellIds: []
    });

    return () => {
      awareness.setLocalStateField(AWARENESS_KEY, null);
    };
  }, [canonicalPageId, currentUser.id, provider?.awareness, updateLocalAwareness]);

  useEffect(() => {
    if (provider) {
      return;
    }

    if (hasDiagramV3Data(yDiagramMap)) {
      publishDiagramFromV3("bootstrap_local_v3", { importActivePage: true });
      markBootstrapLive("bootstrap_local_v3");
      return;
    }

    const fallbackPayload = value.trim() || yText.toString().trim();
    if (fallbackPayload) {
      applyIncomingPayload(fallbackPayload, "bootstrap_local_payload");
      markBootstrapLive("bootstrap_local_payload");
      return;
    }

    writeDrawioDocumentToDiagramV3(
      yDiagramMap,
      normalizeSinglePageDocument(drawioDocumentRef.current),
      {
        actorId: currentUser.id,
        operation: "bootstrap_local_empty",
        origin: DIAGRAM_V3_MIGRATION_ORIGIN
      }
    );
    publishDiagramFromV3("bootstrap_local_empty", { importActivePage: true });
    markBootstrapLive("bootstrap_local_empty");
  }, [
    applyIncomingPayload,
    currentUser.id,
    drawioDocumentRef,
    markBootstrapLive,
    normalizeSinglePageDocument,
    provider,
    publishDiagramFromV3,
    value,
    yDiagramMap,
    yText
  ]);

  // Graph initialization effect.  Uses refs for all callbacks and changing
  // values so the graph is only created/destroyed when the container, document
  // or provider truly change – NOT when readOnly toggles or callbacks are
  // recreated (those are handled by dedicated effects below).
  useEffect(() => {
    const graphContainer = graphContainerRef.current;
    if (!graphContainer || graphRef.current) {
      return;
    }

    const graph = new Graph(graphContainer);
    graphRef.current = graph;
    const pendingRemovedCellIds = pendingRemovedCellIdsRef.current;
    const graphModel = graph.getDataModel();
    graphModel.setCreateIds(true);
    const graphIdPrefix = `c${String(yText.doc?.clientID ?? "local")}-${documentId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "doc"}-`;
    graphModel.prefix = graphIdPrefix;
    graphModel.postfix = "";

    applyThemeToGraph(graph, currentKindRef.current);

    graph.setConnectable(!readOnlyRef.current);
    graph.setMultigraph(false);
    graph.setAllowDanglingEdges(false);
    graph.setEdgeLabelsMovable(true);
    graph.setVertexLabelsMovable(false);
    graph.setCellsEditable(!readOnlyRef.current);
    graph.setTooltips(true);
    graph.setPanning(true);
    graph.setAutoSizeCells(false);
    graph.gridSize = 16;
    graph.setGridEnabled(true);

    const graphHandler = (graph as any).graphHandler;
    if (graphHandler) {
      graphHandler.guidesEnabled = true;
    }
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const selectionHandler = graph.getPlugin<any>("SelectionHandler");
    if (selectionHandler) {
      selectionHandler.previewColor = "#60a5fa";
      selectionHandler.htmlPreview = true;
      selectionHandler.maxLivePreview = MAX_LIVE_PREVIEW_CELLS;
      selectionHandler.allowLivePreview = !prefersReducedMotion;
      selectionHandler.guidesEnabled = true;
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

    const modelChangeListener = (_sender: unknown, evt: EventObject) => {
      if (applyingRemoteRef.current) {
        return;
      }

      const edit = evt.getProperty("edit") as { changes?: unknown[] } | undefined;
      const eventChanges = evt.getProperty("changes");
      const changes = Array.isArray(edit?.changes)
        ? edit.changes
        : (Array.isArray(eventChanges) ? eventChanges : []);

      changes.forEach((rawChange) => {
        const change = rawChange as {
          child?: { getId?: () => string | null; id?: string };
          cell?: { getId?: () => string | null; id?: string };
          parent?: unknown;
          previous?: unknown;
        };
        const child = change?.child ?? change?.cell;
        const cellId =
          typeof child?.getId === "function"
            ? (child.getId() ?? "")
            : (typeof child?.id === "string" ? child.id : "");
        if (!cellId || cellId === "0" || cellId === "1") {
          return;
        }

        const hasChildField = Object.prototype.hasOwnProperty.call(change ?? {}, "child");
        const hasParentField = Object.prototype.hasOwnProperty.call(change ?? {}, "parent");
        const hasPreviousField = Object.prototype.hasOwnProperty.call(change ?? {}, "previous");
        // Only track structural ChildChange removals. Non-structural changes
        // (style/value/geometry) also expose `previous` and were being treated
        // as removals, which dropped valid cells from persisted snapshots.
        if (!hasChildField || !hasParentField || !hasPreviousField) {
          return;
        }

        const parent = change?.parent ?? null;
        const previous = change?.previous ?? null;
        if (parent === null && previous !== null && typeof previous === "object") {
          pendingRemovedCellIds.add(cellId);
        }
        if (parent !== null) {
          pendingRemovedCellIds.delete(cellId);
        }
      });

      scheduleModelSyncRef.current();
    };

    const selectionListener = () => {
      refreshSelectedStateRef.current();
      const selectedIds = graph
        .getSelectionCells()
        .map((cell) => cell.getId())
        .filter((item): item is string => Boolean(item));
      const signature = selectedIds.join("|");
      if (signature !== lastSelectionSignatureRef.current) {
        lastSelectionSignatureRef.current = signature;
        updateLocalAwarenessRef.current({ selectedCellIds: selectedIds });
      }
      refreshRemoteSelectionBoxesRef.current();
    };

    const viewListener = () => {
      if (pendingViewRefreshFrameRef.current !== null) {
        return;
      }
      pendingViewRefreshFrameRef.current = window.requestAnimationFrame(() => {
        pendingViewRefreshFrameRef.current = null;
        const zoom = Math.round(graph.getView().scale * 100);
        if (zoom !== lastZoomPercentRef.current) {
          lastZoomPercentRef.current = zoom;
          setZoomPercent(zoom);
        }
        setViewRevision((current) => current + 1);
        refreshRemoteSelectionBoxesRef.current();
      });
    };

    const clickToConnectListener = (_sender: unknown, event: EventObject) => {
      if (readOnlyRef.current || activeToolRef.current !== "connect") {
        return;
      }

      const clickedCell = event.getProperty("cell") as Cell | null;
      const cell = resolveConnectableVertex(graph, clickedCell);
      if (!cell) {
        connectSourceCellIdRef.current = null;
        return;
      }

      const sourceCellId = connectSourceCellIdRef.current;
      const targetCellId = cell.getId();
      if (!targetCellId) {
        connectSourceCellIdRef.current = null;
        return;
      }

      if (!sourceCellId || sourceCellId === targetCellId) {
        connectSourceCellIdRef.current = targetCellId;
        graph.setSelectionCell(cell);
        return;
      }

      const sourceCell = graph.getDataModel().getCell(sourceCellId);
      if (!sourceCell || sourceCell.isEdge()) {
        connectSourceCellIdRef.current = targetCellId;
        graph.setSelectionCell(cell);
        return;
      }

      const template = selectedEdgeTemplateRef.current;
      const edgeParams: {
        parent: Cell | null;
        value: string;
        source: Cell;
        target: Cell;
        style: Record<string, string | number | boolean>;
      } = {
        parent: graph.getDefaultParent(),
        value: template?.value ?? "",
        source: sourceCell,
        target: cell,
        style: template?.style ? { ...baseConnectorStyle, ...template.style } : { ...baseConnectorStyle }
      };

      graph.batchUpdate(() => {
        graph.insertEdge(edgeParams);
      });

      connectSourceCellIdRef.current = null;
      graph.setSelectionCell(cell);
    };
    const cellsMovedListener = (_sender: unknown, evt: EventObject) => {
      if (prefersReducedMotion) {
        return;
      }
      const moved = evt.getProperty("cells");
      const movedCells = Array.isArray(moved) ? (moved as Cell[]) : [];
      if (movedCells.length === 0) {
        return;
      }
      const touchHeavyDrag =
        ("ontouchstart" in window || navigator.maxTouchPoints > 0) && movedCells.length > 24;
      if (touchHeavyDrag) {
        return;
      }

      const morph = new Morphing(graph, DRAG_MORPH_STEPS, DRAG_MORPH_EASE, DRAG_MORPH_DELAY);
      morph.cells = movedCells;
      morph.startAnimation();
    };

    graph.getDataModel().addListener(InternalEvent.CHANGE, modelChangeListener);
    graph.getSelectionModel().addListener(InternalEvent.CHANGE, selectionListener);
    graph.getView().addListener(InternalEvent.SCALE, viewListener);
    graph.addListener(InternalEvent.CELLS_MOVED, cellsMovedListener);
    // TRANSLATE can fire at very high frequency while panning and during some
    // internal view updates; avoid subscribing here to reduce render pressure.
    graph.addListener(InternalEvent.CLICK, clickToConnectListener);

    if (outlineContainerRef.current) {
      outlineRef.current = new Outline(graph, outlineContainerRef.current);
      outlineRef.current.updateOnPan = true;
    }

    const active = getActivePage(drawioDocumentRef.current);
    if (active) {
      applyingRemoteRef.current = true;
      try {
        importGraphModelXml(graph, active.xml);
      } finally {
        applyingRemoteRef.current = false;
      }
    }

    refreshSelectedStateRef.current();
    const initialZoom = Math.round(graph.getView().scale * 100);
    lastZoomPercentRef.current = initialZoom;
    setZoomPercent(initialZoom);

    if (needsMigrationPersistRef.current && (!providerRef.current || bootstrapCompleteRef.current)) {
      needsMigrationPersistRef.current = false;
      syncPayloadRef.current(serializeMxfile(drawioDocumentRef.current));
    }

    return () => {
      flushPendingModelSyncRef.current();
      pendingRemovedCellIds.clear();
      lastSelectionSignatureRef.current = "";
      if (pendingViewRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingViewRefreshFrameRef.current);
        pendingViewRefreshFrameRef.current = null;
      }

      graph.getDataModel().removeListener(undoListener);
      graph.getView().removeListener(undoListener);
      graph.getDataModel().removeListener(modelChangeListener);
      graph.getSelectionModel().removeListener(selectionListener);
      graph.getView().removeListener(viewListener);
      graph.removeListener(cellsMovedListener);
      graph.removeListener(clickToConnectListener);

      outlineRef.current?.destroy();
      outlineRef.current = null;

      graph.destroy();
      graphRef.current = null;
    };
    // Only re-create the graph when the DOM container truly changes.  The
    // collaboration provider is accessed via providerRef so that switching from
    // null → HocuspocusProvider (which always happens on document open) does NOT
    // destroy and recreate the entire graph – that was causing a heavy main-thread
    // freeze.  All other changing values (readOnly, callbacks, currentKind) are
    // accessed via refs and handled by dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graphContainerRef,
    graphRef,
    drawioDocumentRef,
    outlineContainerRef,
    outlineRef,
    undoManagerRef,
    applyingRemoteRef,
    needsMigrationPersistRef,
    activeToolRef,
    readOnlyRef,
    connectSourceCellIdRef,
    selectedEdgeTemplateRef,
    setViewRevision,
    setZoomPercent
  ]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.setCellsEditable(!readOnly);
    graph.setConnectable(!readOnly);
  }, [graphRef, readOnly]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    applyThemeToGraph(graph, currentKind);
  }, [currentKind, graphRef]);

  useEffect(() => {
    const syncFromV3 = (_events: unknown[], transaction: { origin: unknown }) => {
      if (applyingRemoteRef.current) {
        return;
      }

      if (
        transaction.origin === DIAGRAM_V3_LOCAL_ORIGIN ||
        transaction.origin === DIAGRAM_V3_MIGRATION_ORIGIN
      ) {
        return;
      }

      if (!hasDiagramV3Data(yDiagramMap)) {
        return;
      }

      // Flush any pending local model sync BEFORE importing remote state.
      // Without this, a locally-created edge (or any graph change) that is
      // still waiting in the debounce queue would be overwritten when the
      // remote Y.js state is imported into the graph – causing the edge to
      // silently disappear.
      flushPendingModelSyncRef.current();

      lastRemoteOpRef.current = `v3:${String(transaction.origin ?? "remote")}`;
      publishDiagramFromV3("v3_observe_remote", {
        importActivePage: true
      });
      if (!bootstrapCompleteRef.current) {
        markBootstrapLive("v3_observe_remote");
      }
    };

    yDiagramMap.observeDeep(syncFromV3);
    return () => {
      yDiagramMap.unobserveDeep(syncFromV3);
    };
  }, [applyingRemoteRef, markBootstrapLive, publishDiagramFromV3, yDiagramMap]);

  useEffect(() => {
    const syncFromLegacyYText = () => {
      if (applyingRemoteRef.current) {
        return;
      }

      const payload = yText.toString().trim();
      if (!payload || payload === lastSyncedPayloadRef.current) {
        return;
      }

      // Flush pending local changes before importing remote legacy payload
      // (same race-condition guard as syncFromV3 above).
      flushPendingModelSyncRef.current();

      lastRemoteOpRef.current = "legacy_ytext";
      applyIncomingPayload(payload, "legacy_ytext_observe");
    };

    yText.observe(syncFromLegacyYText);
    return () => {
      yText.unobserve(syncFromLegacyYText);
    };
  }, [
    applyIncomingPayload,
    applyingRemoteRef,
    lastSyncedPayloadRef,
    yText
  ]);

  useEffect(() => {
    const payload = value.trim();
    if (!payload || payload === lastSyncedPayloadRef.current || provider) {
      return;
    }

    applyIncomingPayload(payload, "external_value");
  }, [applyIncomingPayload, lastSyncedPayloadRef, provider, value]);

  useEffect(() => {
    if (!provider) {
      return;
    }

    const providerState = provider as unknown as { synced?: boolean; status?: string };

    const bootstrapFromV3 = (source: string): boolean => {
      if (!hasDiagramV3Data(yDiagramMap)) {
        return false;
      }
      publishDiagramFromV3(source, {
        importActivePage: true
      });
      markBootstrapLive(source);
      return true;
    };

    const bootstrapFromPayload = (payload: string, source: string): boolean => {
      const normalized = payload.trim();
      if (!normalized) {
        return false;
      }

      applyIncomingPayload(normalized, source);
      markBootstrapLive(source);
      return true;
    };

    const seedFallbackOnce = (source: string) => {
      if (fallbackSeededRef.current) {
        return;
      }
      fallbackSeededRef.current = true;

      const fallbackPayload = latestValueRef.current.trim() || yText.toString().trim();
      if (bootstrapFromPayload(fallbackPayload, source)) {
        return;
      }

      writeDrawioDocumentToDiagramV3(
        yDiagramMap,
        normalizeSinglePageDocument(drawioDocumentRef.current),
        {
          actorId: currentUser.id,
          operation: source,
          origin: DIAGRAM_V3_MIGRATION_ORIGIN
        }
      );
      publishDiagramFromV3(source, {
        importActivePage: true
      });
      markBootstrapLive(source);
    };

    const bootstrapNow = (source: string): boolean => {
      if (bootstrapFromV3(`${source}_v3`)) {
        return true;
      }
      const payload = yText.toString().trim();
      if (bootstrapFromPayload(payload, `${source}_legacy_payload`)) {
        return true;
      }
      return false;
    };

    if (bootstrapNow("provider_buffer")) {
      return;
    }

    if (providerState.synced) {
      seedFallbackOnce("provider_already_synced_seed");
      return;
    }

    const onSynced = () => {
      if (bootstrapNow("provider_synced")) {
        return;
      }
      seedFallbackOnce("provider_synced_seed");
    };

    const timeoutId = window.setTimeout(() => {
      if (bootstrapCompleteRef.current) {
        return;
      }

      if (providerState.status === "connected") {
        if (bootstrapNow("provider_bootstrap_timeout")) {
          return;
        }
        seedFallbackOnce("provider_bootstrap_timeout_seed");
      }
    }, BOOTSTRAP_TIMEOUT_MS);

    provider.on("synced", onSynced);
    return () => {
      window.clearTimeout(timeoutId);
      provider.off("synced", onSynced);
    };
  }, [
    applyIncomingPayload,
    currentUser.id,
    drawioDocumentRef,
    fallbackSeededRef,
    markBootstrapLive,
    normalizeSinglePageDocument,
    provider,
    publishDiagramFromV3,
    yDiagramMap,
    yText
  ]);

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
  }, [currentKind, setRemoteLibraries]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    allLibraries.forEach((library) => {
      const sectionId = `${library.section}:${library.id}`;
      next[sectionId] = loadPaletteSectionState(sectionId);
    });
    setCollapsedSections(next);
  }, [allLibraries, setCollapsedSections]);

  useEffect(() => {
    setSelectedEdgeTemplateId((current) => {
      if (current && edgeTemplateIndex.has(current)) {
        return current;
      }

      const first = edgeTemplateIndex.values().next().value;
      return first?.id ?? null;
    });
  }, [edgeTemplateIndex, setSelectedEdgeTemplateId]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedEdgeTemplate) {
      return;
    }
    graph.getStylesheet().putCellStyle(
      "defaultEdge",
      { ...baseConnectorStyle, ...selectedEdgeTemplate.style } as any
    );
  }, [graphRef, selectedEdgeTemplate]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.setGridEnabled(snapEnabled);
  }, [graphRef, snapEnabled]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const graphHandler = (graph as any).graphHandler;
    if (graphHandler) {
      graphHandler.guidesEnabled = guidesEnabled;
    }
  }, [graphRef, guidesEnabled]);

  useEffect(() => {
    outlineRef.current?.setEnabled(minimapEnabled);
  }, [minimapEnabled, outlineRef]);

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) {
      setRemotePresence((current) => (current.length === 0 ? current : []));
      return;
    }

    const refresh = () => {
      const now = Date.now();
      const peers: RemoteCursorPresence[] = [];
      awareness.getStates().forEach((state: any) => {
        const payload = state?.[AWARENESS_KEY] as RemoteCursorPresence | undefined;
        if (!payload || payload.documentId !== documentId || payload.userId === currentUser.id) {
          return;
        }

        const updatedAt = typeof payload.updatedAt === "number" && Number.isFinite(payload.updatedAt)
          ? payload.updatedAt
          : 0;
        const normalizedUpdatedAt = updatedAt > 0 ? updatedAt : now;
        if (now - normalizedUpdatedAt > PRESENCE_STALE_MS) {
          return;
        }

        peers.push({
          ...payload,
          updatedAt: normalizedUpdatedAt
        });
      });
      peers.sort((a, b) => a.userId.localeCompare(b.userId) || a.pageId.localeCompare(b.pageId));
      setRemotePresence((current) => (areRemotePresenceEqual(current, peers) ? current : peers));
    };

    let refreshFrame: number | null = null;
    let refreshTimer: number | null = null;
    let lastRefreshAt = 0;

    const runRefresh = () => {
      refreshFrame = null;
      lastRefreshAt = Date.now();
      refresh();
    };

    const scheduleRefresh = () => {
      const now = Date.now();
      const delta = now - lastRefreshAt;
      if (delta >= PRESENCE_REFRESH_THROTTLE_MS) {
        if (refreshFrame !== null) {
          return;
        }
        refreshFrame = window.requestAnimationFrame(runRefresh);
        return;
      }

      if (refreshTimer !== null) {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (refreshFrame !== null) {
          return;
        }
        refreshFrame = window.requestAnimationFrame(runRefresh);
      }, PRESENCE_REFRESH_THROTTLE_MS - delta);
    };

    refresh();
    awareness.on("change", scheduleRefresh);
    const ttlTimer = window.setInterval(scheduleRefresh, 5_000);

    return () => {
      awareness.off("change", scheduleRefresh);
      if (refreshFrame !== null) {
        window.cancelAnimationFrame(refreshFrame);
      }
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      window.clearInterval(ttlTimer);
    };
  }, [currentUser.id, documentId, provider?.awareness, setRemotePresence]);

  // Batch remote selection box recalculations into a single rAF to avoid
  // cascading renders when presence changes and window resizes fire closely.
  const pendingBoxRecalcFrameRef = useRef<number | null>(null);

  const scheduleBoxRecalc = useCallback(() => {
    if (pendingBoxRecalcFrameRef.current !== null) {
      return;
    }
    pendingBoxRecalcFrameRef.current = window.requestAnimationFrame(() => {
      pendingBoxRecalcFrameRef.current = null;
      refreshRemoteSelectionBoxesRef.current();
    });
  }, []);

  useEffect(() => {
    scheduleBoxRecalc();
  }, [remotePresence, scheduleBoxRecalc]);

  useEffect(() => {
    const onWindowResize = () => {
      scheduleBoxRecalc();
      setViewRevision((current) => current + 1);
    };

    window.addEventListener("resize", onWindowResize);
    window.visualViewport?.addEventListener("resize", onWindowResize);

    return () => {
      if (pendingBoxRecalcFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingBoxRecalcFrameRef.current);
        pendingBoxRecalcFrameRef.current = null;
      }
      window.removeEventListener("resize", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
    };
  }, [scheduleBoxRecalc, setViewRevision]);

  useEffect(() => {
    const graphContainer = graphContainerRef.current;
    const awareness = provider?.awareness;
    if (!graphContainer || !awareness) {
      return;
    }

    let lastSentAt = 0;
    let scheduledTimer: number | null = null;
    let pendingPoint: { x: number; y: number } | null = null;
    let lastCursorPoint: { x: number; y: number } | null = null;

    const updateCursor = (clientX: number, clientY: number) => {
      const graph = graphRef.current;
      if (!graph) {
        return;
      }
      const rect = graphContainer.getBoundingClientRect();
      const cursor = screenToGraphPoint(graph, {
        x: clientX - rect.left,
        y: clientY - rect.top
      });

      if (
        lastCursorPoint &&
        Math.abs(lastCursorPoint.x - cursor.x) < MIN_CURSOR_DELTA &&
        Math.abs(lastCursorPoint.y - cursor.y) < MIN_CURSOR_DELTA
      ) {
        return;
      }

      lastCursorPoint = cursor;
      updateLocalAwareness({
        cursor
      });
    };

    const flushCursor = () => {
      if (!pendingPoint) {
        return;
      }
      updateCursor(pendingPoint.x, pendingPoint.y);
      lastSentAt = Date.now();
      pendingPoint = null;
      scheduledTimer = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      pendingPoint = { x: event.clientX, y: event.clientY };
      const now = Date.now();
      const delta = now - lastSentAt;
      if (delta >= CURSOR_THROTTLE_MS) {
        flushCursor();
        return;
      }

      if (scheduledTimer !== null) {
        return;
      }

      scheduledTimer = window.setTimeout(() => {
        flushCursor();
      }, CURSOR_THROTTLE_MS - delta);
    };

    const onPointerLeave = () => {
      if (scheduledTimer !== null) {
        window.clearTimeout(scheduledTimer);
        scheduledTimer = null;
      }
      pendingPoint = null;
      lastCursorPoint = null;
      updateLocalAwareness({ cursor: null });
    };

    graphContainer.addEventListener("pointermove", onPointerMove);
    graphContainer.addEventListener("pointerleave", onPointerLeave);
    graphContainer.addEventListener("pointercancel", onPointerLeave);

    return () => {
      if (scheduledTimer !== null) {
        window.clearTimeout(scheduledTimer);
      }
      graphContainer.removeEventListener("pointermove", onPointerMove);
      graphContainer.removeEventListener("pointerleave", onPointerLeave);
      graphContainer.removeEventListener("pointercancel", onPointerLeave);
    };
  }, [graphContainerRef, graphRef, provider?.awareness, updateLocalAwareness]);

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
  }, [graphContainerRef, graphRef, setContextMenu]);

  return {
    syncPayload,
    refreshSelectedState,
    refreshRemoteSelectionBoxes,
    commitDocument,
    saveCurrentPageSnapshot,
    applyToolMode,
    updateLocalAwareness
  };
};
