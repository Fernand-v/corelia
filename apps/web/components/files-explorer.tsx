"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getApiBaseUrl, getAuthToken, getPublicApiKey } from "@/lib/api";
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
          Authorization: `Bearer ${token}`,
          "x-api-key": getPublicApiKey()
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
  const folders = explorerQuery.data?.folders ?? [];
  const files = explorerQuery.data?.files ?? [];

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
    </section>
  );
};
