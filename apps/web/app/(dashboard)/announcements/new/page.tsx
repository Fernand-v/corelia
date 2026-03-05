"use client";

import { Card } from "@corelia/ui";
import { AdminAnnouncementComposer } from "@/components/admin-announcement-composer";
import { useSession } from "@/lib/session";

const canPublishAnnouncement = (role: string | null | undefined) =>
  role === "ADMINISTRADOR" || role === "LIDER_PROYECTO" || role === "COORDINADOR_EQUIPO";

export default function NewAnnouncementPage() {
  const session = useSession();

  if (session.isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
        <Card>
          <p className="text-sm text-slate-600">Cargando permisos...</p>
        </Card>
      </main>
    );
  }

  if (!canPublishAnnouncement(session.data?.activeRole)) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
        <Card>
          <p className="text-sm text-red-600">No tienes permisos para crear anuncios.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
      <AdminAnnouncementComposer />
    </main>
  );
}
