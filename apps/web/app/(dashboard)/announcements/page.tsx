"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnnouncementContentBlock } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { NotificationsBadge } from "@/components/notifications-badge";
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

type TeamListResponse = {
  items: Array<{
    id: string;
    name: string;
  }>;
  total: number;
};

type DirectoryUser = {
  userId: string;
  fullName: string;
  contact: {
    email: string;
  };
};

type EditorBlock = AnnouncementContentBlock & {
  clientId: string;
};

const toLocalDateTimeInput = (date: Date) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
};

const futureDefault = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return toLocalDateTimeInput(date);
};

const createBlock = (type: AnnouncementContentBlock["type"]): EditorBlock => {
  const clientId = crypto.randomUUID();
  if (type === "TITLE" || type === "SUBTITLE" || type === "TEXT") {
    return { clientId, type, text: "" };
  }
  if (type === "IMAGE") {
    return { clientId, type, url: "", alt: "" };
  }
  if (type === "FILE") {
    return { clientId, type, label: "", url: "" };
  }
  return { clientId, type };
};

const normalizeBlocksForSubmit = (
  blocks: EditorBlock[],
  fallbackTitle: string
): AnnouncementContentBlock[] => {
  const normalized = blocks
    .map((block): AnnouncementContentBlock | null => {
      if (block.type === "TITLE" || block.type === "SUBTITLE" || block.type === "TEXT") {
        const text = block.text.trim();
        if (!text) {
          return null;
        }
        return {
          type: block.type,
          text
        };
      }

      if (block.type === "IMAGE") {
        const url = block.url.trim();
        if (!url) {
          return null;
        }
        return {
          type: "IMAGE",
          url,
          alt: block.alt.trim()
        };
      }

      if (block.type === "FILE") {
        const label = block.label.trim();
        const url = block.url.trim();
        if (!label || !url) {
          return null;
        }
        return {
          type: "FILE",
          label,
          url
        };
      }

      return { type: "DIVIDER" };
    })
    .filter((block): block is AnnouncementContentBlock => Boolean(block));

  if (normalized.length > 0) {
    return normalized;
  }

  return [{ type: "TEXT", text: fallbackTitle || "Nuevo anuncio" }];
};

const summaryFromBlocks = (blocks: AnnouncementContentBlock[], title: string): string => {
  const textBlock = blocks.find(
    (block) =>
      (block.type === "TITLE" || block.type === "SUBTITLE" || block.type === "TEXT") &&
      block.text.trim().length > 0
  );

  if (textBlock && "text" in textBlock) {
    return textBlock.text.trim().slice(0, 4000);
  }

  return title.trim().slice(0, 4000) || "Anuncio";
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const session = useSession();
  const canPublish = session.data?.activeRole === "ADMINISTRADOR";

  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState(futureDefault);
  const [allCompany, setAllCompany] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<EditorBlock[]>([
    createBlock("TITLE"),
    createBlock("TEXT")
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["active-announcements"],
    queryFn: () => apiRequest<AnnouncementItem[]>("/announcements/active")
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams-lite-for-announcements"],
    queryFn: () => apiRequest<TeamListResponse>("/admin/teams"),
    enabled: canPublish
  });

  const usersQuery = useQuery({
    queryKey: ["directory-users-for-announcements"],
    queryFn: () => apiRequest<DirectoryUser[]>("/identity/directory"),
    enabled: canPublish
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      if (!cleanTitle) {
        throw new Error("El título es obligatorio");
      }

      const blockPayload = normalizeBlocksForSubmit(blocks, cleanTitle);
      const body = summaryFromBlocks(blockPayload, cleanTitle);
      const expiresAtIso = new Date(expiresAt).toISOString();

      if (!allCompany && selectedTeamIds.length === 0 && selectedUserIds.length === 0) {
        throw new Error("Selecciona equipos, usuarios o marca audiencia global");
      }

      return apiRequest<AnnouncementItem>("/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: cleanTitle,
          body,
          content: {
            blocks: blockPayload
          },
          audience: {
            allCompany,
            teamIds: selectedTeamIds,
            userIds: selectedUserIds
          },
          expiresAt: expiresAtIso
        })
      });
    },
    onSuccess: async () => {
      setTitle("");
      setExpiresAt(futureDefault());
      setAllCompany(true);
      setSelectedTeamIds([]);
      setSelectedUserIds([]);
      setBlocks([createBlock("TITLE"), createBlock("TEXT")]);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["active-announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
    },
    onError: (error) => {
      setFormError(error.message);
    }
  });

  const previewBlocks = useMemo(
    () => normalizeBlocksForSubmit(blocks, title.trim() || "Nuevo anuncio"),
    [blocks, title]
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Anuncios</h1>
          <p className="text-sm text-slate-600">Comunicados activos para tu área u organización</p>
        </div>
        <NotificationsBadge />
      </header>

      {canPublish ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Crear anuncio dinámico</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Título del anuncio</span>
                <input
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Cambio de horario operativo"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha de expiración</span>
                <input
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </label>

              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Audiencia</p>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allCompany}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setAllCompany(checked);
                      if (checked) {
                        setSelectedTeamIds([]);
                        setSelectedUserIds([]);
                      }
                    }}
                  />
                  Global (todos los usuarios)
                </label>

                {!allCompany ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600">Equipos</p>
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                        {teamsQuery.data?.items.map((team) => (
                          <label key={team.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedTeamIds.includes(team.id)}
                              onChange={(event) => {
                                setSelectedTeamIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, team.id])]
                                    : current.filter((id) => id !== team.id)
                                );
                              }}
                            />
                            {team.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-slate-600">Usuarios específicos</p>
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                        {usersQuery.data?.map((user) => (
                          <label key={user.userId} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.userId)}
                              onChange={(event) => {
                                setSelectedUserIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, user.userId])]
                                    : current.filter((id) => id !== user.userId)
                                );
                              }}
                            />
                            {user.fullName} · {user.contact.email}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Constructor de contenido</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setBlocks((current) => [...current, createBlock("TITLE")])}>
                    + Título
                  </Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setBlocks((current) => [...current, createBlock("SUBTITLE")])}>
                    + Subtítulo
                  </Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setBlocks((current) => [...current, createBlock("TEXT")])}>
                    + Texto
                  </Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setBlocks((current) => [...current, createBlock("IMAGE")])}>
                    + Imagen
                  </Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setBlocks((current) => [...current, createBlock("FILE")])}>
                    + Archivo
                  </Button>
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setBlocks((current) => [...current, createBlock("DIVIDER")])}>
                    + Separador
                  </Button>
                </div>

                <ul className="space-y-2">
                  {blocks.map((block, index) => (
                    <li key={block.clientId} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">
                          Bloque {index + 1}: {block.type}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-white"
                            disabled={index === 0}
                            onClick={() => {
                              setBlocks((current) => {
                                const next = [...current];
                                const previous = next[index - 1];
                                next[index - 1] = next[index]!;
                                next[index] = previous!;
                                return next;
                              });
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-white"
                            disabled={index === blocks.length - 1}
                            onClick={() => {
                              setBlocks((current) => {
                                const next = [...current];
                                const following = next[index + 1];
                                next[index + 1] = next[index]!;
                                next[index] = following!;
                                return next;
                              });
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="rounded border border-red-300 px-1.5 py-0.5 text-[11px] text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setBlocks((current) => current.filter((item) => item.clientId !== block.clientId));
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>

                      {block.type === "TITLE" || block.type === "SUBTITLE" || block.type === "TEXT" ? (
                        <textarea
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          rows={block.type === "TEXT" ? 4 : 2}
                          value={block.text}
                          onChange={(event) => {
                            const value = event.target.value;
                            setBlocks((current) =>
                              current.map((item) =>
                                item.clientId === block.clientId && (item.type === "TITLE" || item.type === "SUBTITLE" || item.type === "TEXT")
                                  ? {
                                      ...item,
                                      text: value
                                    }
                                  : item
                              )
                            );
                          }}
                          placeholder={block.type === "TEXT" ? "Contenido del anuncio..." : "Texto"}
                        />
                      ) : null}

                      {block.type === "IMAGE" ? (
                        <div className="grid gap-2">
                          <input
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                            placeholder="URL de la imagen (https://...)"
                            value={block.url}
                            onChange={(event) => {
                              const value = event.target.value;
                              setBlocks((current) =>
                                current.map((item) =>
                                  item.clientId === block.clientId && item.type === "IMAGE"
                                    ? {
                                        ...item,
                                        url: value
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                          <input
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                            placeholder="Texto alternativo"
                            value={block.alt}
                            onChange={(event) => {
                              const value = event.target.value;
                              setBlocks((current) =>
                                current.map((item) =>
                                  item.clientId === block.clientId && item.type === "IMAGE"
                                    ? {
                                        ...item,
                                        alt: value
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </div>
                      ) : null}

                      {block.type === "FILE" ? (
                        <div className="grid gap-2">
                          <input
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                            placeholder="Etiqueta del archivo (ej. Política 2026)"
                            value={block.label}
                            onChange={(event) => {
                              const value = event.target.value;
                              setBlocks((current) =>
                                current.map((item) =>
                                  item.clientId === block.clientId && item.type === "FILE"
                                    ? {
                                        ...item,
                                        label: value
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                          <input
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                            placeholder="URL del archivo (https://...)"
                            value={block.url}
                            onChange={(event) => {
                              const value = event.target.value;
                              setBlocks((current) =>
                                current.map((item) =>
                                  item.clientId === block.clientId && item.type === "FILE"
                                    ? {
                                        ...item,
                                        url: value
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-9 px-3 text-xs"
                  disabled={createMutation.isPending}
                  onClick={() => {
                    setFormError(null);
                    createMutation.mutate();
                  }}
                >
                  {createMutation.isPending ? "Publicando..." : "Publicar anuncio"}
                </Button>
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vista previa</p>
              <article className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {title.trim() || "Título del anuncio"}
                </h3>
                <AnnouncementContent blocks={previewBlocks} />
              </article>
            </section>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-3">
        {query.isLoading ? <p className="text-sm text-slate-600">Cargando anuncios...</p> : null}
        {query.error ? <p className="text-sm text-red-600">{query.error.message}</p> : null}
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
