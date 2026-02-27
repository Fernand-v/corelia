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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center">
          <p className="text-sm">Falta el parámetro de reunión (`meetingId`).</p>
        </div>
      </main>
    );
  }

  if (projectId) {
    return <MeetingCallRoom meetingId={meetingId} projectId={projectId} />;
  }

  return <MeetingCallRoom meetingId={meetingId} />;
}
