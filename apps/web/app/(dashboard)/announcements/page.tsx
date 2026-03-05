"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnnouncementContentBlock } from "@corelia/types";
import type { Route } from "next";
import { Card } from "@corelia/ui";
import { AnnouncementContent } from "@/components/announcement-content";
import { UiModal } from "@/components/ui-modal";
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
  const queryClient = useQueryClient();
  const session = useSession();
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["active-announcements"],
    queryFn: () => apiRequest<AnnouncementItem[]>("/announcements/active")
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: (announcementId: string) =>
      apiRequest<{ id: string; deleted: true }>(`/announcements/${encodeURIComponent(announcementId)}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      setDeleteError(null);
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["active-announcements"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      ]);
    },
    onError: (error) => {
      setDeleteError(error.message);
    }
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
              className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Nuevo anuncio
            </Link>
          </div>
        ) : null}
        {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
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
                {canCreate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(item);
                    }}
                    className="rounded-lg border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                  >
                    Eliminar
                  </button>
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

      <UiModal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleteAnnouncementMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
        title="Eliminar anuncio"
      >
        <p className="text-sm text-slate-700">
          ¿Seguro que deseas eliminar{" "}
          <span className="font-semibold text-slate-900">{deleteTarget?.title ?? "-"}</span>?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteAnnouncementMutation.isPending}
            className="rounded-[10px] border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!deleteTarget) {
                return;
              }
              deleteAnnouncementMutation.mutate(deleteTarget.id);
            }}
            disabled={deleteAnnouncementMutation.isPending}
            className="rounded-[10px] bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleteAnnouncementMutation.isPending ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </UiModal>
    </main>
  );
}
