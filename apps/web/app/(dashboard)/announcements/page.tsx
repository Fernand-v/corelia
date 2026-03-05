"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { AnnouncementContentBlock } from "@corelia/types";
import type { Route } from "next";
import { Card } from "@corelia/ui";
import { AnnouncementContent } from "@/components/announcement-content";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  content?: {
    blocks: AnnouncementContentBlock[];
  };
  audience: {
    allCompany: boolean;
    teamIds: string[];
    userIds: string[];
  };
  expiresAt: string;
  createdAt: string;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

export default function AnnouncementsPage() {
  const session = useSession();
  const query = useQuery({
    queryKey: ["active-announcements"],
    queryFn: () => apiRequest<AnnouncementItem[]>("/announcements/active")
  });

  const canCreate =
    session.data?.activeRole === "ADMINISTRADOR" ||
    session.data?.activeRole === "LIDER_PROYECTO" ||
    session.data?.activeRole === "COORDINADOR_EQUIPO";

  return (
    <main className="w-full">
      <Card className="space-y-3">
        {canCreate ? (
          <div className="flex justify-end">
            <Link
              href={"/announcements/new" as Route}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Nuevo anuncio
            </Link>
          </div>
        ) : null}
        {query.isLoading ? <p className="text-sm text-slate-600">Cargando anuncios...</p> : null}
        {query.error ? <p className="text-sm text-red-600">{query.error.message}</p> : null}
        {!query.isLoading && !query.error && (query.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-600">No hay anuncios activos.</p>
        ) : null}

        <ul className="space-y-3">
          {query.data?.map((item) => (
            <li key={item.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">{item.title}</p>
                {item.audience.allCompany ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    Global
                  </span>
                ) : null}
                {!item.audience.allCompany && item.audience.teamIds.length > 0 ? (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                    Equipos: {item.audience.teamIds.length}
                  </span>
                ) : null}
                {!item.audience.allCompany && item.audience.userIds.length > 0 ? (
                  <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">
                    Usuarios: {item.audience.userIds.length}
                  </span>
                ) : null}
              </div>

              <AnnouncementContent blocks={item.content?.blocks} fallbackBody={item.body} />

              <p className="text-xs text-slate-500">
                Publicado: {formatDateTime(item.createdAt)} · Expira: {formatDateTime(item.expiresAt)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
