import React, { type ReactNode } from "react";
import {
  Button,
  Dropdown,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Spinner
} from "@fluentui/react-components";
import {
  Add24Regular,
  AppsList24Regular,
  ArrowUndo24Regular,
  Delete24Regular,
  Edit24Regular,
  Grid24Regular,
  History24Regular,
  Open24Regular,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
  Star24Filled,
  Star24Regular
} from "@fluentui/react-icons";
import type {
  CollaborativeDocument,
  DocumentType
} from "@corelia/types";

import type {
  CollaboratorPresence,
  DocumentTypeMeta,
  ExplorerRow,
  ExplorerSort,
  ExplorerTypeFilter
} from "@/components/collaborative-documents-module-v2-types";
import {
  formatDateTime,
  SORT_OPTIONS
} from "@/components/collaborative-documents-module-v2-utils";
import type {
  DocumentsExplorerDensity,
  DocumentsExplorerViewMode,
  DocumentsUiPreferences
} from "@/lib/documents-ui-preferences";

type CollaborativeDocumentsExplorerViewProps = {
  project: {
    id: string;
    name: string;
  };
  search: string;
  setSearch: (value: string) => void;
  sortBy: ExplorerSort;
  setSortBy: (value: ExplorerSort) => void;
  preferences: DocumentsUiPreferences;
  setViewMode: (viewMode: DocumentsExplorerViewMode) => void;
  setDensity: (density: DocumentsExplorerDensity) => void;
  toggleSidebar: () => void;
  typeFilter: ExplorerTypeFilter;
  setTypeFilter: (value: ExplorerTypeFilter) => void;
  showTrash: boolean;
  setShowTrash: (value: boolean) => void;
  showFavorites: boolean;
  setShowFavorites: (value: boolean) => void;
  rows: ExplorerRow[];
  documentTypeOrder: DocumentType[];
  documentTypeMeta: Record<DocumentType, DocumentTypeMeta>;
  typeCounts: Record<DocumentType, number>;
  favoriteRows: ExplorerRow[];
  filteredRows: ExplorerRow[];
  recentDocs: ExplorerRow[];
  loading: boolean;
  errorMessage: string | null;
  onRetry?: (() => void) | undefined;
  onCreateDocument: (type?: DocumentType) => void;
  onOpenDocument: (document: CollaborativeDocument) => void;
  onRequestDocumentHistory: (document: CollaborativeDocument) => void;
  onRequestRename: (document: CollaborativeDocument) => void;
  onRequestDelete: (document: CollaborativeDocument) => void;
  onDuplicateDocument?: ((document: CollaborativeDocument) => Promise<void>) | undefined;
  onToggleFavorite?: ((document: CollaborativeDocument) => Promise<void>) | undefined;
  onRestoreFromTrash?: ((documentId: string) => Promise<void>) | undefined;
  onFetchTrash?: (() => void) | undefined;
  trashItems: CollaborativeDocument[];
  trashLoading: boolean;
  onBatchDelete?: ((documentIds: string[]) => Promise<void>) | undefined;
  onBatchRestore?: ((documentIds: string[]) => Promise<void>) | undefined;
  selectedIds: Set<string>;
  toggleDocSelection: (docId: string) => void;
  clearSelectedIds: () => void;
  selectedDocumentId: string | null;
  setSelectedDocumentId: (value: string | null) => void;
  explorerDensityRowClass: string;
  renderCollaboratorAvatar: (user: CollaboratorPresence) => ReactNode;
};

export const CollaborativeDocumentsModuleV2ExplorerView = ({
  project,
  search,
  setSearch,
  sortBy,
  setSortBy,
  preferences,
  setViewMode,
  setDensity,
  toggleSidebar,
  typeFilter,
  setTypeFilter,
  showTrash,
  setShowTrash,
  showFavorites,
  setShowFavorites,
  rows,
  documentTypeOrder,
  documentTypeMeta,
  typeCounts,
  favoriteRows,
  filteredRows,
  recentDocs,
  loading,
  errorMessage,
  onRetry,
  onCreateDocument,
  onOpenDocument,
  onRequestDocumentHistory,
  onRequestRename,
  onRequestDelete,
  onDuplicateDocument,
  onToggleFavorite,
  onRestoreFromTrash,
  onFetchTrash,
  trashItems,
  trashLoading,
  onBatchDelete,
  onBatchRestore,
  selectedIds,
  toggleDocSelection,
  clearSelectedIds,
  selectedDocumentId,
  setSelectedDocumentId,
  explorerDensityRowClass,
  renderCollaboratorAvatar
}: CollaborativeDocumentsExplorerViewProps) => (
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
            onClick={() => {
              setTypeFilter("ALL");
              setShowTrash(false);
              setShowFavorites(false);
            }}
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
                onClick={() => {
                  setTypeFilter(type);
                  setShowTrash(false);
                  setShowFavorites(false);
                }}
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
              onClick={() => {
                setTypeFilter("FAVORITES");
                setShowTrash(false);
                setShowFavorites(true);
              }}
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
                            ? Math.max(
                                0,
                                Math.ceil((new Date(doc.purgeAt).getTime() - Date.now()) / 86400000)
                              )
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
              <>
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
                                    <Menu inline positioning="below-end">
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
                            <Menu inline positioning="below-end">
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

            {selectedIds.size > 0 ? (
              <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
                <span className="text-sm font-medium text-slate-700">{selectedIds.size} seleccionados</span>
                {showTrash && onBatchRestore ? (
                  <Button
                    size="small"
                    appearance="primary"
                    icon={<ArrowUndo24Regular />}
                    onClick={() => {
                      void onBatchRestore([...selectedIds]).then(clearSelectedIds);
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
                      void onBatchDelete([...selectedIds]).then(clearSelectedIds);
                    }}
                  >
                    Eliminar seleccionados
                  </Button>
                ) : null}
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={clearSelectedIds}
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
