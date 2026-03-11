import { useCallback, useRef, type ChangeEvent, type Dispatch, type DragEvent, type MutableRefObject, type SetStateAction } from "react";
import type { DiagramKind } from "@corelia/types";
import { type AbstractGraph, type Cell } from "@maxgraph/core";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";

import { styleObjectToString } from "@/components/diagram/maxgraph/maxgraph-style-editor-modal";
import type { DiagramTemplatePreset } from "@/components/diagram/maxgraph/maxgraph-templates-modal";
import type { SelectedCellView } from "@/components/diagram/maxgraph/maxgraph-properties-panel";
import type { ActiveTool, RemoteCursorPresence } from "@/components/diagram/maxgraph/types";
import { persistPaletteSectionState } from "@/components/diagram/maxgraph/maxgraph-palette";
import type { ShapeTemplate } from "@/lib/diagram/maxgraph/palette-catalog";
import {
  getViewportCenter,
  insertShapeTemplate,
  moveCellToCenter
} from "@/lib/diagram/maxgraph/shape-factory";
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
  setActivePage
} from "@/lib/diagram/maxgraph/xml-pages";
import {
  importGraphModelXml,
  parseDiagramSource
} from "@/lib/diagram/maxgraph/xml-serializer";
import {
  cloneStyle,
  encodeMeta,
  toStyleRecord
} from "@/components/diagram/maxgraph/maxgraph-editor-shell-utils";

export type MaxGraphEditorHandlersOptions = {
  documentId: string;
  currentKind: DiagramKind;
  readOnly: boolean;
  activeTool: ActiveTool;
  selectedCell: SelectedCellView;

  drawioDocumentRef: MutableRefObject<DrawioDocument>;
  graphRef: MutableRefObject<AbstractGraph | null>;
  graphContainerRef: MutableRefObject<HTMLDivElement | null>;
  canvasWrapperRef: MutableRefObject<HTMLDivElement | null>;
  rootRef: MutableRefObject<HTMLDivElement | null>;
  applyingRemoteRef: MutableRefObject<boolean>;
  copiedStyleRef: MutableRefObject<Record<string, unknown> | null>;

  shapeTemplateIndex: Map<string, ShapeTemplate>;

  setAddPageModal: Dispatch<SetStateAction<{ open: boolean; inputValue: string }>>;
  setRenamePageModal: Dispatch<SetStateAction<{ open: boolean; pageId: string; currentName: string; inputValue: string }>>;
  setConfirmModal: Dispatch<SetStateAction<{ open: boolean; title: string; message: string; onConfirm: () => void }>>;
  setTemplatesOpen: Dispatch<SetStateAction<boolean>>;
  setStyleEditorOpen: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<{ open: boolean; x: number; y: number }>>;
  setCurrentKind: Dispatch<SetStateAction<DiagramKind>>;
  setDrawioDocument: Dispatch<SetStateAction<DrawioDocument>>;
  setFullscreen: Dispatch<SetStateAction<boolean>>;
  setCollapsedSections: Dispatch<SetStateAction<Record<string, boolean>>>;

  canvasMode: "light" | "dark";

  refreshSelectedState: () => void;
  syncPayload: (payload: string) => void;
  commitDocument: (
    updater: (current: DrawioDocument) => DrawioDocument,
    options?: {
      sync?: boolean;
      importActivePage?: boolean;
    }
  ) => void;
  saveCurrentPageSnapshot: () => void;
  updateLocalAwareness: (patch: Partial<RemoteCursorPresence>) => void;
};

export const useMaxGraphEditorHandlers = (options: MaxGraphEditorHandlersOptions) => {
  const {
    documentId,
    currentKind,
    readOnly,
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
  } = options;

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((current) => {
      const next = !current[sectionId];
      persistPaletteSectionState(sectionId, next);
      return {
        ...current,
        [sectionId]: next
      };
    });
  }, [setCollapsedSections]);

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
    [graphContainerRef, graphRef, readOnly, refreshSelectedState]
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

      const customPayload = event.dataTransfer.getData("application/corelia-maxgraph-template");
      const plainPayload = event.dataTransfer.getData("text/plain");
      const fallbackPayload = plainPayload.startsWith("corelia-maxgraph-template:")
        ? plainPayload.slice("corelia-maxgraph-template:".length)
        : plainPayload;
      const payloadRaw = customPayload || fallbackPayload;
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
    [graphContainerRef, graphRef, readOnly, refreshSelectedState, shapeTemplateIndex]
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
  }, [activeTool, graphContainerRef, graphRef, readOnly, refreshSelectedState]);

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
    [graphRef]
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
    [readOnly, setStyleEditorOpen, withSelectedCell]
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
  }, [graphContainerRef, readOnly, withSelectedCell]);

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
  }, [graphRef]);

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
    [graphRef, readOnly]
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
    const defaultName = `Página ${drawioDocumentRef.current.pages.length + 1}`;
    setAddPageModal({ open: true, inputValue: defaultName });
  }, [drawioDocumentRef, setAddPageModal]);

  const onAddPageConfirm = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      saveCurrentPageSnapshot();
      commitDocument(
        (current) =>
          addPage(current, {
            name: name.trim(),
            xml: createEmptyDrawioDocument(currentKind).pages[0]?.xml ?? ""
          }),
        { importActivePage: true }
      );
    },
    [commitDocument, currentKind, saveCurrentPageSnapshot]
  );

  const onRenamePage = useCallback(
    (pageId: string) => {
      const current = drawioDocumentRef.current.pages.find((page) => page.id === pageId);
      setRenamePageModal({ open: true, pageId, currentName: current?.name ?? "Página", inputValue: current?.name ?? "Página" });
    },
    [drawioDocumentRef, setRenamePageModal]
  );

  const onRenamePageConfirm = useCallback(
    (pageId: string, nextName: string) => {
      if (!nextName.trim()) return;
      commitDocument((value) => renamePage(value, pageId, nextName.trim()));
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

      setConfirmModal({
        open: true,
        title: "Eliminar página",
        message: "¿Eliminar esta página?",
        onConfirm: () => {
          saveCurrentPageSnapshot();
          commitDocument((value) => removePage(value, pageId), { importActivePage: true });
        }
      });
    },
    [commitDocument, drawioDocumentRef, saveCurrentPageSnapshot, setConfirmModal]
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
    [commitDocument, drawioDocumentRef, saveCurrentPageSnapshot, updateLocalAwareness]
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
    [graphRef, readOnly, refreshSelectedState, setTemplatesOpen]
  );

  const pendingImportContentRef = useRef<string | null>(null);

  const applyImportContent = useCallback(
    (content: string) => {
      const parsed = parseDiagramSource(content, currentKind);
      const normalized = ensureDocumentIntegrity(parsed.document, currentKind);
      drawioDocumentRef.current = normalized;
      setDrawioDocument(normalized);

      const graph = graphRef.current;
      if (graph) {
        const active = getActivePage(normalized);
        if (active) {
          applyingRemoteRef.current = true;
          try {
            importGraphModelXml(graph, active.xml);
          } finally {
            applyingRemoteRef.current = false;
          }
        }
      }

      syncPayload(serializeMxfile(normalized));
      refreshSelectedState();
    },
    [applyingRemoteRef, currentKind, drawioDocumentRef, graphRef, refreshSelectedState, setDrawioDocument, syncPayload]
  );

  const onImportFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const content = await file.text();
      event.target.value = "";
      pendingImportContentRef.current = content;

      setConfirmModal({
        open: true,
        title: "Importar XML",
        message: "El XML importado reemplazará el contenido actual. ¿Continuar?",
        onConfirm: () => {
          if (pendingImportContentRef.current !== null) {
            applyImportContent(pendingImportContentRef.current);
            pendingImportContentRef.current = null;
          }
        }
      });
    },
    [applyImportContent, setConfirmModal]
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
  }, [canvasMode, canvasWrapperRef, currentKind, documentId]);

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
  }, [canvasMode, canvasWrapperRef, currentKind, documentId]);

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
  }, [canvasMode, canvasWrapperRef, currentKind, documentId]);

  const exportXml = useCallback(() => {
    const xml = serializeMxfile(drawioDocumentRef.current);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentId}.drawio`;
    link.click();

    URL.revokeObjectURL(url);
  }, [documentId, drawioDocumentRef]);

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
  }, [drawioDocumentRef]);

  const applyKindChange = useCallback(
    (nextKind: DiagramKind) => {
      setCurrentKind(nextKind);

      const nextDocument = createEmptyDrawioDocument(nextKind);
      drawioDocumentRef.current = nextDocument;
      setDrawioDocument(nextDocument);

      const graphInstance = graphRef.current;
      if (graphInstance) {
        const active = getActivePage(nextDocument);
        if (active) {
          applyingRemoteRef.current = true;
          try {
            importGraphModelXml(graphInstance, active.xml);
          } finally {
            applyingRemoteRef.current = false;
          }
        }
      }

      syncPayload(serializeMxfile(nextDocument));
      refreshSelectedState();
    },
    [applyingRemoteRef, drawioDocumentRef, graphRef, refreshSelectedState, setCurrentKind, setDrawioDocument, syncPayload]
  );

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
        setConfirmModal({
          open: true,
          title: "Cambiar tipo de diagrama",
          message: `Cambiar a ${nextKind} puede reiniciar el canvas para aplicar librerías y tema. ¿Deseas continuar?`,
          onConfirm: () => applyKindChange(nextKind)
        });
      } else {
        applyKindChange(nextKind);
      }
    },
    [applyKindChange, currentKind, drawioDocumentRef, graphRef, readOnly, setConfirmModal]
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
  }, [graphRef, readOnly, setContextMenu]);

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
  }, [rootRef, setFullscreen]);

  const onContextSelectConnected = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    const selected = graph.getSelectionCell();
    if (!selected || selected.isEdge()) {
      return;
    }
    const edges = graph.getEdges(selected, null, true, true, true, true);
    graph.setSelectionCells([selected, ...edges]);
  }, [graphRef]);

  const onContextSelectSameType = useCallback(() => {
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
  }, [graphRef]);

  const onContextBringToFront = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || readOnly) {
      return;
    }
    graph.orderCells(false, graph.getSelectionCells());
  }, [graphRef, readOnly]);

  const onContextSendToBack = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || readOnly) {
      return;
    }
    graph.orderCells(true, graph.getSelectionCells());
  }, [graphRef, readOnly]);

  const onContextLockToggle = useCallback(() => {
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
  }, [graphRef, readOnly]);

  const onContextCopyStyle = useCallback(() => {
    const graph = graphRef.current;
    const selected = graph?.getSelectionCell();
    if (!selected) {
      return;
    }
    copiedStyleRef.current = cloneStyle(toStyleRecord(selected.getStyle()));
  }, [copiedStyleRef, graphRef]);

  const onContextPasteStyle = useCallback(() => {
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
  }, [copiedStyleRef, graphRef, readOnly]);

  return {
    toggleSection,
    insertShape,
    onCanvasDrop,
    onDoubleClickCanvas,
    onLabelChange,
    onStylePatch,
    onReplaceStyle,
    onGeometryPatch,
    onCenterCell,
    onHighlightConnection,
    onDeleteConnection,
    onAddMetadata,
    onUpdateMetadata,
    onRemoveMetadata,
    onAddPage,
    onAddPageConfirm,
    onRenamePage,
    onRenamePageConfirm,
    onDuplicatePage,
    onRemovePage,
    onSetActivePage,
    applyTemplate,
    onImportFileSelected,
    exportPng,
    exportSvg,
    exportPdf,
    exportXml,
    copyShareLink,
    onChangeDiagramKind,
    onDeleteSelection,
    toggleFullscreen,
    onContextSelectConnected,
    onContextSelectSameType,
    onContextBringToFront,
    onContextSendToBack,
    onContextLockToggle,
    onContextCopyStyle,
    onContextPasteStyle
  };
};
