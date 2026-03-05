import { FilesExplorer } from "@/components/files-explorer";
import { ProjectContextRequired } from "@/components/project-context-required";

export default function FilesPage({
  searchParams
}: {
  searchParams?: { projectId?: string; projectName?: string; teamId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";
  const projectName = searchParams?.projectName ?? "";
  const teamId = searchParams?.teamId ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Archivos"
        description="Los recursos documentales de Corelia se exploran dentro del proyecto activo."
      />
    );
  }

  return (
    <main className="-mx-4 -my-6 h-[calc(100vh-4rem)] w-[calc(100%+2rem)] md:-mx-6 md:-my-8 md:w-[calc(100%+3rem)]">
      <FilesExplorer projectId={projectId} projectName={projectName} teamId={teamId} />
    </main>
  );
}
