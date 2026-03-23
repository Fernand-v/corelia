import { MeetingCallRoom } from "@/components/meeting-call-room";
import { decodeMaskedCallRef } from "@/lib/call-route-ref";

type CallPageProps = {
  searchParams?: Promise<{ meetingId?: string | string[]; projectId?: string | string[]; ref?: string | string[]; callType?: string | string[] }>;
};

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function CallPage({ searchParams }: CallPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const directMeetingId = getParam(resolvedSearchParams.meetingId).trim();
  const directProjectId = getParam(resolvedSearchParams.projectId).trim();
  const maskedRef = getParam(resolvedSearchParams.ref).trim();
  const callType = getParam(resolvedSearchParams.callType).trim() as "VIDEO" | "VOZ" | "";

  const callRoute = directMeetingId
    ? {
        meetingId: directMeetingId,
        projectId: directProjectId || null
      }
    : maskedRef
      ? decodeMaskedCallRef(maskedRef)
      : null;

  if (!callRoute?.meetingId) {
    return (
      <main className="teams-call flex min-h-screen items-center justify-center px-4">
        <div className="teams-call-panel max-w-md rounded-2xl p-5 text-center">
          <p className="text-sm text-[--teams-call-text]">
            Enlace de videollamada inválido. Regresa al chat y vuelve a abrir la invitación.
          </p>
        </div>
      </main>
    );
  }

  return (
    <MeetingCallRoom
      meetingId={callRoute.meetingId}
      {...(callRoute.projectId ? { projectId: callRoute.projectId } : {})}
      {...(callType === "VOZ" ? { callType: "VOZ" } : {})}
    />
  );
}
