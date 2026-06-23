import React, { type ReactNode } from "react";
import {
  Badge,
  Button,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger
} from "@fluentui/react-components";
import {
  ArrowDownload24Regular,
  Copy24Regular,
  Dismiss24Regular,
  History24Regular,
  Save24Regular
} from "@fluentui/react-icons";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DocumentType
} from "@corelia/types";

import { diagramXmlToSvg } from "@/components/collaborative-documents-module-v2-diagram-preview";
import type {
  CollaboratorPresence,
  DocumentTypeMeta
} from "@/components/collaborative-documents-module-v2-types";
import {
  formatDateTime,
  initialsFromName,
  toneToFluentAppearance,
  toneToFluentColor
} from "@/components/collaborative-documents-module-v2-utils";

type CollaborativeDocumentsEditorViewProps = {
  activeDocument: CollaborativeDocument;
  documentTypeMeta: Record<DocumentType, DocumentTypeMeta>;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  commitDocumentTitle: () => Promise<void>;
  savingTitle: boolean;
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
  supportsManualVersionSave?: boolean;
  savingVersion: boolean;
  versionPanelOpen: boolean;
  versions: CollaborativeDocumentVersion[];
  editorNode: ReactNode;
  onCloseDocument: () => void;
  onSaveVersion: () => void;
  onToggleVersionPanel: () => void;
  onOpenPreview: (title: string, payload: string | null) => void;
  onPreviewVersion?: ((
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => Promise<string | null>) | undefined;
  onCreateTemplate?: ((input: {
    documentId: string;
    name: string;
    description?: string;
  }) => Promise<void>) | undefined;
  onOpenTemplateSave: (document: CollaborativeDocument) => void;
  activeDocumentCollaborators: CollaboratorPresence[];
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  connectionState: "connected" | "reconnecting" | "offline";
  renderCollaboratorAvatar: (user: CollaboratorPresence) => ReactNode;
  onSetRestoreConfirm: (value: { version: CollaborativeDocumentVersion } | null) => void;
  onSetSvgPreview: (value: { title: string; svg: string } | null) => void;
};

const downloadFromBlob = (blob: Blob, filename: string) => {
  const link = window.document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const renderVersionHistoryEntry = (
  activeDocument: CollaborativeDocument,
  version: CollaborativeDocumentVersion,
  onSetRestoreConfirm: (value: { version: CollaborativeDocumentVersion } | null) => void,
  onPreviewVersion: CollaborativeDocumentsEditorViewProps["onPreviewVersion"],
  onOpenPreview: (title: string, payload: string | null) => void,
  onSetSvgPreview: (value: { title: string; svg: string } | null) => void,
  key?: string
) => (
  <article
    key={key ?? version.id}
    className="rounded-lg border border-line bg-white p-3 text-xs text-mid"
  >
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="font-semibold text-ink">v{version.versionNumber}</span>
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
        onClick={() => onSetRestoreConfirm({ version })}
      >
        Restaurar
      </Button>
      {onPreviewVersion ? (
        <Button
          size="small"
          appearance="subtle"
          onClick={async () => {
            const payload = await onPreviewVersion(activeDocument, version);
            if (activeDocument.type === "DIAGRAMA" && payload) {
              const svg = diagramXmlToSvg(payload);
              if (svg) {
                onSetSvgPreview({ title: `Preview v${version.versionNumber}`, svg });
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
);

export const CollaborativeDocumentsModuleV2EditorView = ({
  activeDocument,
  documentTypeMeta,
  titleDraft,
  setTitleDraft,
  commitDocumentTitle,
  savingTitle,
  syncLabel,
  saveStatusBadge,
  supportsManualVersionSave = true,
  savingVersion,
  versionPanelOpen,
  versions,
  editorNode,
  onCloseDocument,
  onSaveVersion,
  onToggleVersionPanel,
  onOpenPreview,
  onPreviewVersion,
  onCreateTemplate,
  onOpenTemplateSave,
  activeDocumentCollaborators,
  currentUser,
  connectionState,
  renderCollaboratorAvatar,
  onSetRestoreConfirm,
  onSetSvgPreview
}: CollaborativeDocumentsEditorViewProps) => (
  <div data-testid="documents-v2-editor" className="flex h-full min-h-0 flex-col bg-line">
    <header className="border-b border-line bg-white px-3 py-3 md:px-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-mid">
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
            {supportsManualVersionSave ? (
              <Button
                icon={<Save24Regular />}
                appearance="primary"
                onClick={onSaveVersion}
                disabled={savingVersion}
              >
                {savingVersion ? "Guardando…" : "Guardar versión"}
              </Button>
            ) : null}
            {onCreateTemplate ? (
              <Button
                icon={<Copy24Regular />}
                appearance="secondary"
                onClick={() => onOpenTemplateSave(activeDocument)}
              >
                Plantilla
              </Button>
            ) : null}
            {["DIAGRAMA", "WHITEBOARD"].includes(activeDocument.type) ? (
              <Menu positioning="below-end">
                <MenuTrigger disableButtonEnhancement>
                  <Button
                    icon={<ArrowDownload24Regular />}
                    appearance="secondary"
                  >
                    Exportar
                  </Button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {activeDocument.type === "DIAGRAMA" ? (
                      <MenuItem onClick={() => {
                        const svg = window.document.querySelector(".react-flow svg, .react-flow__viewport");
                        if (svg) {
                          const serializer = new XMLSerializer();
                          const svgStr = serializer.serializeToString(svg);
                          const blob = new Blob([svgStr], { type: "image/svg+xml" });
                          downloadFromBlob(blob, `${activeDocument.name}.svg`);
                        }
                      }}>
                        Exportar SVG
                      </MenuItem>
                    ) : null}
                    {activeDocument.type === "WHITEBOARD" ? (
                      <MenuItem onClick={() => {
                        const svgEl = window.document.querySelector(".excalidraw svg.excalidraw__canvas");
                        if (svgEl) {
                          const serializer = new XMLSerializer();
                          const svgStr = serializer.serializeToString(svgEl);
                          const blob = new Blob([svgStr], { type: "image/svg+xml" });
                          downloadFromBlob(blob, `${activeDocument.name}.svg`);
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

        <div className="flex items-center gap-2 text-xs text-mid">
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
      <div className="border-b border-line bg-paper px-4 py-2 text-xs font-medium text-ink">
        {activeDocument.type === "DIAGRAMA"
          ? "Reconectando… sincronización pendiente del diagrama."
          : "Reconectando… El documento volverá a modo colaborativo al restablecer conexión."}
      </div>
    ) : null}
    {connectionState === "offline" ? (
      <div className="border-b border-line bg-paper px-4 py-2 text-xs font-medium text-ink">
        {activeDocument.type === "DIAGRAMA"
          ? "Sin conexión. Cambios en cola local (sesión actual) hasta reconectar."
          : "Sin conexión. El documento está en solo lectura hasta reconectar."}
      </div>
    ) : null}

    <div className="flex min-h-0 flex-1">
      <section className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">{editorNode}</section>
      {versionPanelOpen ? (
        <aside className="hidden w-80 shrink-0 border-l border-line bg-white p-3 md:block">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-mid">
              Historial
            </h3>
            <Badge appearance="outline">{versions.length}</Badge>
          </header>
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 12rem)" }}>
            {versions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-3 text-xs text-mid">
                Sin versiones registradas.
              </p>
            ) : (
              versions.map((version) => renderVersionHistoryEntry(
                activeDocument,
                version,
                onSetRestoreConfirm,
                onPreviewVersion,
                onOpenPreview,
                onSetSvgPreview
              ))
            )}
          </div>
        </aside>
      ) : null}
    </div>

    {versionPanelOpen ? (
      <aside className="border-t border-line bg-white p-3 md:hidden">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mid">
            Historial
          </h3>
          <Badge appearance="outline">{versions.length}</Badge>
        </header>
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {versions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-3 text-xs text-mid">
              Sin versiones registradas.
            </p>
          ) : (
            versions.map((version) => renderVersionHistoryEntry(
              activeDocument,
              version,
              onSetRestoreConfirm,
              onPreviewVersion,
              onOpenPreview,
              onSetSvgPreview,
              `mobile-${version.id}`
            ))
          )}
        </div>
      </aside>
    ) : null}

    <div className="border-t border-line bg-white px-3 py-2 md:hidden">
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
);
