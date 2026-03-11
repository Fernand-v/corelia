import { useEffect, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Clipboard, type AbstractGraph, type UndoManager } from "@maxgraph/core";

import type {
  ActiveTool,
  CanvasMode,
  GraphToolbarActions,
  GraphToolbarState,
  GridMode
} from "@/components/diagram/maxgraph/types";
import { fitGraph, resetView, zoomToPercent } from "@/lib/diagram/maxgraph/shape-factory";

export type MaxGraphEditorToolbarOptions = {
  activeTool: ActiveTool;
  zoomPercent: number;
  canvasMode: CanvasMode;
  gridMode: GridMode;
  snapEnabled: boolean;
  guidesEnabled: boolean;
  minimapEnabled: boolean;
  fullscreen: boolean;
  readOnly: boolean;

  setCanvasMode: Dispatch<SetStateAction<CanvasMode>>;
  setGridMode: Dispatch<SetStateAction<GridMode>>;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  setGuidesEnabled: Dispatch<SetStateAction<boolean>>;
  setMinimapEnabled: Dispatch<SetStateAction<boolean>>;
  setTemplatesOpen: Dispatch<SetStateAction<boolean>>;

  graphRef: MutableRefObject<AbstractGraph | null>;
  undoManagerRef: MutableRefObject<UndoManager | null>;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;

  applyToolMode: (tool: ActiveTool) => void;
  toggleFullscreen: () => void;
  onDeleteSelection: () => void;
  exportPng: () => Promise<void>;
  exportSvg: () => Promise<void>;
  exportPdf: () => Promise<void>;
  exportXml: () => void;
  copyShareLink: () => Promise<void>;
};

export const useMaxGraphEditorToolbar = (options: MaxGraphEditorToolbarOptions) => {
  const {
    activeTool,
    zoomPercent,
    canvasMode,
    gridMode,
    snapEnabled,
    guidesEnabled,
    minimapEnabled,
    fullscreen,
    readOnly,
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
    toggleFullscreen,
    onDeleteSelection,
    exportPng,
    exportSvg,
    exportPdf,
    exportXml,
    copyShareLink
  } = options;

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

  const toolbarActions: GraphToolbarActions = useMemo(
    () => ({
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
    }),
    [
      applyToolMode,
      copyShareLink,
      exportPdf,
      exportPng,
      exportSvg,
      exportXml,
      fileInputRef,
      graphRef,
      onDeleteSelection,
      readOnly,
      setCanvasMode,
      setGridMode,
      setGuidesEnabled,
      setMinimapEnabled,
      setSnapEnabled,
      setTemplatesOpen,
      toggleFullscreen,
      undoManagerRef
    ]
  );

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

  return {
    toolbarState,
    toolbarActions
  };
};
