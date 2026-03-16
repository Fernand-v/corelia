"use client";

import React from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { CollaborativeDocumentsModuleV2EditorView } from "@/components/collaborative-documents-module-v2-editor-view";
import { CollaborativeDocumentsModuleV2ExplorerView } from "@/components/collaborative-documents-module-v2-explorer-view";
import {
  CollaborativeDocumentsModuleV2RestoreConfirmModal,
  CollaborativeDocumentsModuleV2SvgPreviewModal,
  CollaborativeDocumentsModuleV2TemplateSaveModal
} from "@/components/collaborative-documents-module-v2-modals";
import { useCollaborativeDocumentsModuleV2State } from "@/components/collaborative-documents-module-v2-state";
import type {
  CollaborativeDocumentsV2Props
} from "@/components/collaborative-documents-module-v2-types";

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
  onCreateTemplate
}: CollaborativeDocumentsV2Props) => {
  const {
    preferences,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    selectedDocumentId,
    setSelectedDocumentId,
    titleDraft,
    setTitleDraft,
    savingTitle,
    showTrash,
    setShowTrash,
    showFavorites,
    setShowFavorites,
    selectedIds,
    toggleDocSelection,
    clearSelectedIds,
    templateSaveTarget,
    templateName,
    templateDesc,
    setTemplateName,
    setTemplateDesc,
    openTemplateSaveModal,
    closeTemplateSaveModal,
    restoreConfirm,
    setRestoreConfirm,
    restoringVersion,
    setRestoringVersion,
    svgPreview,
    setSvgPreview,
    typeCounts,
    rows,
    favoriteRows,
    filteredRows,
    recentDocs,
    toggleSidebar,
    setViewMode,
    setDensity,
    commitDocumentTitle,
    renderCollaboratorAvatar,
    explorerDensityRowClass
  } = useCollaborativeDocumentsModuleV2State({
    documents,
    documentTypeMeta,
    documentTypeOrder,
    search,
    collaboratorsByDocumentId,
    activeDocument,
    onRenameDocument
  });

  const explorerView = (
    <CollaborativeDocumentsModuleV2ExplorerView
      project={project}
      search={search}
      setSearch={setSearch}
      sortBy={sortBy}
      setSortBy={setSortBy}
      preferences={preferences}
      setViewMode={setViewMode}
      setDensity={setDensity}
      toggleSidebar={toggleSidebar}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      showTrash={showTrash}
      setShowTrash={setShowTrash}
      showFavorites={showFavorites}
      setShowFavorites={setShowFavorites}
      rows={rows}
      documentTypeOrder={documentTypeOrder}
      documentTypeMeta={documentTypeMeta}
      typeCounts={typeCounts}
      favoriteRows={favoriteRows}
      filteredRows={filteredRows}
      recentDocs={recentDocs}
      loading={loading}
      errorMessage={errorMessage}
      onRetry={onRetry}
      onCreateDocument={onCreateDocument}
      onOpenDocument={onOpenDocument}
      onRequestDocumentHistory={onRequestDocumentHistory}
      onRequestRename={onRequestRename}
      onRequestDelete={onRequestDelete}
      onDuplicateDocument={onDuplicateDocument}
      onToggleFavorite={onToggleFavorite}
      onRestoreFromTrash={onRestoreFromTrash}
      onFetchTrash={onFetchTrash}
      trashItems={trashItems}
      trashLoading={trashLoading}
      onBatchDelete={onBatchDelete}
      onBatchRestore={onBatchRestore}
      selectedIds={selectedIds}
      toggleDocSelection={toggleDocSelection}
      clearSelectedIds={clearSelectedIds}
      selectedDocumentId={selectedDocumentId}
      setSelectedDocumentId={setSelectedDocumentId}
      explorerDensityRowClass={explorerDensityRowClass}
      renderCollaboratorAvatar={renderCollaboratorAvatar}
    />
  );

  const editorView = activeDocument ? (
    <CollaborativeDocumentsModuleV2EditorView
      activeDocument={activeDocument}
      documentTypeMeta={documentTypeMeta}
      titleDraft={titleDraft}
      setTitleDraft={setTitleDraft}
      commitDocumentTitle={commitDocumentTitle}
      savingTitle={savingTitle}
      syncLabel={syncLabel}
      saveStatusBadge={saveStatusBadge}
      savingVersion={savingVersion}
      versionPanelOpen={versionPanelOpen}
      versions={versions}
      editorNode={editorNode}
      onCloseDocument={onCloseDocument}
      onSaveVersion={onSaveVersion}
      onToggleVersionPanel={onToggleVersionPanel}
      onOpenPreview={onOpenPreview}
      onPreviewVersion={onPreviewVersion}
      onCreateTemplate={onCreateTemplate}
      onOpenTemplateSave={openTemplateSaveModal}
      activeDocumentCollaborators={activeDocumentCollaborators}
      currentUser={currentUser}
      connectionState={connectionState}
      renderCollaboratorAvatar={renderCollaboratorAvatar}
      onSetRestoreConfirm={setRestoreConfirm}
      onSetSvgPreview={setSvgPreview}
    />
  ) : null;

  return (
    <FluentProvider theme={webLightTheme} className="docs-v2-shell h-full w-full">
      {activeDocument ? editorView : explorerView}
      <CollaborativeDocumentsModuleV2TemplateSaveModal
        templateSaveTarget={templateSaveTarget}
        templateName={templateName}
        templateDesc={templateDesc}
        setTemplateName={setTemplateName}
        setTemplateDesc={setTemplateDesc}
        onClose={closeTemplateSaveModal}
        onCreateTemplate={onCreateTemplate}
      />
      <CollaborativeDocumentsModuleV2RestoreConfirmModal
        restoreConfirm={restoreConfirm}
        restoringVersion={restoringVersion}
        setRestoringVersion={setRestoringVersion}
        activeDocument={activeDocument}
        onRestoreVersion={onRestoreVersion}
        onClose={() => setRestoreConfirm(null)}
      />
      <CollaborativeDocumentsModuleV2SvgPreviewModal
        svgPreview={svgPreview}
        onClose={() => setSvgPreview(null)}
      />
    </FluentProvider>
  );
};
