// @ts-nocheck
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import React from "react";
import {
  Badge,
  Button,
  Dropdown,
  FluentProvider,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Spinner,
  webLightTheme
} from "@fluentui/react-components";
import {
  Add24Regular,
  AppsList24Regular,
  ArrowDownload24Regular,
  ArrowUndo24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Edit24Regular,
  Grid24Regular,
  History24Regular,
  Open24Regular,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
  Save24Regular,
  Star24Filled,
  Star24Regular
} from "@fluentui/react-icons";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DocumentType
} from "@corelia/types";

import {
  documentsUiPreferencesDefaults,
  readDocumentsUiPreferences,
  writeDocumentsUiPreferences,
  type DocumentsExplorerDensity,
  type DocumentsExplorerViewMode,
  type DocumentsUiPreferences
} from "@/lib/documents-ui-preferences";

type DocumentTypeMeta = {
  label: string;
  icon: string;
  accent: string;
  hint: string;
  placeholder: string;
};

type CollaboratorPresence = {
  userId: string;
  name: string;
  color: string;
  cursorLabel?: string | null;
  lastSeenAt?: string;
};

type ExplorerSort = "updatedDesc" | "updatedAsc" | "nameAsc" | "nameDesc";
type ExplorerTypeFilter = DocumentType | "ALL" | "TRASH" | "FAVORITES";

type CollaborativeDocumentsV2Props = {
  project: {
    id: string;
    name: string;
  };
  documents: Record<DocumentType, CollaborativeDocument[]>;
  documentTypeMeta: Record<DocumentType, DocumentTypeMeta>;
  documentTypeOrder: DocumentType[];
  loading: boolean;
  errorMessage: string | null;
  search: string;
  setSearch: (value: string) => void;
  collaboratorsByDocumentId: Map<string, CollaboratorPresence[]>;
  activeDocument: CollaborativeDocument | null;
  activeDocumentCollaborators: CollaboratorPresence[];
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  connectionState: "connected" | "reconnecting" | "offline";
  syncLabel: {
    label: string;
    tone: string;
  };
  saveStatusBadge:
    | {
        label: string;
        tone: string;
      }
    | null;
  savingVersion: boolean;
  versionPanelOpen: boolean;
  versions: CollaborativeDocumentVersion[];
  editorNode: ReactNode;
  onRetry?: () => void;
  onCreateDocument: (type?: DocumentType) => void;
  onOpenDocument: (document: CollaborativeDocument) => void;
  onRequestDocumentHistory: (document: CollaborativeDocument) => void;
  onCloseDocument: () => void;
  onRenameDocument: (document: CollaborativeDocument, newName: string) => Promise<void>;
  onRequestRename: (document: CollaborativeDocument) => void;
  onRequestDelete: (document: CollaborativeDocument) => void;
  onSaveVersion: () => void;
  onToggleVersionPanel: () => void;
  onRestoreVersion: (
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => Promise<void>;
  onPreviewVersion?: (
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => Promise<string | null>;
  onOpenPreview: (title: string, payload: string | null) => void;
  // New features
  onDuplicateDocument?: ((document: CollaborativeDocument) => Promise<void>) | undefined;
  onToggleFavorite?: ((document: CollaborativeDocument) => Promise<void>) | undefined;
  onRestoreFromTrash?: ((documentId: string) => Promise<void>) | undefined;
  onFetchTrash?: (() => void) | undefined;
  trashItems?: CollaborativeDocument[] | undefined;
  trashLoading?: boolean | undefined;
  onBatchDelete?: ((documentIds: string[]) => Promise<void>) | undefined;
  onBatchRestore?: ((documentIds: string[]) => Promise<void>) | undefined;
  onCreateTemplate?: ((input: { documentId: string; name: string; description?: string }) => Promise<void>) | undefined;
  onFetchTemplates?: (() => void) | undefined;
  templates?: Array<{ id: string; projectId: string | null; type: DocumentType; name: string; description: string | null }> | undefined;
};

type ExplorerRow = {
  id: string;
  type: DocumentType;
  typeLabel: string;
  typeHint: string;
  typeAccent: string;
  name: string;
  updatedAt: string;
  currentVersion: number;
  document: CollaborativeDocument;
  collaborators: CollaboratorPresence[];
  isFavorite?: boolean;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

/**
 * Lightweight renderer: parses mxGraphModel XML and produces a basic SVG
 * preview string.  It handles vertices (rectangles, ellipses, actors, etc.)
 * and edges (simple straight lines between source/target centres).
 */
const diagramXmlToSvg = (xml: string): string | null => {
  try {
    const rootMatch = xml.match(/<root>([\s\S]*?)<\/root>/i);
    if (!rootMatch) return null;
    const cellsXml = rootMatch[1]!;
    const cellRegex = /<mxCell\b[^>]*\/>|<mxCell\b[\s\S]*?<\/mxCell>/gi;
    const cells: Array<{
      id: string;
      vertex: boolean;
      edge: boolean;
      source: string;
      target: string;
      value: string;
      style: Record<string, string>;
      x: number; y: number; w: number; h: number;
    }> = [];

    const parseAttrs = (tag: string) => {
      const attrs: Record<string, string> = {};
      const re = /(\w+)="([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(tag))) attrs[m[1]!] = m[2]!;
      return attrs;
    };

    const parseStyle = (raw: string): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const part of raw.split(";")) {
        const eq = part.indexOf("=");
        if (eq > 0) result[part.slice(0, eq)] = part.slice(eq + 1);
        else if (part.trim()) result.shape = part.trim();
      }
      return result;
    };

    let match: RegExpExecArray | null;
    while ((match = cellRegex.exec(cellsXml))) {
      const full = match[0];
      const a = parseAttrs(full);
      const geoMatch = full.match(/<mxGeometry\b([^>]*)/i);
      const ga = geoMatch ? parseAttrs(geoMatch[1]!) : {};
      cells.push({
        id: a.id ?? "",
        vertex: a.vertex === "1",
        edge: a.edge === "1",
        source: a.source ?? "",
        target: a.target ?? "",
        value: (a.value ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/<[^>]*>/g, ""),
        style: parseStyle(a.style ?? ""),
        x: Number(ga.x) || 0,
        y: Number(ga.y) || 0,
        w: Number(ga.width) || 0,
        h: Number(ga.height) || 0,
      });
    }

    const vertices = cells.filter(c => c.vertex && c.id !== "0" && c.id !== "1");
    const edges = cells.filter(c => c.edge);
    if (vertices.length === 0) return null;

    const cellById = new Map(cells.map(c => [c.id, c]));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of vertices) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x + v.w);
      maxY = Math.max(maxY, v.y + v.h);
    }
    const pad = 20;
    const vbW = maxX - minX + pad * 2;
    const vbH = maxY - minY + pad * 2;
    const ox = -minX + pad;
    const oy = -minY + pad;

    const escSvg = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" style="width:100%;height:100%;max-height:60vh">`);

    // Draw edges
    for (const e of edges) {
      const src = cellById.get(e.source);
      const tgt = cellById.get(e.target);
      if (src && tgt) {
        const x1 = src.x + src.w / 2 + ox;
        const y1 = src.y + src.h / 2 + oy;
        const x2 = tgt.x + tgt.w / 2 + ox;
        const y2 = tgt.y + tgt.h / 2 + oy;
        const stroke = e.style.strokeColor || "#94a3b8";
        const dashed = e.style.dashed === "1" ? ' stroke-dasharray="6 3"' : "";
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escSvg(stroke)}" stroke-width="1.5"${dashed} marker-end="url(#arrowhead)"/>`);
      }
    }

    // Draw vertices
    for (const v of vertices) {
      const vx = v.x + ox;
      const vy = v.y + oy;
      const fill = v.style.fillColor || "#ffffff";
      const stroke = v.style.strokeColor || "#64748b";
      const shape = v.style.shape ?? "";
      const rounded = v.style.rounded === "1";

      if (shape === "umlActor") {
        // Stick figure
        const cx = vx + v.w / 2;
        const headR = Math.min(v.w, v.h) * 0.15;
        const headCy = vy + headR + 2;
        const bodyTop = headCy + headR;
        const bodyBottom = vy + v.h * 0.7;
        const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;
        const legBottom = vy + v.h - 4;
        const armSpan = v.w * 0.35;
        const legSpan = v.w * 0.25;
        parts.push(`<circle cx="${cx}" cy="${headCy}" r="${headR}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
        parts.push(`<line x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${bodyBottom}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
        parts.push(`<line x1="${cx - armSpan}" y1="${armY}" x2="${cx + armSpan}" y2="${armY}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
        parts.push(`<line x1="${cx}" y1="${bodyBottom}" x2="${cx - legSpan}" y2="${legBottom}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
        parts.push(`<line x1="${cx}" y1="${bodyBottom}" x2="${cx + legSpan}" y2="${legBottom}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      } else if (shape === "ellipse" || shape === "doubleEllipse") {
        parts.push(`<ellipse cx="${vx + v.w / 2}" cy="${vy + v.h / 2}" rx="${v.w / 2}" ry="${v.h / 2}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      } else if (shape === "rhombus") {
        const cx = vx + v.w / 2, cy = vy + v.h / 2;
        parts.push(`<polygon points="${cx},${vy} ${vx + v.w},${cy} ${cx},${vy + v.h} ${vx},${cy}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      } else if (shape === "hexagon") {
        const dx = v.w * 0.25;
        parts.push(`<polygon points="${vx + dx},${vy} ${vx + v.w - dx},${vy} ${vx + v.w},${vy + v.h / 2} ${vx + v.w - dx},${vy + v.h} ${vx + dx},${vy + v.h} ${vx},${vy + v.h / 2}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      } else if (shape === "cylinder") {
        const ry = Math.min(v.h * 0.15, 12);
        parts.push(`<path d="M${vx},${vy + ry} L${vx},${vy + v.h - ry} A${v.w / 2},${ry} 0 0,0 ${vx + v.w},${vy + v.h - ry} L${vx + v.w},${vy + ry}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
        parts.push(`<ellipse cx="${vx + v.w / 2}" cy="${vy + ry}" rx="${v.w / 2}" ry="${ry}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      } else if (shape === "triangle") {
        parts.push(`<polygon points="${vx + v.w / 2},${vy} ${vx + v.w},${vy + v.h} ${vx},${vy + v.h}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      } else {
        // Rectangle (default)
        const rx = rounded ? 6 : 0;
        parts.push(`<rect x="${vx}" y="${vy}" width="${v.w}" height="${v.h}" rx="${rx}" fill="${escSvg(fill)}" stroke="${escSvg(stroke)}" stroke-width="1.5"/>`);
      }

      // Label
      if (v.value) {
        const label = v.value.length > 30 ? v.value.slice(0, 27) + "..." : v.value;
        const fontSize = Math.max(9, Math.min(12, v.w / 8));
        const labelY = shape === "umlActor" ? vy + v.h - 2 : vy + v.h / 2;
        parts.push(`<text x="${vx + v.w / 2}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family="system-ui, sans-serif" fill="#1e293b">${escSvg(label)}</text>`);
      }
    }

    // Arrow marker
    parts.push('<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>');
    parts.push("</svg>");
    return parts.join("\n");
  } catch {
    return null;
  }
};

const initialsFromName = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "??";
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
};

const toneToFluentAppearance = (tone: string): "filled" | "tint" | "outline" => {
  if (tone.includes("emerald")) {
    return "filled";
  }
  if (tone.includes("red") || tone.includes("amber") || tone.includes("yellow")) {
    return "tint";
  }
  return "outline";
};

const toneToFluentColor = (
  tone: string
): "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning" => {
  if (tone.includes("emerald")) {
    return "success";
  }
  if (tone.includes("red")) {
    return "danger";
  }
  if (tone.includes("amber") || tone.includes("yellow")) {
    return "warning";
  }
  if (tone.includes("blue")) {
    return "brand";
  }
  return "subtle";
};

const SORT_OPTIONS: Array<{ value: ExplorerSort; label: string }> = [
  { value: "updatedDesc", label: "Más recientes" },
  { value: "updatedAsc", label: "Más antiguos" },
  { value: "nameAsc", label: "Nombre (A-Z)" },
  { value: "nameDesc", label: "Nombre (Z-A)" }
];

const compareRows = (left: ExplorerRow, right: ExplorerRow, sort: ExplorerSort) => {
  if (sort === "updatedAsc") {
    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  }

  if (sort === "updatedDesc") {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }

  if (sort === "nameDesc") {
    return right.name.localeCompare(left.name, "es");
  }

  return left.name.localeCompare(right.name, "es");
};

export const CollaborativeDocumentsModuleV2 = ({
  project,
  documents,
  documentTypeMeta,
  documentTypeOrder,
  loading,
  errorMessage,
  search,
  setSearch,
  collaboratorsByDocumentId,
  activeDocument,
  activeDocumentCollaborators,
  currentUser,
  connectionState,
  syncLabel,
  saveStatusBadge,
  savingVersion,
  versionPanelOpen,
  versions,
  editorNode,
  onRetry,
  onCreateDocument,
  onOpenDocument,
  onRequestDocumentHistory,
  onCloseDocument,
  onRenameDocument,
  onRequestRename,
  onRequestDelete,
  onSaveVersion,
  onToggleVersionPanel,
  onRestoreVersion,
  onPreviewVersion,
  onOpenPreview,
  onDuplicateDocument,
  onToggleFavorite,
  onRestoreFromTrash,
  onFetchTrash,
  trashItems = [],
  trashLoading = false,
  onBatchDelete,
  onBatchRestore,
  onCreateTemplate,
  onFetchTemplates,
  templates = []
}: CollaborativeDocumentsV2Props) => {
  const [preferences, setPreferences] = useState<DocumentsUiPreferences>(
    documentsUiPreferencesDefaults
  );
  const [typeFilter, setTypeFilter] = useState<ExplorerTypeFilter>("ALL");
  const [sortBy, setSortBy] = useState<ExplorerSort>("updatedDesc");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templateSaveTarget, setTemplateSaveTarget] = useState<CollaborativeDocument | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState<{ version: CollaborativeDocumentVersion } | null>(null);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [svgPreview, setSvgPreview] = useState<{ title: string; svg: string } | null>(null);

  useEffect(() => {
    setPreferences(readDocumentsUiPreferences());
  }, []);

  useEffect(() => {
    writeDocumentsUiPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    setTitleDraft(activeDocument?.name ?? "");
    if (!activeDocument) {
      setSelectedDocumentId(null);
    }
  }, [activeDocument?.id, activeDocument?.name, activeDocument]);

  const typeCounts = useMemo(() => {
    return documentTypeOrder.reduce(
      (acc, type) => {
        acc[type] = documents[type].length;
        return acc;
      },
      {
        TEXTO: 0,
        DIAGRAMA: 0,
        TABLA: 0,
        WHITEBOARD: 0,
        PRESENTACION: 0
      } as Record<DocumentType, number>
    );
  }, [documents, documentTypeOrder]);

  const rows = useMemo<ExplorerRow[]>(() => {
    return documentTypeOrder.flatMap((type) =>
      documents[type].map((document) => {
        const meta = documentTypeMeta[type];
        return {
          id: document.id,
          type,
          typeLabel: meta.label,
          typeHint: meta.hint,
          typeAccent: meta.accent,
          name: document.name,
          updatedAt: document.updatedAt,
          currentVersion: document.currentVersion,
          document,
          collaborators: collaboratorsByDocumentId.get(document.id) ?? [],
          isFavorite: (document as CollaborativeDocument & { isFavorite?: boolean }).isFavorite
        };
      })
    );
  }, [collaboratorsByDocumentId, documentTypeMeta, documentTypeOrder, documents]);

  const recentDocs = useMemo(() => {
    return [...rows].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ).slice(0, 5);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (typeFilter === "TRASH" || typeFilter === "FAVORITES") {
      return []; // handled separately
    }

    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => (typeFilter === "ALL" ? true : row.type === typeFilter))
      .filter((row) => {
        if (!query) {
          return true;
        }

        const content = `${row.name} ${row.typeLabel} ${row.typeHint}`.toLowerCase();
        return content.includes(query);
      })
      .sort((left, right) => compareRows(left, right, sortBy));
  }, [rows, search, sortBy, typeFilter]);

  const favoriteRows = useMemo(() => {
    return rows.filter((row) => row.isFavorite);
  }, [rows]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      sidebarCollapsed: !current.sidebarCollapsed
    }));
  }, []);

  const setViewMode = useCallback((viewMode: DocumentsExplorerViewMode) => {
    setPreferences((current) => ({
      ...current,
      viewMode
    }));
  }, []);

  const setDensity = useCallback((density: DocumentsExplorerDensity) => {
    setPreferences((current) => ({
      ...current,
      density
    }));
  }, []);

  const commitDocumentTitle = useCallback(async () => {
    if (!activeDocument) {
      return;
    }

    const nextName = titleDraft.trim();
    if (!nextName || nextName === activeDocument.name) {
      setTitleDraft(activeDocument.name);
      return;
    }

    setSavingTitle(true);
    try {
      await onRenameDocument(activeDocument, nextName);
    } finally {
      setSavingTitle(false);
    }
  }, [activeDocument, onRenameDocument, titleDraft]);

  const renderCollaboratorAvatar = (user: CollaboratorPresence) => (
    <span
      key={user.userId}
      title={user.name}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white text-[10px] font-semibold text-white"
      style={{ backgroundColor: user.color }}
    >
      {initialsFromName(user.name)}
    </span>
  );

  const explorerDensityRowClass =
    preferences.density === "compact" ? "h-10 text-xs" : "h-12 text-sm";

  const explorerView = (
    <div data-testid="documents-v2-explorer" className="flex h-full min-h-0 flex-col bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white px-3 py-3 md:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500">{project.name} · Documentos</p>
              <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
            </div>
            <Button
              appearance="primary"
              icon={<Add24Regular />}
              onClick={() => onCreateDocument()}
            >
              Nuevo documento
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(_, data) => setSearch(data.value)}
              placeholder="Buscar por nombre o tipo…"
              className="min-w-[220px] flex-1"
            />
            <Dropdown
              value={SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? ""}
              selectedOptions={[sortBy]}
              onOptionSelect={(_, data) => {
                const option = data.optionValue as ExplorerSort | undefined;
                if (option) {
                  setSortBy(option);
                }
              }}
              className="min-w-[190px]"
            >
              {SORT_OPTIONS.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Dropdown>
            <div className="hidden items-center gap-1 md:flex">
              <Button
                appearance={preferences.viewMode === "list" ? "primary" : "secondary"}
                icon={<AppsList24Regular />}
                onClick={() => setViewMode("list")}
              >
                Lista
              </Button>
              <Button
                appearance={preferences.viewMode === "grid" ? "primary" : "secondary"}
                icon={<Grid24Regular />}
                onClick={() => setViewMode("grid")}
              >
                Tarjetas
              </Button>
            </div>
            <div className="hidden items-center gap-1 md:flex">
              <Button
                appearance={preferences.density === "comfortable" ? "primary" : "secondary"}
                onClick={() => setDensity("comfortable")}
              >
                Cómodo
              </Button>
              <Button
                appearance={preferences.density === "compact" ? "primary" : "secondary"}
                onClick={() => setDensity("compact")}
              >
                Compacto
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`hidden border-r border-slate-200 bg-white transition-[width] duration-150 md:flex md:flex-col ${
            preferences.sidebarCollapsed ? "w-16" : "w-64"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-2 py-2">
            <span className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${preferences.sidebarCollapsed ? "sr-only" : ""}`}>
              Tipos
            </span>
            <Button
              appearance="subtle"
              size="small"
              icon={
                preferences.sidebarCollapsed ? (
                  <PanelLeftExpand24Regular />
                ) : (
                  <PanelLeftContract24Regular />
                )
              }
              onClick={toggleSidebar}
              aria-label={preferences.sidebarCollapsed ? "Expandir panel" : "Colapsar panel"}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <button
              type="button"
              onClick={() => { setTypeFilter("ALL"); setShowTrash(false); setShowFavorites(false); }}
              data-testid="documents-v2-filter-ALL"
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                typeFilter === "ALL" ? "bg-[#e8f0ff] text-[#0f4d9d]" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">📁</span>
              {!preferences.sidebarCollapsed ? (
                <>
                  <span className="flex-1 font-medium">Todos</span>
                  <span className="text-xs text-slate-500">{rows.length}</span>
                </>
              ) : null}
            </button>
            {documentTypeOrder.map((type) => {
              const meta = documentTypeMeta[type];
              const isActive = typeFilter === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setTypeFilter(type); setShowTrash(false); setShowFavorites(false); }}
                  data-testid={`documents-v2-filter-${type}`}
                  className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-[#e8f0ff] text-[#0f4d9d]" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden className="text-base">
                    {meta.icon}
                  </span>
                  {!preferences.sidebarCollapsed ? (
                    <>
                      <span className="flex-1 font-medium">{meta.label}</span>
                      <span className="text-xs text-slate-500">{typeCounts[type]}</span>
                    </>
                  ) : null}
                </button>
              );
            })}

            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => { setTypeFilter("FAVORITES"); setShowTrash(false); setShowFavorites(true); }}
                data-testid="documents-v2-filter-FAVORITES"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  typeFilter === "FAVORITES" ? "bg-[#e8f0ff] text-[#0f4d9d]" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-base">⭐</span>
                {!preferences.sidebarCollapsed ? (
                  <>
                    <span className="flex-1 font-medium">Favoritos</span>
                    <span className="text-xs text-slate-500">{favoriteRows.length}</span>
                  </>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("TRASH");
                  setShowTrash(true);
                  setShowFavorites(false);
                  onFetchTrash?.();
                }}
                data-testid="documents-v2-filter-TRASH"
                className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  typeFilter === "TRASH" ? "bg-[#e8f0ff] text-[#0f4d9d]" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-base">🗑️</span>
                {!preferences.sidebarCollapsed ? (
                  <span className="flex-1 font-medium">Papelera</span>
                ) : null}
              </button>
            </div>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-3 py-2 md:hidden">
            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                appearance={typeFilter === "ALL" ? "primary" : "secondary"}
                onClick={() => setTypeFilter("ALL")}
                data-testid="documents-v2-mobile-filter-ALL"
              >
                Todos
              </Button>
              {documentTypeOrder.map((type) => (
                <Button
                  key={type}
                  size="small"
                  appearance={typeFilter === type ? "primary" : "secondary"}
                  onClick={() => setTypeFilter(type)}
                  data-testid={`documents-v2-mobile-filter-${type}`}
                >
                  {documentTypeMeta[type].label}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner label="Cargando documentos…" />
            </div>
          ) : null}

          {!loading && errorMessage ? (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{errorMessage}</p>
              {onRetry ? (
                <Button className="mt-3" appearance="secondary" onClick={onRetry}>
                  Reintentar
                </Button>
              ) : null}
            </div>
          ) : null}

          {!loading && !errorMessage ? (
            <>
              {/* ── Trash view ── */}
              {showTrash ? (
                <div className="h-full overflow-auto">
                  {trashLoading ? (
                    <div className="flex h-32 items-center justify-center">
                      <Spinner label="Cargando papelera…" />
                    </div>
                  ) : (
                    <>
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            {onBatchRestore ? <th className="w-10 px-3 py-2" /> : null}
                            <th className="px-3 py-2">Nombre</th>
                            <th className="px-3 py-2">Tipo</th>
                            <th className="px-3 py-2">Eliminado</th>
                            <th className="px-3 py-2">Purga en</th>
                            <th className="px-3 py-2 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trashItems.map((doc) => {
                            const daysLeft = doc.purgeAt
                              ? Math.max(0, Math.ceil((new Date(doc.purgeAt).getTime() - Date.now()) / 86400000))
                              : 0;
                            return (
                              <tr key={doc.id} className="border-b border-slate-100 h-12 bg-white hover:bg-slate-50">
                                {onBatchRestore ? (
                                  <td className="px-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(doc.id)}
                                      onChange={() => toggleDocSelection(doc.id)}
                                      className="h-4 w-4 rounded border-slate-300"
                                    />
                                  </td>
                                ) : null}
                                <td className="px-3 text-sm font-semibold text-slate-900">{doc.name}</td>
                                <td className="px-3 text-sm text-slate-600">{doc.type}</td>
                                <td className="px-3 text-sm text-slate-500">{doc.deletedAt ? formatDateTime(doc.deletedAt) : "—"}</td>
                                <td className="px-3 text-sm text-slate-500">{daysLeft} días</td>
                                <td className="px-3 text-right">
                                  <Button
                                    size="small"
                                    appearance="primary"
                                    icon={<ArrowUndo24Regular />}
                                    onClick={() => onRestoreFromTrash?.(doc.id)}
                                  >
                                    Restaurar
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {trashItems.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-slate-500">
                          La papelera está vacía.
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : showFavorites ? (
                /* ── Favorites view ── */
                <div className="h-full overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Modificado</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {favoriteRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 h-12 bg-white hover:bg-slate-50">
                          <td className="px-3">
                            <button type="button" onClick={() => onOpenDocument(row.document)} className="text-left font-semibold text-slate-900 hover:text-[#0a84ff]">
                              {row.name}
                            </button>
                          </td>
                          <td className="px-3 text-sm text-slate-600">{row.typeLabel}</td>
                          <td className="px-3 text-sm text-slate-500">{formatDateTime(row.updatedAt)}</td>
                          <td className="px-3 text-right">
                            <Button size="small" icon={<Open24Regular />} onClick={() => onOpenDocument(row.document)}>
                              Abrir
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {favoriteRows.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-slate-500">
                      No tienes documentos favoritos.
                    </div>
                  ) : null}
                </div>
              ) : (
                /* ── Normal explorer view ── */
                <>
                  {/* Recientes */}
                  {typeFilter === "ALL" && recentDocs.length > 0 && !search.trim() ? (
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recientes</h3>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {recentDocs.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => onOpenDocument(row.document)}
                            className="flex min-w-[160px] max-w-[200px] shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-left transition-colors hover:bg-white"
                          >
                            <div className="mb-1 h-1 w-8 rounded-full" style={{ backgroundColor: row.typeAccent }} />
                            <span className="line-clamp-1 text-xs font-semibold text-slate-800">{row.name}</span>
                            <span className="text-[10px] text-slate-500">{row.typeLabel} · {formatDateTime(row.updatedAt)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {preferences.viewMode === "list" ? (
                    <div className="h-full overflow-auto">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            {onBatchDelete ? <th className="w-10 px-3 py-2" /> : null}
                            {onToggleFavorite ? <th className="w-10 px-3 py-2" /> : null}
                            <th className="px-3 py-2">Nombre</th>
                            <th className="px-3 py-2">Tipo</th>
                            <th className="px-3 py-2">Modificado</th>
                            <th className="px-3 py-2">Colaboradores</th>
                            <th className="px-3 py-2">Versión</th>
                            <th className="px-3 py-2 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row) => {
                            const isSelected = selectedDocumentId === row.id;
                            return (
                              <tr
                                key={row.id}
                                data-testid={`documents-v2-row-${row.id}`}
                                className={`border-b border-slate-100 ${explorerDensityRowClass} ${
                                  isSelected ? "bg-[#eef4ff]" : "bg-white hover:bg-slate-50"
                                }`}
                                onClick={() => setSelectedDocumentId(row.id)}
                                onDoubleClick={() => onOpenDocument(row.document)}
                              >
                                {onBatchDelete ? (
                                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(row.id)}
                                      onChange={() => toggleDocSelection(row.id)}
                                      className="h-4 w-4 rounded border-slate-300"
                                    />
                                  </td>
                                ) : null}
                                {onToggleFavorite ? (
                                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => onToggleFavorite(row.document)}
                                      className="text-slate-400 hover:text-yellow-500"
                                    >
                                      {row.isFavorite ? <span className="text-yellow-500"><Star24Filled /></span> : <Star24Regular />}
                                    </button>
                                  </td>
                                ) : null}
                                <td className="px-3">
                                  <button
                                    type="button"
                                    onClick={() => onOpenDocument(row.document)}
                                    data-testid={`documents-v2-open-${row.id}`}
                                    className="text-left font-semibold text-slate-900 hover:text-[#0a84ff]"
                                  >
                                    {row.name}
                                  </button>
                                </td>
                                <td className="px-3 text-slate-600">{row.typeLabel}</td>
                                <td className="px-3 text-slate-500">{formatDateTime(row.updatedAt)}</td>
                                <td className="px-3">
                                  <div className="flex items-center gap-1">
                                    {row.collaborators.slice(0, 3).map(renderCollaboratorAvatar)}
                                    {row.collaborators.length > 3 ? (
                                      <span className="text-xs text-slate-500">+{row.collaborators.length - 3}</span>
                                    ) : null}
                                    {row.collaborators.length === 0 ? (
                                      <span className="text-xs text-slate-400">Sin actividad</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 text-slate-500">v{row.currentVersion}</td>
                                <td className="px-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="small"
                                      appearance="secondary"
                                      icon={<Open24Regular />}
                                      data-testid={`documents-v2-action-open-${row.id}`}
                                      onClick={() => onOpenDocument(row.document)}
                                    >
                                      Abrir
                                    </Button>
                                    <Button
                                      size="small"
                                      appearance="secondary"
                                      icon={<History24Regular />}
                                      data-testid={`documents-v2-action-history-${row.id}`}
                                      onClick={() => onRequestDocumentHistory(row.document)}
                                    >
                                      Historial
                                    </Button>
                                    <div
                                      onClick={(event) => event.stopPropagation()}
                                      onDoubleClick={(event) => event.stopPropagation()}
                                    >
                                      <Menu positioning="below-end">
                                        <MenuTrigger disableButtonEnhancement>
                                          <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={<Edit24Regular />}
                                            aria-label="Más acciones"
                                          />
                                        </MenuTrigger>
                                        <MenuPopover>
                                          <MenuList>
                                            <MenuItem onClick={() => onRequestRename(row.document)}>
                                              Renombrar
                                            </MenuItem>
                                            {onDuplicateDocument ? (
                                              <MenuItem onClick={() => void onDuplicateDocument(row.document)}>
                                                Duplicar
                                              </MenuItem>
                                            ) : null}
                                            <MenuItem onClick={() => onRequestDelete(row.document)}>
                                              Eliminar
                                            </MenuItem>
                                          </MenuList>
                                        </MenuPopover>
                                      </Menu>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredRows.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-slate-500">
                          No hay documentos para los filtros seleccionados.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredRows.map((row) => (
                        <article
                          key={row.id}
                          className={`rounded-xl border bg-white p-4 shadow-sm ${
                            selectedDocumentId === row.id ? "border-[#8ab4f8]" : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className="mb-3 h-1.5 w-16 rounded-full"
                              style={{ backgroundColor: row.typeAccent }}
                            />
                            <div className="flex items-center gap-1">
                              {onBatchDelete ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(row.id)}
                                  onChange={() => toggleDocSelection(row.id)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              ) : null}
                              {onToggleFavorite ? (
                                <button type="button" onClick={() => onToggleFavorite(row.document)} className="text-slate-400 hover:text-yellow-500">
                                  {row.isFavorite ? <span className="text-yellow-500"><Star24Filled /></span> : <Star24Regular />}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mb-1 text-xs font-semibold text-slate-500">{row.typeLabel}</div>
                          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900">
                            {row.name}
                          </h3>
                          <p className="text-xs text-slate-500">{formatDateTime(row.updatedAt)}</p>
                          <div className="mt-3 flex items-center gap-2">
                            {row.collaborators.slice(0, 3).map(renderCollaboratorAvatar)}
                            {row.collaborators.length > 3 ? (
                              <span className="text-xs text-slate-500">+{row.collaborators.length - 3}</span>
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="small" icon={<Open24Regular />} onClick={() => onOpenDocument(row.document)}>
                              Abrir
                            </Button>
                            <Button
                              size="small"
                              appearance="secondary"
                              icon={<History24Regular />}
                              onClick={() => onRequestDocumentHistory(row.document)}
                            >
                              Historial
                            </Button>
                            <div
                              onClick={(event) => event.stopPropagation()}
                              onDoubleClick={(event) => event.stopPropagation()}
                            >
                              <Menu>
                                <MenuTrigger disableButtonEnhancement>
                                  <Button size="small" appearance="subtle" icon={<Edit24Regular />} aria-label="Más acciones" />
                                </MenuTrigger>
                                <MenuPopover>
                                  <MenuList>
                                    <MenuItem onClick={() => onRequestRename(row.document)}>
                                      Renombrar
                                    </MenuItem>
                                    {onDuplicateDocument ? (
                                      <MenuItem onClick={() => void onDuplicateDocument(row.document)}>
                                        Duplicar
                                      </MenuItem>
                                    ) : null}
                                    <MenuItem onClick={() => onRequestDelete(row.document)}>
                                      Eliminar
                                    </MenuItem>
                                  </MenuList>
                                </MenuPopover>
                              </Menu>
                            </div>
                          </div>
                        </article>
                      ))}
                      {filteredRows.length === 0 ? (
                        <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                          No hay documentos para los filtros seleccionados.
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}

              {/* ── Batch actions floating bar ── */}
              {selectedIds.size > 0 ? (
                <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
                  <span className="text-sm font-medium text-slate-700">{selectedIds.size} seleccionados</span>
                  {showTrash && onBatchRestore ? (
                    <Button
                      size="small"
                      appearance="primary"
                      icon={<ArrowUndo24Regular />}
                      onClick={() => {
                        void onBatchRestore([...selectedIds]).then(() => setSelectedIds(new Set()));
                      }}
                    >
                      Restaurar seleccionados
                    </Button>
                  ) : null}
                  {!showTrash && onBatchDelete ? (
                    <Button
                      size="small"
                      appearance="primary"
                      icon={<Delete24Regular />}
                      onClick={() => {
                        void onBatchDelete([...selectedIds]).then(() => setSelectedIds(new Set()));
                      }}
                    >
                      Eliminar seleccionados
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    appearance="subtle"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );

  const editorView = activeDocument ? (
    <div data-testid="documents-v2-editor" className="flex h-full min-h-0 flex-col bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white px-3 py-3 md:px-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">
                Documentos / {documentTypeMeta[activeDocument.type].label}
              </p>
              <Input
                value={titleDraft}
                onChange={(_, data) => setTitleDraft(data.value)}
                onBlur={() => void commitDocumentTitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void commitDocumentTitle();
                  }
                }}
                disabled={savingTitle}
                className="mt-1 w-full md:max-w-lg"
                appearance="underline"
              />
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Badge
                appearance={toneToFluentAppearance(syncLabel.tone)}
                color={toneToFluentColor(syncLabel.tone)}
              >
                {syncLabel.label}
              </Badge>
              {saveStatusBadge ? (
                <Badge
                  appearance={toneToFluentAppearance(saveStatusBadge.tone)}
                  color={toneToFluentColor(saveStatusBadge.tone)}
                >
                  {saveStatusBadge.label}
                </Badge>
              ) : null}
              <Button
                icon={<Save24Regular />}
                appearance="primary"
                onClick={onSaveVersion}
                disabled={savingVersion}
              >
                {savingVersion ? "Guardando…" : "Guardar versión"}
              </Button>
              {onCreateTemplate ? (
                <Button
                  icon={<Copy24Regular />}
                  appearance="secondary"
                  onClick={() => {
                    if (activeDocument) {
                      setTemplateSaveTarget(activeDocument);
                      setTemplateName(activeDocument.name);
                      setTemplateDesc("");
                    }
                  }}
                >
                  Plantilla
                </Button>
              ) : null}
              {activeDocument && ["TEXTO", "TABLA", "DIAGRAMA", "WHITEBOARD"].includes(activeDocument.type) ? (
                <Menu positioning="below-end">
                  <MenuTrigger disableButtonEnhancement>
                    <Button
                      icon={<ArrowDownload24Regular />}
                      appearance="secondary"
                    >
                      Exportar
                    </Button>
                  </MenuTrigger>
                  <MenuPopover inline>
                    <MenuList>
                      {activeDocument.type === "TEXTO" ? (
                        <MenuItem onClick={() => {
                          const editorEl = window.document.querySelector(".ProseMirror");
                          if (editorEl) {
                            const html = editorEl.innerHTML;
                            const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: "text/html" });
                            const a = window.document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `${activeDocument.name}.html`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }
                        }}>
                          Exportar HTML
                        </MenuItem>
                      ) : null}
                      {activeDocument.type === "TABLA" ? (
                        <MenuItem onClick={() => {
                          const table = window.document.querySelector(".ag-root-wrapper");
                          if (table) {
                            const tableRows = table.querySelectorAll(".ag-row");
                            const csvRows: string[] = [];
                            const headers = table.querySelectorAll(".ag-header-cell-text");
                            if (headers.length) {
                              csvRows.push(Array.from(headers).map(h => h.textContent ?? "").join(","));
                            }
                            tableRows.forEach(tr => {
                              const cells = tr.querySelectorAll(".ag-cell");
                              csvRows.push(Array.from(cells).map(c => `"${(c.textContent ?? "").replace(/"/g, '""')}"`).join(","));
                            });
                            const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
                            const a = window.document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `${activeDocument.name}.csv`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }
                        }}>
                          Exportar CSV
                        </MenuItem>
                      ) : null}
                      {activeDocument.type === "DIAGRAMA" ? (
                        <MenuItem onClick={() => {
                          const svg = window.document.querySelector(".react-flow svg, .react-flow__viewport");
                          if (svg) {
                            const serializer = new XMLSerializer();
                            const svgStr = serializer.serializeToString(svg);
                            const blob = new Blob([svgStr], { type: "image/svg+xml" });
                            const a = window.document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `${activeDocument.name}.svg`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }
                        }}>
                          Exportar SVG
                        </MenuItem>
                      ) : null}
                      {activeDocument.type === "WHITEBOARD" ? (
                        <MenuItem onClick={() => {
                          const svgEl = window.document.querySelector(".tl-svg-context svg, .tldraw svg");
                          if (svgEl) {
                            const serializer = new XMLSerializer();
                            const svgStr = serializer.serializeToString(svgEl);
                            const blob = new Blob([svgStr], { type: "image/svg+xml" });
                            const a = window.document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `${activeDocument.name}.svg`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }
                        }}>
                          Exportar SVG
                        </MenuItem>
                      ) : null}
                    </MenuList>
                  </MenuPopover>
                </Menu>
              ) : null}
              <Button
                icon={<History24Regular />}
                appearance={versionPanelOpen ? "primary" : "secondary"}
                onClick={onToggleVersionPanel}
              >
                Historial
              </Button>
              <Button
                icon={<Dismiss24Regular />}
                appearance="secondary"
                onClick={onCloseDocument}
              >
                Documentos
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{activeDocumentCollaborators.length} colaborando</span>
            <div className="flex items-center gap-1">
              {activeDocumentCollaborators.slice(0, 6).map(renderCollaboratorAvatar)}
              {activeDocumentCollaborators.length === 0 ? (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white text-[10px] font-semibold text-white"
                  style={{ backgroundColor: currentUser.color }}
                  title={currentUser.name}
                >
                  {initialsFromName(currentUser.name)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {connectionState === "reconnecting" ? (
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-800">
          {activeDocument?.type === "DIAGRAMA"
            ? "Reconectando… sincronización pendiente del diagrama."
            : "Reconectando… El documento volverá a modo colaborativo al restablecer conexión."}
        </div>
      ) : null}
      {connectionState === "offline" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          {activeDocument?.type === "DIAGRAMA"
            ? "Sin conexión. Cambios en cola local (sesión actual) hasta reconectar."
            : "Sin conexión. El documento está en solo lectura hasta reconectar."}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <section className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">{editorNode}</section>
        {versionPanelOpen ? (
          <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white p-3 md:block">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Historial
              </h3>
              <Badge appearance="outline">{versions.length}</Badge>
            </header>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 12rem)" }}>
              {versions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                  Sin versiones registradas.
                </p>
              ) : (
                versions.map((version) => (
                  <article
                    key={version.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">v{version.versionNumber}</span>
                      <Badge appearance="outline">
                        {version.kind === "MANUAL" ? "Manual" : "Auto"}
                      </Badge>
                    </div>
                    <p>{formatDateTime(version.createdAt)}</p>
                    <p className="truncate">{version.createdByName ?? version.createdById}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="small"
                        appearance="secondary"
                        icon={<History24Regular />}
                        onClick={() => setRestoreConfirm({ version })}
                      >
                        Restaurar
                      </Button>
                      {onPreviewVersion ? (
                        <Button
                          size="small"
                          appearance="subtle"
                          onClick={async () => {
                            const payload = await onPreviewVersion(activeDocument, version);
                            if (activeDocument?.type === "DIAGRAMA" && payload) {
                              const svg = diagramXmlToSvg(payload);
                              if (svg) {
                                setSvgPreview({ title: `Preview v${version.versionNumber}`, svg });
                                return;
                              }
                            }
                            onOpenPreview(`Preview v${version.versionNumber}`, payload);
                          }}
                        >
                          Ver
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {versionPanelOpen ? (
        <aside className="border-t border-slate-200 bg-white p-3 md:hidden">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Historial
            </h3>
            <Badge appearance="outline">{versions.length}</Badge>
          </header>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {versions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                Sin versiones registradas.
              </p>
            ) : (
              versions.map((version) => (
                <article
                  key={`mobile-${version.id}`}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">v{version.versionNumber}</span>
                    <Badge appearance="outline">
                      {version.kind === "MANUAL" ? "Manual" : "Auto"}
                    </Badge>
                  </div>
                  <p>{formatDateTime(version.createdAt)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="small"
                      appearance="secondary"
                      icon={<History24Regular />}
                      onClick={() => setRestoreConfirm({ version })}
                    >
                      Restaurar
                    </Button>
                    {onPreviewVersion ? (
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={async () => {
                          const payload = await onPreviewVersion(activeDocument, version);
                          if (activeDocument?.type === "DIAGRAMA" && payload) {
                            const svg = diagramXmlToSvg(payload);
                            if (svg) {
                              setSvgPreview({ title: `Preview v${version.versionNumber}`, svg });
                              return;
                            }
                          }
                          onOpenPreview(`Preview v${version.versionNumber}`, payload);
                        }}
                      >
                        Ver
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>
      ) : null}

      <div className="border-t border-slate-200 bg-white px-3 py-2 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Button appearance="secondary" icon={<Dismiss24Regular />} onClick={onCloseDocument}>
            Documentos
          </Button>
          <Button
            appearance="primary"
            icon={<Save24Regular />}
            onClick={onSaveVersion}
            disabled={savingVersion}
          >
            Guardar versión
          </Button>
          <Button
            appearance={versionPanelOpen ? "primary" : "secondary"}
            icon={<History24Regular />}
            onClick={onToggleVersionPanel}
          >
            Historial
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const templateSaveModal = templateSaveTarget ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Guardar como plantilla</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
            <Input
              value={templateName}
              onChange={(_, data) => setTemplateName(data.value)}
              placeholder="Nombre de la plantilla"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Descripción (opcional)</label>
            <Input
              value={templateDesc}
              onChange={(_, data) => setTemplateDesc(data.value)}
              placeholder="Descripción breve…"
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              appearance="secondary"
              onClick={() => {
                setTemplateSaveTarget(null);
                setTemplateName("");
                setTemplateDesc("");
              }}
            >
              Cancelar
            </Button>
            <Button
              appearance="primary"
              disabled={!templateName.trim()}
              onClick={() => {
                if (onCreateTemplate && templateSaveTarget && templateName.trim()) {
                  void onCreateTemplate({
                    documentId: templateSaveTarget.id,
                    name: templateName.trim(),
                    description: templateDesc.trim() || undefined
                  }).then(() => {
                    setTemplateSaveTarget(null);
                    setTemplateName("");
                    setTemplateDesc("");
                  });
                }
              }}
            >
              Guardar plantilla
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const restoreConfirmModal = restoreConfirm ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Restaurar versión</h3>
        <p className="mb-4 text-sm text-slate-600">
          ¿Estás seguro de que deseas restaurar la versión <strong>v{restoreConfirm.version.versionNumber}</strong>?
          El contenido actual del documento será reemplazado.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            appearance="secondary"
            disabled={restoringVersion}
            onClick={() => setRestoreConfirm(null)}
          >
            Cancelar
          </Button>
          <Button
            appearance="primary"
            disabled={restoringVersion}
            onClick={async () => {
              if (!activeDocument) return;
              setRestoringVersion(true);
              try {
                await onRestoreVersion(activeDocument, restoreConfirm.version);
              } finally {
                setRestoringVersion(false);
                setRestoreConfirm(null);
              }
            }}
          >
            {restoringVersion ? "Restaurando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const svgPreviewModal = svgPreview ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{svgPreview.title}</h3>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={() => setSvgPreview(null)}
          />
        </div>
        <div
          className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4"
          dangerouslySetInnerHTML={{ __html: svgPreview.svg }}
        />
      </div>
    </div>
  ) : null;

  return (
    <FluentProvider theme={webLightTheme} className="docs-v2-shell h-full w-full">
      {activeDocument ? editorView : explorerView}
      {templateSaveModal}
      {restoreConfirmModal}
      {svgPreviewModal}
    </FluentProvider>
  );
};
