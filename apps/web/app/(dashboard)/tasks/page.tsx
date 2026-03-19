import { TaskBoard } from "@/components/task-board";
import { getContextFromSearchParamsRecord } from "@/lib/context";

type TasksPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
    projectName?: string | string[];
    teamId?: string | string[];
    ctx?: string | string[];
    tab?: string | string[];
  }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboardContext = getContextFromSearchParamsRecord(
    resolvedSearchParams as Record<string, string | string[] | undefined>
  );
  const projectId = dashboardContext.projectId ?? "";

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <TaskBoard initialProjectId={projectId} lockProjectSelection={Boolean(projectId)} />
    </main>
  );
}
