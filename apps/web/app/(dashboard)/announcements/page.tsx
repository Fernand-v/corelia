"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnnouncementContentBlock, AnnouncementScheduleType } from "@corelia/types";
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
  scheduleType?: AnnouncementScheduleType;
  startsAt?: string | null;
  expiresAt: string;
  recurringMonth?: number | null;
  recurringDay?: number | null;
  createdAt: string;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const MONTH_NAMES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const formatRecurringDate = (month?: number | null, day?: number | null) => {
  if (month == null || day == null) return "";
  return `${day} de ${MONTH_NAMES_SHORT[month - 1]}`;
};

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
              className="rounded-xl border border-line bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink"
            >
              Nuevo anuncio
            </Link>
          </div>
        ) : null}
        {deleteError ? <p className="text-sm text-urgent">{deleteError}</p> : null}
        {query.isLoading ? <p className="text-sm text-mid">Cargando anuncios...</p> : null}
        {query.error ? <p className="text-sm text-urgent">{query.error.message}</p> : null}
        {!query.isLoading && !query.error && (query.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-mid">No hay anuncios activos.</p>
        ) : null}

        <ul className="space-y-3">
          {query.data?.map((item) => (
            <li key={item.id} className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-ink">{item.title}</p>
                {item.audience.allCompany ? (
                  <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink">
                    Global
                  </span>
                ) : null}
                {!item.audience.allCompany && item.audience.teamIds.length > 0 ? (
                  <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink">
                    Equipos: {item.audience.teamIds.length}
                  </span>
                ) : null}
                {!item.audience.allCompany && item.audience.userIds.length > 0 ? (
                  <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink">
                    Usuarios: {item.audience.userIds.length}
                  </span>
                ) : null}
                {item.scheduleType === "PROGRAMADO" ? (
                  <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink">
                    Programado
                  </span>
                ) : null}
                {item.scheduleType === "CUMPLEANOS" ? (
                  <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink">
                    Cumpleaños · {formatRecurringDate(item.recurringMonth, item.recurringDay)}
                  </span>
                ) : null}
                {canCreate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(item);
                    }}
                    className="rounded-lg border border-urgent/30 bg-urgent-muted px-2 py-0.5 text-[11px] font-semibold text-urgent hover:bg-urgent-muted"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>

              <AnnouncementContent blocks={item.content?.blocks} fallbackBody={item.body} />

              <p className="text-xs text-mid">
                {item.scheduleType === "CUMPLEANOS" ? (
                  <>Cada año el {formatRecurringDate(item.recurringMonth, item.recurringDay)}</>
                ) : (
                  <>
                    {item.scheduleType === "PROGRAMADO" && item.startsAt
                      ? `Inicio: ${formatDateTime(item.startsAt)} · `
                      : `Publicado: ${formatDateTime(item.createdAt)} · `}
                    Expira: {formatDateTime(item.expiresAt)}
                  </>
                )}
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
        <p className="text-sm text-ink">
          ¿Seguro que deseas eliminar{" "}
          <span className="font-semibold text-ink">{deleteTarget?.title ?? "-"}</span>?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteAnnouncementMutation.isPending}
            className="rounded-[10px] border border-line px-3 py-2 text-sm text-ink hover:bg-line disabled:cursor-not-allowed disabled:opacity-60"
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
            className="rounded-[10px] bg-urgent px-3 py-2 text-sm font-semibold text-white hover:bg-urgent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleteAnnouncementMutation.isPending ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </UiModal>
    </main>
  );
}
