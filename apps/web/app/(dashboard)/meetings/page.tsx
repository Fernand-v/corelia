import { MeetingBoard } from "@/components/meeting-board";
import { ProjectContextRequired } from "@/components/project-context-required";

export default function MeetingsPage({
  searchParams
}: {
  searchParams?: { projectId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Reuniones y Videoconferencia"
        description="La videollamada y la agenda de reuniones operan en el contexto del proyecto seleccionado."
      />
    );
  }

  return (
    <main className="teams-meetings mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[--teams-call-text]">Reuniones</h1>
          <p className="text-sm text-[--teams-call-muted]">
            Agenda y acceso a videollamada en pestaña dedicada
          </p>
        </div>
      </header>
      <MeetingBoard />
    </main>
  );
}
