import { MeetingCallRoom } from "@/components/meeting-call-room";

type CallPageProps = {
  searchParams?: Promise<{ meetingId?: string | string[]; projectId?: string | string[] }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function CallPage({ searchParams }: CallPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const meetingId = getParam(resolvedSearchParams.meetingId);
  const projectId = getParam(resolvedSearchParams.projectId);

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
