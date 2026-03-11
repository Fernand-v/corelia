import { CalendarBoard } from "@/components/calendar-board";
import { ProjectContextRequired } from "@/components/project-context-required";

type CalendarPageProps = {
  searchParams?: Promise<{ projectId?: string | string[] }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawProjectId = resolvedSearchParams.projectId;
  const projectId = Array.isArray(rawProjectId) ? (rawProjectId[0] ?? "") : (rawProjectId ?? "");

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
