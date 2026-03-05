import { DocumentsBoard } from "@/components/documents-board";

export default function DocumentsEditorPage({
  searchParams
}: {
  searchParams?: { id?: string; projectId?: string; projectName?: string };
}) {
  const documentId = searchParams?.id ?? "";
  const projectId = searchParams?.projectId ?? "";
  const projectName = searchParams?.projectName ?? "";

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
