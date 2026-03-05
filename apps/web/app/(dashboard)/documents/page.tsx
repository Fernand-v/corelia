import { DocumentsBoard } from "@/components/documents-board";
import { ProjectContextRequired } from "@/components/project-context-required";

export default function DocumentsPage({
  searchParams
}: {
  searchParams?: { projectId?: string; projectName?: string; teamId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";
  const projectName = searchParams?.projectName ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Documentos"
        description="El espacio colaborativo de documentos requiere un proyecto activo para cargar carpetas y permisos."
      />
    );
  }

  return (
    <main className="-mx-4 -my-6 h-[calc(100vh-4rem)] w-[calc(100%+2rem)] md:-mx-6 md:-my-8 md:w-[calc(100%+3rem)]">
      <DocumentsBoard projectId={projectId} projectName={projectName} />
    </main>
  );
}
