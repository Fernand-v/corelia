import { CalendarBoard } from "@/components/calendar-board";
import { ProjectContextRequired } from "@/components/project-context-required";
import { getContextFromSearchParamsRecord } from "@/lib/context";

type CalendarPageProps = {
  searchParams?: Promise<{ projectId?: string | string[]; ctx?: string | string[] }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboardContext = getContextFromSearchParamsRecord(
    resolvedSearchParams as Record<string, string | string[] | undefined>
  );
  const projectId = dashboardContext.projectId ?? "";

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
