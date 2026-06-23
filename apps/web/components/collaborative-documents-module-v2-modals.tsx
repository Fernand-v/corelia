import DOMPurify from "dompurify";
import React from "react";
import { Button, Input } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion
} from "@corelia/types";

type TemplateSaveModalProps = {
  templateSaveTarget: CollaborativeDocument | null;
  templateName: string;
  templateDesc: string;
  setTemplateName: (value: string) => void;
  setTemplateDesc: (value: string) => void;
  onClose: () => void;
  onCreateTemplate?: ((input: {
    documentId: string;
    name: string;
    description?: string;
  }) => Promise<void>) | undefined;
};

export const CollaborativeDocumentsModuleV2TemplateSaveModal = ({
  templateSaveTarget,
  templateName,
  templateDesc,
  setTemplateName,
  setTemplateDesc,
  onClose,
  onCreateTemplate
}: TemplateSaveModalProps) => {
  if (!templateSaveTarget) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-ink">Guardar como plantilla</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-mid">Nombre</label>
            <Input
              value={templateName}
              onChange={(_, data) => setTemplateName(data.value)}
              placeholder="Nombre de la plantilla"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-mid">Descripción (opcional)</label>
            <Input
              value={templateDesc}
              onChange={(_, data) => setTemplateDesc(data.value)}
              placeholder="Descripción breve…"
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button appearance="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              appearance="primary"
              disabled={!templateName.trim()}
              onClick={() => {
                if (!onCreateTemplate || !templateName.trim()) {
                  return;
                }
                const description = templateDesc.trim();
                void onCreateTemplate({
                  documentId: templateSaveTarget.id,
                  name: templateName.trim(),
                  ...(description ? { description } : {})
                })
                  .then(onClose)
                  .catch(() => undefined);
              }}
            >
              Guardar plantilla
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

type RestoreConfirmModalProps = {
  restoreConfirm: { version: CollaborativeDocumentVersion } | null;
  restoringVersion: boolean;
  setRestoringVersion: (value: boolean) => void;
  activeDocument: CollaborativeDocument | null;
  onRestoreVersion: (
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => Promise<void>;
  onClose: () => void;
};

export const CollaborativeDocumentsModuleV2RestoreConfirmModal = ({
  restoreConfirm,
  restoringVersion,
  setRestoringVersion,
  activeDocument,
  onRestoreVersion,
  onClose
}: RestoreConfirmModalProps) => {
  if (!restoreConfirm) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-ink">Restaurar versión</h3>
        <p className="mb-4 text-sm text-mid">
          ¿Estás seguro de que deseas restaurar la versión <strong>v{restoreConfirm.version.versionNumber}</strong>?
          El contenido actual del documento será reemplazado.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            appearance="secondary"
            disabled={restoringVersion}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            appearance="primary"
            disabled={restoringVersion}
            onClick={async () => {
              if (!activeDocument) {
                return;
              }
              setRestoringVersion(true);
              try {
                await onRestoreVersion(activeDocument, restoreConfirm.version);
              } finally {
                setRestoringVersion(false);
                onClose();
              }
            }}
          >
            {restoringVersion ? "Restaurando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

type SvgPreviewModalProps = {
  svgPreview: { title: string; svg: string } | null;
  onClose: () => void;
};

export const CollaborativeDocumentsModuleV2SvgPreviewModal = ({
  svgPreview,
  onClose
}: SvgPreviewModalProps) => {
  if (!svgPreview) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">{svgPreview.title}</h3>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={onClose}
          />
        </div>
        <div
          className="max-h-[60vh] overflow-auto rounded-lg border border-line bg-line p-4"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(svgPreview.svg, {
              USE_PROFILES: { svg: true, svgFilters: true }
            })
          }}
        />
      </div>
    </div>
  );
};
