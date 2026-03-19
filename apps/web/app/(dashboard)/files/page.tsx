import { FilesExplorer } from "@/components/files-explorer";
import { ProjectContextRequired } from "@/components/project-context-required";
import { getContextFromSearchParamsRecord } from "@/lib/context";

type FilesPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
    projectName?: string | string[];
    teamId?: string | string[];
    ctx?: string | string[];
  }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboardContext = getContextFromSearchParamsRecord(
    resolvedSearchParams as Record<string, string | string[] | undefined>
  );
  const projectId = dashboardContext.projectId ?? "";
  const projectName = dashboardContext.projectName ?? "";
  const teamId = dashboardContext.teamId ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Archivos"
        description="Los recursos documentales se exploran dentro del proyecto activo."
      />
    );
  }

  return (
    <main className="-mx-4 -my-6 h-[calc(100vh-4rem)] w-[calc(100%+2rem)] md:-mx-6 md:-my-8 md:w-[calc(100%+3rem)]">
      <FilesExplorer projectId={projectId} projectName={projectName} teamId={teamId} />
    </main>
  );
}
