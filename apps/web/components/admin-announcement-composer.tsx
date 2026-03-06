"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnnouncementContentBlock } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { AnnouncementContent } from "@/components/announcement-content";
import { resolveAnnouncementImageCandidates } from "@/components/announcement-content-state";
import { apiRequest, getApiBaseUrl } from "@/lib/api";

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

type AnnouncementAssetUploadResponse = {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type EditorBlock = AnnouncementContentBlock & {
  clientId: string;
};

const toLocalDateTimeInput = (date: Date) => {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
};

const MAX_ANNOUNCEMENT_IMAGE_DIMENSION = 1920;
const ANNOUNCEMENT_IMAGE_QUALITY = 0.82;

const optimizeImageBeforeUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (typeof window === "undefined") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const instance = new Image();
      instance.onload = () => resolve(instance);
      instance.onerror = () =>
        reject(new Error("No se pudo leer la imagen seleccionada"));
      instance.src = objectUrl;
    });

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(
      1,
      MAX_ANNOUNCEMENT_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight),
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputType = "image/webp";
    const optimizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, ANNOUNCEMENT_IMAGE_QUALITY);
    });

    if (!optimizedBlob) {
      return file;
    }

    if (optimizedBlob.size >= file.size && scale === 1) {
      return file;
    }

    const optimizedName = file.name.replace(/\.[^/.]+$/, ".webp");
    return new File([optimizedBlob], optimizedName, {
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  fallbackTitle: string,
): AnnouncementContentBlock[] => {
  const normalized = blocks
    .map((block): AnnouncementContentBlock | null => {
      if (
        block.type === "TITLE" ||
        block.type === "SUBTITLE" ||
        block.type === "TEXT"
      ) {
        const text = block.text.trim();
        if (!text) {
          return null;
        }
        return {
          type: block.type,
          text,
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
          alt: block.alt.trim(),
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
          url,
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

const summaryFromBlocks = (
  blocks: AnnouncementContentBlock[],
  title: string,
): string => {
  const textBlock = blocks.find(
    (block) =>
      (block.type === "TITLE" ||
        block.type === "SUBTITLE" ||
        block.type === "TEXT") &&
      block.text.trim().length > 0,
  );

  if (textBlock && "text" in textBlock) {
    return textBlock.text.trim().slice(0, 4000);
  }

  return title.trim().slice(0, 4000) || "Anuncio";
};

export const AdminAnnouncementComposer = () => {
  const queryClient = useQueryClient();
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [audienceMode, setAudienceMode] = useState<"GLOBAL" | "SEGMENTADA">(
    "GLOBAL",
  );
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState(futureDefault);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [blocks, setBlocks] = useState<EditorBlock[]>([
    createBlock("TITLE"),
    createBlock("TEXT"),
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  const teamsQuery = useQuery({
    queryKey: ["identity-teams-for-announcements"],
    queryFn: () => apiRequest<TeamListResponse>("/identity/teams"),
  });

  const usersQuery = useQuery({
    queryKey: ["directory-users-for-announcements"],
    queryFn: () => apiRequest<DirectoryUser[]>("/identity/directory"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const inferredTitleBlock = blocks.find(
        (
          block,
        ): block is Extract<
          EditorBlock,
          { type: "TITLE" | "SUBTITLE" | "TEXT" }
        > =>
          (block.type === "TITLE" ||
            block.type === "SUBTITLE" ||
            block.type === "TEXT") &&
          block.text.trim().length > 0,
      );
      const inferredTitle = inferredTitleBlock?.text.trim().slice(0, 160) ?? "";

      const cleanTitle = title.trim() || inferredTitle;
      if (!cleanTitle) {
        throw new Error("Agrega un título para el anuncio");
      }

      const blockPayload = normalizeBlocksForSubmit(blocks, cleanTitle);
      const body = summaryFromBlocks(blockPayload, cleanTitle);
      const expiresAtIso = new Date(expiresAt).toISOString();

      if (
        audienceMode === "SEGMENTADA" &&
        selectedTeamIds.length === 0 &&
        selectedUserIds.length === 0
      ) {
        throw new Error(
          "Selecciona equipos, usuarios o marca audiencia global",
        );
      }

      return apiRequest("/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: cleanTitle,
          body,
          content: {
            blocks: blockPayload,
          },
          audience: {
            allCompany: audienceMode === "GLOBAL",
            teamIds: audienceMode === "SEGMENTADA" ? selectedTeamIds : [],
            userIds: audienceMode === "SEGMENTADA" ? selectedUserIds : [],
          },
          expiresAt: expiresAtIso,
        }),
      });
    },
    onSuccess: async () => {
      setAudienceMode("GLOBAL");
      setTitle("");
      setExpiresAt(futureDefault());
      setSelectedTeamIds([]);
      setSelectedUserIds([]);
      setTeamFilter("");
      setUserFilter("");
      setBlocks([createBlock("TITLE"), createBlock("TEXT")]);
      setFormError(null);
      await queryClient.invalidateQueries({
        queryKey: ["active-announcements"],
      });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      setFormError(error.message);
    },
  });

  const previewBlocks = useMemo(
    () => normalizeBlocksForSubmit(blocks, title.trim() || "Nuevo anuncio"),
    [blocks, title],
  );

  const filteredTeams = useMemo(() => {
    const source = teamsQuery.data?.items ?? [];
    const needle = teamFilter.trim().toLowerCase();
    if (!needle) {
      return source;
    }
    return source.filter((team) => team.name.toLowerCase().includes(needle));
  }, [teamFilter, teamsQuery.data?.items]);

  const filteredUsers = useMemo(() => {
    const source = usersQuery.data ?? [];
    const needle = userFilter.trim().toLowerCase();
    if (!needle) {
      return source;
    }
    return source.filter(
      (user) =>
        user.fullName.toLowerCase().includes(needle) ||
        user.contact.email.toLowerCase().includes(needle),
    );
  }, [userFilter, usersQuery.data]);

  const uploadBlockAsset = async (
    blockId: string,
    file: File,
    blockType: "IMAGE" | "FILE",
  ) => {
    setUploadError(null);
    setUploadingBlockId(blockId);
    try {
      const uploadFile =
        blockType === "IMAGE" ? await optimizeImageBeforeUpload(file) : file;
      const formData = new FormData();
      formData.append("file", uploadFile, uploadFile.name);
      const uploaded = await apiRequest<AnnouncementAssetUploadResponse>(
        "/announcements/assets/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      setBlocks((current) =>
        current.map((item) => {
          if (item.clientId !== blockId) {
            return item;
          }

          if (blockType === "IMAGE" && item.type === "IMAGE") {
            return {
              ...item,
              url: uploaded.url,
            };
          }

          if (blockType === "FILE" && item.type === "FILE") {
            return {
              ...item,
              url: `${uploaded.url}&mode=attachment`,
              label: item.label || uploaded.name,
            };
          }

          return item;
        }),
      );
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploadingBlockId(null);
    }
  };

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Publicar anuncio</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Título del anuncio
            </span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Cambio de horario operativo"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Fecha de expiración
            </span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Audiencia
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="admin-announcement-audience-mode"
                checked={audienceMode === "GLOBAL"}
                onChange={(event) => {
                  if (event.target.checked) {
                    setAudienceMode("GLOBAL");
                    setSelectedTeamIds([]);
                    setSelectedUserIds([]);
                  }
                }}
              />
              Global (todos los usuarios)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="admin-announcement-audience-mode"
                checked={audienceMode === "SEGMENTADA"}
                onChange={(event) => {
                  if (event.target.checked) {
                    setAudienceMode("SEGMENTADA");
                  }
                }}
              />
              Segmentada (equipos y/o usuarios específicos)
            </label>

            {audienceMode === "SEGMENTADA" ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Equipos</p>
                  <input
                    className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs"
                    placeholder="Filtrar equipos..."
                    value={teamFilter}
                    onChange={(event) => setTeamFilter(event.target.value)}
                  />
                  <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {filteredTeams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-2 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.includes(team.id)}
                          onChange={(event) => {
                            setSelectedTeamIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, team.id])]
                                : current.filter((id) => id !== team.id),
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
                  <input
                    className="h-8 w-full rounded-lg border border-slate-300 px-2 text-xs"
                    placeholder="Filtrar por nombre o email..."
                    value={userFilter}
                    onChange={(event) => setUserFilter(event.target.value)}
                  />
                  <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {filteredUsers.map((user) => (
                      <label
                        key={user.userId}
                        className="flex items-center gap-2 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.userId)}
                          onChange={(event) => {
                            setSelectedUserIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, user.userId])]
                                : current.filter((id) => id !== user.userId),
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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Constructor de contenido
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setBlocks((current) => [...current, createBlock("TITLE")])
                }
              >
                + Título
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setBlocks((current) => [...current, createBlock("SUBTITLE")])
                }
              >
                + Subtítulo
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setBlocks((current) => [...current, createBlock("TEXT")])
                }
              >
                + Texto
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setBlocks((current) => [...current, createBlock("IMAGE")])
                }
              >
                + Imagen
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setBlocks((current) => [...current, createBlock("FILE")])
                }
              >
                + Archivo
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setBlocks((current) => [...current, createBlock("DIVIDER")])
                }
              >
                + Separador
              </Button>
            </div>

            <ul className="space-y-2">
              {blocks.map((block, index) => {
                const imagePreviewUrl =
                  block.type === "IMAGE" && block.url
                    ? (resolveAnnouncementImageCandidates({
                        value: block.url,
                        apiBase,
                      })[0] ?? block.url)
                    : "";

                return (
                  <li
                    key={block.clientId}
                    className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
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
                            setBlocks((current) =>
                              current.filter(
                                (item) => item.clientId !== block.clientId,
                              ),
                            );
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    {block.type === "TITLE" ||
                    block.type === "SUBTITLE" ||
                    block.type === "TEXT" ? (
                      <textarea
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        rows={block.type === "TEXT" ? 4 : 2}
                        value={block.text}
                        onChange={(event) => {
                          const value = event.target.value;
                          setBlocks((current) =>
                            current.map((item) =>
                              item.clientId === block.clientId &&
                              (item.type === "TITLE" ||
                                item.type === "SUBTITLE" ||
                                item.type === "TEXT")
                                ? {
                                    ...item,
                                    text: value,
                                  }
                                : item,
                            ),
                          );
                        }}
                        placeholder={
                          block.type === "TEXT"
                            ? "Contenido del anuncio..."
                            : "Texto"
                        }
                      />
                    ) : null}

                    {block.type === "IMAGE" ? (
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-600">
                          Subir imagen
                          <input
                            type="file"
                            accept="image/*"
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            disabled={uploadingBlockId === block.clientId}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) {
                                return;
                              }
                              void uploadBlockAsset(
                                block.clientId,
                                file,
                                "IMAGE",
                              );
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {uploadingBlockId === block.clientId ? (
                          <p className="text-xs text-slate-500">
                            Subiendo imagen...
                          </p>
                        ) : imagePreviewUrl ? (
                          <div
                            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            style={{ minHeight: "120px" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imagePreviewUrl}
                              alt={block.alt || "Vista previa"}
                              className="max-h-48 w-full object-contain"
                            />
                          </div>
                        ) : null}
                        <label className="text-xs text-slate-600">
                          Texto alternativo
                          <input
                            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                            placeholder="Texto alternativo (descripción de la imagen)"
                            value={block.alt}
                            onChange={(event) => {
                              const value = event.target.value;
                              setBlocks((current) =>
                                current.map((item) =>
                                  item.clientId === block.clientId &&
                                  item.type === "IMAGE"
                                    ? {
                                        ...item,
                                        alt: value,
                                      }
                                    : item,
                                ),
                              );
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {block.type === "FILE" ? (
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-600">
                          Subir archivo
                          <input
                            type="file"
                            className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            disabled={uploadingBlockId === block.clientId}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) {
                                return;
                              }
                              void uploadBlockAsset(
                                block.clientId,
                                file,
                                "FILE",
                              );
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {uploadingBlockId === block.clientId ? (
                          <p className="text-xs text-slate-500">
                            Subiendo archivo...
                          </p>
                        ) : block.url ? (
                          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                            Archivo cargado correctamente
                          </p>
                        ) : null}
                        <input
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                          placeholder="Etiqueta del archivo (ej. Política 2026)"
                          value={block.label}
                          onChange={(event) => {
                            const value = event.target.value;
                            setBlocks((current) =>
                              current.map((item) =>
                                item.clientId === block.clientId &&
                                item.type === "FILE"
                                  ? {
                                      ...item,
                                      label: value,
                                    }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {uploadError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </p>
          ) : null}

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
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Vista previa
          </p>
          <article className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-lg font-semibold text-slate-900">
              {title.trim() || "Título del anuncio"}
            </h3>
            <AnnouncementContent blocks={previewBlocks} />
          </article>
        </section>
      </div>
    </Card>
  );
};
