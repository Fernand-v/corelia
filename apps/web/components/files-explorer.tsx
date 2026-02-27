"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

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
    folderName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    minioPath: string;
    createdAt: string;
    ownerName: string;
  }>;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });

const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

export const FilesExplorer = ({ projectId }: { projectId: string }) => {
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFile, setNewFile] = useState({
    originalName: "",
    mimeType: "application/octet-stream",
    sizeBytes: "1024",
    minioPath: ""
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

  const createFolderMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/files/folders?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: JSON.stringify({
          name: newFolderName.trim(),
          scope: "PROYECTO",
          projectId,
          parentId: folderId
        })
      }),
    onSuccess: async () => {
      setNewFolderName("");
      await queryClient.invalidateQueries({ queryKey: ["files", "explorer", projectId] });
    }
  });

  const createFileMutation = useMutation({
    mutationFn: () => {
      if (!folderId) {
        throw new Error("Selecciona una carpeta para registrar el archivo");
      }

      const parsedSize = Number.parseInt(newFile.sizeBytes, 10);
      if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
        throw new Error("Tamaño inválido");
      }

      return apiRequest(`/files/objects?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: JSON.stringify({
          folderId,
          originalName: newFile.originalName.trim(),
          mimeType: newFile.mimeType.trim(),
          sizeBytes: parsedSize,
          minioPath: newFile.minioPath.trim() || `project/${projectId}/${crypto.randomUUID()}`
        })
      });
    },
    onSuccess: async () => {
      setNewFile({
        originalName: "",
        mimeType: "application/octet-stream",
        sizeBytes: "1024",
        minioPath: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["files", "explorer", projectId] });
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) =>
      apiRequest(`/files/objects/${fileId}?projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["files", "explorer", projectId] });
    }
  });

  const currentFolder = explorerQuery.data?.currentFolder ?? null;
  const breadcrumbs = explorerQuery.data?.breadcrumbs ?? [];
  const folders = explorerQuery.data?.folders ?? [];
  const files = explorerQuery.data?.files ?? [];
  const isRoot = !currentFolder;

  const rootBreadcrumb = [{ id: "", name: "Proyecto" }, ...breadcrumbs];

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Explorador de Archivos</h2>
        <p className="text-sm text-slate-600">
          {explorerQuery.data?.project.name ? `Proyecto: ${explorerQuery.data.project.name}` : "Cargando proyecto..."}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {rootBreadcrumb.map((crumb, index) => {
            const isLast = index === rootBreadcrumb.length - 1;
            return (
              <button
                key={`${crumb.id}-${index}`}
                type="button"
                className={`rounded-lg border px-2 py-1 ${
                  isLast
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setFolderId(crumb.id || null)}
              >
                {crumb.name}
              </button>
            );
          })}
        </div>

        {!isRoot ? (
          <Button type="button" variant="secondary" onClick={() => setFolderId(currentFolder?.parentId ?? null)}>
            Subir un nivel
          </Button>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Crear carpeta</h3>
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Nombre de carpeta"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <Button
            type="button"
            className="w-full"
            disabled={createFolderMutation.isPending || newFolderName.trim().length < 2}
            onClick={() => createFolderMutation.mutate()}
          >
            {createFolderMutation.isPending ? "Creando..." : "Crear carpeta"}
          </Button>
          {createFolderMutation.error ? (
            <p className="text-sm text-red-600">{createFolderMutation.error.message}</p>
          ) : null}

          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold text-slate-900">Registrar archivo</h3>
            <p className="text-xs text-slate-500">
              {folderId
                ? "Se registrará en la carpeta activa."
                : "Abre una carpeta para registrar archivos."}
            </p>
            <div className="mt-2 space-y-2">
              <input
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Nombre del archivo"
                value={newFile.originalName}
                onChange={(event) =>
                  setNewFile((prev) => ({
                    ...prev,
                    originalName: event.target.value
                  }))
                }
              />
              <input
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="MIME Type"
                value={newFile.mimeType}
                onChange={(event) =>
                  setNewFile((prev) => ({
                    ...prev,
                    mimeType: event.target.value
                  }))
                }
              />
              <input
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Tamaño (bytes)"
                value={newFile.sizeBytes}
                onChange={(event) =>
                  setNewFile((prev) => ({
                    ...prev,
                    sizeBytes: event.target.value
                  }))
                }
              />
              <input
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Ruta interna (opcional)"
                value={newFile.minioPath}
                onChange={(event) =>
                  setNewFile((prev) => ({
                    ...prev,
                    minioPath: event.target.value
                  }))
                }
              />
            </div>
            <Button
              type="button"
              className="mt-2 w-full"
              disabled={createFileMutation.isPending || !folderId || !newFile.originalName.trim()}
              onClick={() => createFileMutation.mutate()}
            >
              {createFileMutation.isPending ? "Guardando..." : "Guardar archivo"}
            </Button>
            {createFileMutation.error ? (
              <p className="mt-2 text-sm text-red-600">{createFileMutation.error.message}</p>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {isRoot ? "Carpetas del proyecto y archivos recientes" : `Contenido de ${currentFolder?.name}`}
          </h3>

          {explorerQuery.isLoading ? <p className="text-sm text-slate-600">Cargando recursos...</p> : null}
          {explorerQuery.error ? <p className="text-sm text-red-600">{explorerQuery.error.message}</p> : null}

          <div className="grid gap-2 md:grid-cols-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setFolderId(folder.id)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
              >
                <p className="text-sm font-medium text-slate-900">{folder.name}</p>
                <p className="text-xs text-slate-600">{formatDateTime(folder.createdAt)}</p>
              </button>
            ))}
          </div>

          {folders.length === 0 ? (
            <p className="text-sm text-slate-600">No hay carpetas en esta ruta.</p>
          ) : null}

          <div className="space-y-2 border-t border-slate-200 pt-3">
            {files.length === 0 ? (
              <p className="text-sm text-slate-600">Sin archivos para mostrar.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((file) => (
                  <li key={file.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{file.originalName}</p>
                        <p className="text-xs text-slate-600">
                          {file.mimeType} · {formatBytes(file.sizeBytes)} · {file.folderName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {file.ownerName} · {formatDateTime(file.createdAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        className="h-8 px-3 text-xs"
                        disabled={deleteFileMutation.isPending}
                        onClick={() => deleteFileMutation.mutate(file.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
