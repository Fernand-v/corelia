import { CalendarBoard } from "@/components/calendar-board";
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
    <main className="h-[calc(100vh-4.5rem)] w-full px-2 py-2 md:px-3">
      <CalendarBoard />
    </main>
  );
}
