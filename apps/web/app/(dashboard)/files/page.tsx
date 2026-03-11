import { FilesExplorer } from "@/components/files-explorer";
import { ProjectContextRequired } from "@/components/project-context-required";

type FilesPageProps = {
  searchParams?: Promise<{ projectId?: string | string[]; projectName?: string | string[]; teamId?: string | string[] }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const projectId = getParam(resolvedSearchParams.projectId);
  const projectName = getParam(resolvedSearchParams.projectName);
  const teamId = getParam(resolvedSearchParams.teamId);

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
