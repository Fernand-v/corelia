import { MessagingBoard } from "@/components/messaging-board";
import { ProjectContextRequired } from "@/components/project-context-required";

export default function MessagingPage({
  searchParams
}: {
  searchParams?: { projectId?: string; channelId?: string };
}) {
  const projectId = searchParams?.projectId ?? "";
  const channelId = searchParams?.channelId ?? "";

  if (!projectId && !channelId) {
    return (
      <ProjectContextRequired
        sectionLabel="Mensajería"
        description="El chat del proyecto se gestiona en contexto y los mensajes globales se abren desde notificaciones o conversaciones directas."
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 md:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mensajería</h1>
        <p className="text-sm text-slate-600">Chat del proyecto y mensajes globales con entrega en tiempo real</p>
      </header>
      <MessagingBoard />
    </main>
  );
}
