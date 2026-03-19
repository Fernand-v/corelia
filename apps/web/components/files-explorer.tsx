"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getApiBaseUrl, getAuthToken } from "@/lib/api";
import { useSession } from "@/lib/session";
import { withDashboardContext } from "@/lib/context";
import { FilesModule } from "@/components/files-module";
import { UiModal } from "@/components/ui-modal";

type ExplorerResponse = {
  project: {
    id: string;
    name: string;
  };
  currentFolder: {
    id: string;
    name: string;
    parentId: string | null;
  } | null;
  breadcrumbs: Array<{
    id: string;
    name: string;
  }>;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    createdAt: string;
  }>;
  files: Array<{
    id: string;
    folderId: string;
    ownerId: string;
    folderName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    minioPath: string;
    createdAt: string;
    ownerName: string;
  }>;
};

type ProjectChangesResponse = {
  project: {
    id: string;
    name: string;
  };
  changes: Array<{
    id: string;
    type: "CARPETA_CREADA" | "ARCHIVO_SUBIDO" | "ARCHIVO_ELIMINADO";
    title: string;
    detail: string;
    actorName: string;
    occurredAt: string;
  }>;
};

type StorageSummaryResponse = {
  projectId: string;
  usageBytes: number;
  bytesLimit: number;
  remainingBytes: number;
  usagePct: number;
  warning80: boolean;
};

type ExplorerFileItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  uploadedBy: string;
  uploadedById?: string | null;
  folderPath?: string | null;
};

const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const isImageFile = (input: { mimeType: string; name: string }) =>
  input.mimeType.toLowerCase().startsWith("image/");

const isPdfFile = (input: { mimeType: string; name: string }) => {
  const mime = input.mimeType.toLowerCase();
  return mime.includes("pdf") || input.name.toLowerCase().endsWith(".pdf");
};

const isVideoFile = (input: { mimeType: string; name: string }) => {
  const mime = input.mimeType.toLowerCase();
  if (mime.startsWith("video/")) {
    return true;
  }

  const name = input.name.toLowerCase();
  return (
    name.endsWith(".mp4") ||
    name.endsWith(".webm") ||
    name.endsWith(".mov") ||
    name.endsWith(".m4v")
  );
};

const isAudioFile = (input: { mimeType: string; name: string }) => {
  const mime = input.mimeType.toLowerCase();
  if (mime.startsWith("audio/")) {
    return true;
  }

  const name = input.name.toLowerCase();
  return (
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".ogg") ||
    name.endsWith(".m4a")
  );
};

export const FilesExplorer = ({
  projectId,
  projectName,
  teamId
}: {
  projectId: string;
  projectName?: string | null;
  teamId?: string | null;
}) => {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExplorerFileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<ExplorerFileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const closePreview = useCallback(() => {
    setPreviewFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreviewFile = async (file: ExplorerFileItem) => {
    const token = getAuthToken();
    if (!token) {
      setActionError("Sesion no valida para previsualizar el archivo");
      return;
    }

    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewUrl(null);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/files/objects/${file.id}/content?mode=inline`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "No se pudo cargar la previsualizacion" }));
        throw new Error(body.message ?? "No se pudo cargar la previsualizacion");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      setPreviewFile(null);
      setActionError(error instanceof Error ? error.message : "Error al previsualizar");
    } finally {
      setPreviewLoading(false);
    }
  };

  const changesHref = withDashboardContext("/changes", {
    projectId,
    projectName: projectName ?? null,
    teamId: teamId ?? null
  });

  const explorerQuery = useQuery({
    queryKey: ["files", "explorer", projectId, folderId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("projectId", projectId);
      if (folderId) {
        params.set("folderId", folderId);
      }
      return apiRequest<ExplorerResponse>(`/files/explorer?${params.toString()}`);
    }
  });

  const historyQuery = useQuery({
    queryKey: ["files", "history", projectId],
    queryFn: () =>
      apiRequest<ProjectChangesResponse>(
        `/files/history?projectId=${encodeURIComponent(projectId)}&limit=40`
      )
  });

  const storageSummaryQuery = useQuery({
    queryKey: ["files", "storage-summary", projectId],
    queryFn: () =>
      apiRequest<StorageSummaryResponse>(
        `/files/storage-summary?projectId=${encodeURIComponent(projectId)}`
      )
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest(`/files/folders?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          scope: "PROYECTO",
          projectId,
          parentId: folderId
        })
      }),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["files", "explorer", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["files", "history", projectId] })
      ]);
    },
    onError: (error) => {
      setActionError(error.message);
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!folderId) {
        throw new Error("Debes abrir una carpeta antes de subir archivos");
      }

      const formData = new FormData();
      formData.append("folderId", folderId);
      formData.append("file", file, file.name);

      return apiRequest(`/files/upload?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: formData
      });
    },
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["files", "explorer", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["files", "history", projectId] })
      ]);
    },
    onError: (error) => {
      setActionError(error.message);
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) =>
      apiRequest(`/files/objects/${fileId}?projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["files", "explorer", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["files", "history", projectId] })
      ]);
    },
    onError: (error) => {
      setActionError(error.message);
    }
  });

  const openFile = async (file: ExplorerFileItem, mode: "inline" | "attachment") => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Sesión no válida para abrir el archivo");
    }

    const response = await fetch(
      `${getApiBaseUrl()}/files/objects/${file.id}/content?mode=${encodeURIComponent(mode)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "No se pudo abrir el archivo" }));
      throw new Error(body.message ?? "No se pudo abrir el archivo");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (mode === "inline") {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        URL.revokeObjectURL(url);
        throw new Error("El navegador bloqueó la previsualización");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const shareFile = async (file: ExplorerFileItem) => {
    const shareText = `${file.name} (${formatBytes(file.sizeBytes)})`;
    const shareUrl = `${window.location.origin}${changesHref}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Archivo de ${projectName ?? "proyecto"}`,
          text: shareText,
          url: shareUrl
        });
        setActionError(null);
        return;
      } catch {
        return;
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setActionError(null);
      return;
    }

    throw new Error("No se pudo compartir el archivo en este navegador");
  };

  const currentFolder = explorerQuery.data?.currentFolder ?? null;
  const folders = useMemo(() => explorerQuery.data?.folders ?? [], [explorerQuery.data?.folders]);
  const files = useMemo(() => explorerQuery.data?.files ?? [], [explorerQuery.data?.files]);

  const mappedFiles = useMemo<ExplorerFileItem[]>(() => {
    return files.map((file) => ({
      id: file.id,
      name: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      modifiedAt: file.createdAt,
      uploadedBy: file.ownerName,
      uploadedById: file.ownerId,
      folderPath: file.folderName
    }));
  }, [files]);

  const mappedFolders = useMemo(() => {
    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name
    }));
  }, [folders]);

  const mappedChangeLog = useMemo(() => {
    return (historyQuery.data?.changes ?? []).map((change) => {
      const description =
        change.type === "CARPETA_CREADA"
          ? "creó carpeta"
          : change.type === "ARCHIVO_ELIMINADO"
            ? "eliminó"
            : "subió";

      const folderPathMatch = change.detail.match(/en\s+(.+)$/i);
      return {
        id: change.id,
        actorName: change.actorName,
        fileName: change.title,
        folderPath: folderPathMatch?.[1] ?? null,
        description,
        occurredAt: change.occurredAt
      };
    });
  }, [historyQuery.data?.changes]);

  const fallbackStorageUsed = useMemo(() => {
    const unique = new Map<string, number>();
    for (const file of mappedFiles) {
      unique.set(file.id, file.sizeBytes);
    }
    return [...unique.values()].reduce((total, size) => total + size, 0);
  }, [mappedFiles]);

  const storageUsed = storageSummaryQuery.data?.usageBytes ?? fallbackStorageUsed;
  const storageTotal = storageSummaryQuery.data?.bytesLimit ?? 0;

  const combinedError =
    actionError ??
    explorerQuery.error?.message ??
    historyQuery.error?.message ??
    storageSummaryQuery.error?.message ??
    null;

  return (
    <section className="h-[calc(100vh-8rem)] min-h-[680px] w-full">
      <FilesModule
        folders={mappedFolders}
        currentFolder={
          currentFolder
            ? { id: currentFolder.id, name: currentFolder.name }
            : null
        }
        folderPath={explorerQuery.data?.breadcrumbs ?? []}
        files={mappedFiles}
        recentFiles={mappedFiles}
        storageUsed={storageUsed}
        storageTotal={storageTotal}
        changeLog={mappedChangeLog}
        isLoading={explorerQuery.isLoading}
        errorMessage={combinedError}
        currentUser={{
          id: session.data?.id ?? "",
          name: `${session.data?.firstName ?? ""} ${session.data?.lastName ?? ""}`.trim()
        }}
        onCreateFolder={(name) => {
          createFolderMutation.mutate(name);
        }}
        onUploadFile={(file) => {
          uploadFileMutation.mutate(file);
        }}
        onOpenFolder={(folder) => {
          setActionError(null);
          setFolderId(folder.id);
        }}
        onOpenRoot={() => {
          setActionError(null);
          setFolderId(null);
        }}
        onGoBack={() => {
          setActionError(null);
          setFolderId(currentFolder?.parentId ?? null);
        }}
        onPreviewFile={(file) => {
          void handlePreviewFile(file);
        }}
        onDownloadFile={(file) => {
          void openFile(file, "attachment").catch((error) => {
            setActionError(error.message);
          });
        }}
        onDeleteFile={(file) => {
          setDeleteTarget(file);
        }}
        onShareFile={(file) => {
          void shareFile(file).catch((error) => {
            setActionError(error.message);
          });
        }}
        onViewChanges={() => {
          router.push(changesHref as Route);
        }}
      />

      <UiModal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleteFileMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
        title="Eliminar archivo"
      >
        <p className="text-sm text-slate-700">
          ¿Seguro que deseas eliminar{" "}
          <span className="font-semibold text-slate-900">{deleteTarget?.name ?? "-"}</span>?
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteFileMutation.isPending}
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
              deleteFileMutation.mutate(deleteTarget.id);
              setDeleteTarget(null);
            }}
            disabled={deleteFileMutation.isPending}
            className="rounded-[10px] bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleteFileMutation.isPending ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </UiModal>

      {previewFile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePreview();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Previsualizar ${previewFile.name}`}
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">{previewFile.name}</h3>
                <p className="text-xs text-slate-500">{previewFile.mimeType}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void openFile(previewFile, "attachment").catch((error) => {
                      setActionError(error.message);
                    });
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-1">
              {previewLoading ? (
                <div className="flex h-96 items-center justify-center">
                  <p className="text-sm text-slate-500">Cargando previsualizacion...</p>
                </div>
              ) : previewUrl ? (
                isImageFile(previewFile) ? (
                  <div className="flex items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={previewFile.name}
                      className="max-h-[75vh] max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : isVideoFile(previewFile) ? (
                  <div className="flex items-center justify-center p-4">
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-[75vh] w-full rounded-lg bg-black"
                    >
                      Tu navegador no soporta la etiqueta de video.
                    </video>
                  </div>
                ) : isAudioFile(previewFile) ? (
                  <div className="flex h-[40vh] items-center justify-center p-4">
                    <audio src={previewUrl} controls className="w-full max-w-xl">
                      Tu navegador no soporta la etiqueta de audio.
                    </audio>
                  </div>
                ) : isPdfFile(previewFile) ? (
                  <iframe
                    src={previewUrl}
                    title={previewFile.name}
                    className="h-[75vh] w-full rounded-lg border-0"
                  />
                ) : (
                  <div className="flex h-96 items-center justify-center px-6">
                    <p className="text-center text-sm text-slate-500">
                      Este tipo de archivo no admite previsualizacion.
                    </p>
                  </div>
                )
              ) : (
                <div className="flex h-96 items-center justify-center">
                  <p className="text-sm text-slate-500">No se pudo cargar la previsualizacion</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
