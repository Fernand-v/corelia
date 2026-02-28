"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnnouncementContentBlock } from "@corelia/types";
import type { Route } from "next";
import { Button } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { AnnouncementContent } from "@/components/announcement-content";

type EntryAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  content?: {
    blocks: AnnouncementContentBlock[];
  };
};

const SEEN_ENTRY_ANNOUNCEMENTS_SESSION_KEY = "corelia_seen_entry_announcements_session_v1";

export const EntryAnnouncementModal = ({ enabled }: { enabled: boolean }) => {
  const [entryAnnouncementId, setEntryAnnouncementId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["active-announcements"],
    queryFn: () => apiRequest<EntryAnnouncement[]>("/announcements/active"),
    enabled,
    retry: false
  });

  const announcements = query.data ?? [];
  const entryAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === entryAnnouncementId) ?? null,
    [announcements, entryAnnouncementId]
  );

  useEffect(() => {
    if (!enabled || announcements.length === 0 || typeof window === "undefined") {
      setEntryAnnouncementId(null);
      return;
    }

    const raw = window.sessionStorage.getItem(SEEN_ENTRY_ANNOUNCEMENTS_SESSION_KEY);
    const seenIds = new Set(
      raw
        ? raw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : []
    );

    const candidate = announcements.find((announcement) => !seenIds.has(announcement.id)) ?? null;
    setEntryAnnouncementId(candidate?.id ?? null);
  }, [announcements, enabled]);

  const dismissEntryAnnouncement = (markAsSeen: boolean) => {
    if (!entryAnnouncement || typeof window === "undefined") {
      setEntryAnnouncementId(null);
      return;
    }

    if (markAsSeen) {
      const raw = window.sessionStorage.getItem(SEEN_ENTRY_ANNOUNCEMENTS_SESSION_KEY);
      const seenIds = new Set(
        raw
          ? raw
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : []
      );
      seenIds.add(entryAnnouncement.id);
      window.sessionStorage.setItem(SEEN_ENTRY_ANNOUNCEMENTS_SESSION_KEY, [...seenIds].join(","));
    }

    setEntryAnnouncementId(null);
  };

  if (!enabled || !entryAnnouncement || query.error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <article className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Anuncio al ingresar</p>
            <h2 className="text-xl font-semibold text-slate-900">{entryAnnouncement.title}</h2>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => dismissEntryAnnouncement(false)}
          >
            Cerrar
          </button>
        </div>
        <AnnouncementContent
          blocks={entryAnnouncement.content?.blocks}
          fallbackBody={entryAnnouncement.body}
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <Link
            href={"/announcements" as Route}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Ver todos los anuncios
          </Link>
          <Button
            type="button"
            className="h-9 px-3 text-xs"
            onClick={() => dismissEntryAnnouncement(true)}
          >
            Entendido
          </Button>
        </div>
      </article>
    </div>
  );
};
