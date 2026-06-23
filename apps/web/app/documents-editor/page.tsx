import { DocumentsBoardLazy } from "@/components/documents-board-lazy";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  buildMaskedDocumentsEditorRoute,
  decodeMaskedDocumentsEditorRef
} from "@/lib/documents-editor-route-ref";

type DocumentsEditorPageProps = {
  searchParams?: Promise<{
    id?: string | string[];
    projectId?: string | string[];
    projectName?: string | string[];
    ref?: string | string[];
  }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function DocumentsEditorPage({ searchParams }: DocumentsEditorPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const directDocumentId = getParam(resolvedSearchParams.id).trim();
  const directProjectId = getParam(resolvedSearchParams.projectId).trim();
  const directProjectName = getParam(resolvedSearchParams.projectName).trim();
  const maskedRef = getParam(resolvedSearchParams.ref).trim();

  if (directDocumentId && directProjectId) {
    const maskedPath = buildMaskedDocumentsEditorRoute({
      documentId: directDocumentId,
      projectId: directProjectId,
      projectName: directProjectName || null
    });
    redirect(maskedPath as Route);
  }

  const resolvedFromRef = maskedRef ? decodeMaskedDocumentsEditorRef(maskedRef) : null;
  const documentId = resolvedFromRef?.documentId ?? "";
  const projectId = resolvedFromRef?.projectId ?? "";
  const projectName = resolvedFromRef?.projectName ?? "";

  if (!documentId || !projectId) {
    return (
      <div className="flex h-screen items-center justify-center bg-line">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white px-8 py-10 shadow-md text-center max-w-sm">
          <p className="text-sm font-semibold text-ink">Enlace inválido</p>
          <p className="mt-2 text-xs text-mid">
            Vuelve a abrir el documento desde la sección Documentos para generar un enlace válido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden">
      <DocumentsBoardLazy
        projectId={projectId}
        projectName={projectName}
        initialDocumentId={documentId}
      />
    </main>
  );
}
