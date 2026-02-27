import { FilesExplorer } from "@/components/files-explorer";
import { ProjectContextRequired } from "@/components/project-context-required";

export default function FilesPage({
  searchParams
}: {
  searchParams?: { projectId?: string; teamId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Archivos"
        description="Los recursos documentales de Corelia se exploran dentro del proyecto activo."
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Archivos del proyecto</h1>
        <p className="text-sm text-slate-600">Exploración y gestión de carpetas/archivos por proyecto.</p>
      </header>
      <FilesExplorer projectId={projectId} />
    </main>
  );
}
