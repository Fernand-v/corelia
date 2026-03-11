import { DocumentsBoard } from "@/components/documents-board";

type DocumentsEditorPageProps = {
  searchParams?: Promise<{ id?: string | string[]; projectId?: string | string[]; projectName?: string | string[] }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function DocumentsEditorPage({ searchParams }: DocumentsEditorPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const documentId = getParam(resolvedSearchParams.id);
  const projectId = getParam(resolvedSearchParams.projectId);
  const projectName = getParam(resolvedSearchParams.projectName);

  if (!documentId || !projectId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white px-8 py-10 shadow-md text-center max-w-sm">
          <p className="text-sm font-semibold text-slate-700">Parámetros insuficientes</p>
          <p className="mt-2 text-xs text-slate-500">Se requieren los parámetros <code className="rounded bg-slate-100 px-1">id</code> y <code className="rounded bg-slate-100 px-1">projectId</code> para abrir el editor.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden">
      <DocumentsBoard
        projectId={projectId}
        projectName={projectName}
        initialDocumentId={documentId}
      />
    </main>
  );
}
