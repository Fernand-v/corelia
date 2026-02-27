import { Suspense } from "react";
import { ActivateInvitePage } from "@/components/activate-invite-page";

export const dynamic = "force-dynamic";

export default function ActivateInviteRoute() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <ActivateInvitePage />
    </Suspense>
  );
}
