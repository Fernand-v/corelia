import { TaskBoard } from "@/components/task-board";
import Link from "next/link";
import type { Route } from "next";
import { NotificationsBadge } from "@/components/notifications-badge";
import { ProjectContextRequired } from "@/components/project-context-required";
import { withDashboardContext } from "@/lib/context";

export default function TasksPage({
  searchParams
}: {
  searchParams?: { projectId?: string; teamId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";
  const teamId = searchParams?.teamId ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Tareas"
        description="El tablero operativo de tareas se trabaja dentro de un proyecto seleccionado."
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Tareas</h1>
          <p className="text-sm text-slate-600">Gestión operativa de tareas y dependencias</p>
          <div className="flex gap-2 text-xs">
            <Link
              className="rounded-lg border border-slate-300 px-2 py-1"
              href={withDashboardContext("/meetings", { projectId, teamId }) as Route}
            >
              Reuniones
            </Link>
            <Link
              className="rounded-lg border border-slate-300 px-2 py-1"
              href={withDashboardContext("/calendar", { projectId, teamId }) as Route}
            >
              Calendario
            </Link>
          </div>
        </div>
        <NotificationsBadge />
      </header>
      <TaskBoard initialProjectId={projectId} lockProjectSelection showPersonalPanels={false} />
    </main>
  );
}
