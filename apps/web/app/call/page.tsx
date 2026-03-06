import { MeetingCallRoom } from "@/components/meeting-call-room";

export default function CallPage({
  searchParams
}: {
  searchParams?: { meetingId?: string; projectId?: string };
}) {
  const meetingId = searchParams?.meetingId ?? "";
  const projectId = searchParams?.projectId ?? "";

  if (!meetingId) {
    return (
      <main className="teams-call flex min-h-screen items-center justify-center px-4">
        <div className="teams-call-panel max-w-md rounded-2xl p-5 text-center">
          <p className="text-sm text-[--teams-call-text]">Falta el parámetro de reunión (`meetingId`).</p>
        </div>
      </main>
    );
  }

  if (projectId) {
    return <MeetingCallRoom meetingId={meetingId} projectId={projectId} />;
  }

  return <MeetingCallRoom meetingId={meetingId} />;
}
