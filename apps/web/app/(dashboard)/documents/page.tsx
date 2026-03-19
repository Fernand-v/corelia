import { ProjectContextRequired } from "@/components/project-context-required";
import { DocumentsBoardLazy } from "@/components/documents-board-lazy";
import { getContextFromSearchParamsRecord } from "@/lib/context";

type DocumentsPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
    projectName?: string | string[];
    teamId?: string | string[];
    ctx?: string | string[];
  }>;
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboardContext = getContextFromSearchParamsRecord(
    resolvedSearchParams as Record<string, string | string[] | undefined>
  );
  const projectId = dashboardContext.projectId ?? "";
  const projectName = dashboardContext.projectName ?? "";

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
      <DocumentsBoardLazy projectId={projectId} projectName={projectName} />
    </main>
  );
}
