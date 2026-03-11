import { TaskBoard } from "@/components/task-board";

type TasksPageProps = {
  searchParams?: Promise<{
    projectId?: string | string[];
    projectName?: string | string[];
    teamId?: string | string[];
    tab?: string | string[];
  }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const projectId = getParam(resolvedSearchParams.projectId);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <TaskBoard initialProjectId={projectId} lockProjectSelection={Boolean(projectId)} />
    </main>
  );
}
