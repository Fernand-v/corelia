import { DashboardShell } from "@/components/dashboard-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { IncomingCallOverlay } from "@/components/incoming-call-overlay";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <DashboardShell>
        <ErrorBoundary>{children}</ErrorBoundary>
        <IncomingCallOverlay />
      </DashboardShell>
    </ErrorBoundary>
  );
}
