import { DocumentsBoard } from "@/components/documents-board";
import { ProjectContextRequired } from "@/components/project-context-required";

type DocumentsPageProps = {
  searchParams?: Promise<{ projectId?: string | string[]; projectName?: string | string[]; teamId?: string | string[] }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const projectId = getParam(resolvedSearchParams.projectId);
  const projectName = getParam(resolvedSearchParams.projectName);

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
