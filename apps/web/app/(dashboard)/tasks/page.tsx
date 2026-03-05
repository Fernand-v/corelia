import { TaskBoard } from "@/components/task-board";

export default function TasksPage({
  searchParams
}: {
  searchParams?: { projectId?: string; projectName?: string; teamId?: string; tab?: string };
}) {
  const projectId = searchParams?.projectId ?? "";

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <TaskBoard initialProjectId={projectId} lockProjectSelection={Boolean(projectId)} />
    </main>
  );
}
