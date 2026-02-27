import { CalendarBoard } from "@/components/calendar-board";
import { NotificationsBadge } from "@/components/notifications-badge";
import { ProjectContextRequired } from "@/components/project-context-required";

export default function CalendarPage({
  searchParams
}: {
  searchParams?: { projectId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Calendario"
        description="El calendario operativo se visualiza por proyecto para revisar agenda y bloques horarios del equipo."
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Calendario</h1>
          <p className="text-sm text-slate-600">Vista colaborativa de tareas, reuniones y disponibilidad</p>
        </div>
        <NotificationsBadge />
      </header>
      <CalendarBoard />
    </main>
  );
}
