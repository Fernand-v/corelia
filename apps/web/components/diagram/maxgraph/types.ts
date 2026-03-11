import type { DiagramKind } from "@corelia/types";

import type { EdgeTemplate, ShapeLibrary, ShapeTemplate } from "@/lib/diagram/maxgraph/palette-catalog";
import type { DrawioDocument } from "@/lib/diagram/maxgraph/xml-format";

export type CanvasMode = "light" | "dark";
export type GridMode = "dots" | "lines" | "none";
export type ActiveTool = "select" | "pan" | "connect" | "text";
export type DiagramOfflineMode = "readonly" | "queue";
export type DiagramSyncLifecycle = "bootstrap" | "live" | "reconnecting" | "offline_queue";

export type RemoteCursorPresence = {
  documentId: string;
  pageId: string;
  userId: string;
  name: string;
  color: string;
  updatedAt: number;
  cursor?: {
    x: number;
    y: number;
  } | null;
  selectedCellIds?: string[];
};

export type PaletteDragPayload = {
  templateId: string;
  libraryId: string;
  kind: "shape";
};

export type GraphToolbarState = {
  activeTool: ActiveTool;
  zoomPercent: number;
  canvasMode: CanvasMode;
  gridMode: GridMode;
  snapEnabled: boolean;
  guidesEnabled: boolean;
  minimapEnabled: boolean;
  fullscreen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
};

export type GraphToolbarActions = {
  setTool: (tool: ActiveTool) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToPercent: (percent: number) => void;
  fit: () => void;
  resetZoom: () => void;
  toggleCanvasMode: () => void;
  setGridMode: (mode: GridMode) => void;
  toggleSnap: () => void;
  toggleGuides: () => void;
  toggleMinimap: () => void;
  toggleFullscreen: () => void;
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  removeSelection: () => void;
  selectAll: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  openTemplates: () => void;
  openImportDialog: () => void;
  exportPng: () => void;
  exportSvg: () => void;
  exportPdf: () => void;
  exportXml: () => void;
  copyShareLink: () => void;
};

export type PaletteViewModel = {
  kind: DiagramKind;
  libraries: ShapeLibrary[];
  search: string;
  collapsed: Record<string, boolean>;
  readOnly: boolean;
  selectedEdgeTemplateId: string | null;
};

export type PaletteActions = {
  onSearch: (value: string) => void;
  toggleSection: (id: string) => void;
  selectDiagramKind: (kind: DiagramKind) => void;
  insertShape: (template: ShapeTemplate) => void;
  selectEdgeTemplate: (template: EdgeTemplate) => void;
};

export type PagesTabsProps = {
  document: DrawioDocument;
  readOnly: boolean;
  onAdd: () => void;
  onRename: (pageId: string) => void;
  onDuplicate: (pageId: string) => void;
  onRemove: (pageId: string) => void;
  onSetActive: (pageId: string) => void;
};
