"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";
import { DM_Sans, Sora } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"]
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

type FolderItem = {
  id: string;
  name: string;
  fileCount?: number | null;
  sizeBytes?: number | null;
};

type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  uploadedBy: string;
  uploadedById?: string | null;
  folderPath?: string | null;
};

type ChangeLogItem = {
  id: string;
  actorName: string;
  actorId?: string | null;
  fileName?: string | null;
  folderPath?: string | null;
  description: string;
  occurredAt: string;
};

type FolderPathItem = {
  id: string;
  name: string;
};

type CurrentUser = {
  id: string;
  name: string;
};

export type FilesModuleProps = {
  folders: FolderItem[];
  currentFolder: FolderPathItem | null;
  folderPath: FolderPathItem[];
  files: FileItem[];
  recentFiles: FileItem[];
  storageUsed: number;
  storageTotal: number;
  changeLog: ChangeLogItem[];
  onCreateFolder: (name: string) => void | Promise<void>;
  onUploadFile: (file: File) => void | Promise<void>;
  onOpenFolder: (folder: FolderItem | FolderPathItem) => void;
  onGoBack: () => void;
  onDownloadFile: (file: FileItem) => void | Promise<void>;
  onDeleteFile: (file: FileItem) => void | Promise<void>;
  onShareFile: (file: FileItem) => void | Promise<void>;
  onPreviewFile?: (file: FileItem) => void | Promise<void>;
  currentUser: CurrentUser;
  onViewChanges?: () => void;
  onOpenRoot?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
};

const isPreviewable = (file: FileItem) => {
  const mime = file.mimeType.toLowerCase();
  if (
    mime.startsWith("image/") ||
    mime.includes("pdf") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  ) {
    return true;
  }

  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".mp4") ||
    name.endsWith(".webm") ||
    name.endsWith(".mov") ||
    name.endsWith(".m4v") ||
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".ogg") ||
    name.endsWith(".m4a")
  );
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatRelativeDate = (value: string) => {
  const now = new Date();
  const date = new Date(value);
  const diff = now.getTime() - date.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);

  if (days <= 0) {
    return "Hoy";
  }
  if (days === 1) {
    return "Ayer";
  }
  if (days < 30) {
    return `hace ${days} días`;
  }

  return date.toLocaleDateString("es-ES", {
    dateStyle: "medium"
  });
};

const initialsFromName = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "??";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
};

const fileTypeMeta = (file: FileItem) => {
  const mime = file.mimeType.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return {
      icon: "📕",
      label: "PDF",
      badge: "bg-urgent-muted text-urgent"
    };
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return {
      icon: "📗",
      label: "Excel",
      badge: "bg-paper text-ink"
    };
  }
  if (mime.startsWith("image/")) {
    return {
      icon: "🖼️",
      label: "Imagen",
      badge: "bg-paper text-ink"
    };
  }
  if (mime.startsWith("video/")) {
    return {
      icon: "🎬",
      label: "Video",
      badge: "bg-paper text-ink"
    };
  }
  if (mime.startsWith("audio/")) {
    return {
      icon: "🎵",
      label: "Audio",
      badge: "bg-paper text-ink"
    };
  }
  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    name.endsWith(".zip") ||
    name.endsWith(".rar")
  ) {
    return {
      icon: "🗜️",
      label: "ZIP",
      badge: "bg-paper text-ink"
    };
  }
  if (
    mime.includes("word") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  ) {
    return {
      icon: "📘",
      label: "Word",
      badge: "bg-paper text-ink"
    };
  }
  return {
    icon: "📄",
    label: "Archivo",
    badge: "bg-line text-ink"
  };
};

const FoldersSkeleton = () => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={`folder-skeleton-${index}`}
        className="h-28 animate-pulse rounded-[14px] border border-[#e4e9f0] bg-white"
      />
    ))}
  </div>
);

const FilesSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={`file-skeleton-${index}`}
        className="h-14 animate-pulse rounded-[12px] bg-line"
      />
    ))}
  </div>
);

export const FilesModule = ({
  folders,
  currentFolder,
  folderPath,
  files,
  recentFiles,
  storageUsed,
  storageTotal,
  changeLog,
  onCreateFolder,
  onUploadFile,
  onOpenFolder,
  onGoBack,
  onDownloadFile,
  onDeleteFile,
  onShareFile,
  onPreviewFile,
  currentUser,
  onViewChanges,
  onOpenRoot,
  isLoading = false,
  errorMessage = null
}: FilesModuleProps) => {
  const [folderName, setFolderName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [showFilesTable, setShowFilesTable] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const query = searchTerm.trim().toLowerCase();

  const filteredFolders = useMemo(() => {
    if (!query) {
      return folders;
    }
    return folders.filter((folder) => folder.name.toLowerCase().includes(query));
  }, [folders, query]);

  const filteredFiles = useMemo(() => {
    if (!query) {
      return files;
    }
    return files.filter((file) => {
      return (
        file.name.toLowerCase().includes(query) ||
        file.mimeType.toLowerCase().includes(query) ||
        (file.uploadedBy ?? "").toLowerCase().includes(query)
      );
    });
  }, [files, query]);

  const explorerRows = useMemo<
    Array<
      | { id: string; kind: "folder"; folder: FolderItem }
      | { id: string; kind: "file"; file: FileItem; meta: ReturnType<typeof fileTypeMeta> }
    >
  >(() => {
    const folderRows = filteredFolders.map((folder) => ({
      id: `folder:${folder.id}`,
      kind: "folder" as const,
      folder
    }));
    const fileRows = filteredFiles.map((file) => ({
      id: `file:${file.id}`,
      kind: "file" as const,
      file,
      meta: fileTypeMeta(file)
    }));
    return [...folderRows, ...fileRows];
  }, [filteredFiles, filteredFolders]);

  const storagePct =
    storageTotal > 0
      ? Math.min(100, Math.max(0, (storageUsed / storageTotal) * 100))
      : 0;

  const spaceAvailable = Math.max(0, storageTotal - storageUsed);

  const handleCreateFolder = () => {
    const clean = folderName.trim();
    if (!clean) {
      return;
    }
    void onCreateFolder(clean);
    setFolderName("");
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    void onUploadFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) {
      return;
    }
    void onUploadFile(file);
  };

  return (
    <section
      className={`${dmSans.className} files-module-scroll h-full w-full overflow-hidden bg-[#f6f8fb] text-ink`}
      style={{ scrollbarWidth: "thin" }}
    >
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-[#e4e9f0] bg-paper px-5 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {currentFolder ? (
                <button
                  type="button"
                  onClick={onGoBack}
                  className="rounded-[10px] border border-[#e4e9f0] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-line"
                >
                  ← Volver
                </button>
              ) : null}

              <nav className="flex min-w-0 items-center gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenRoot) {
                      onOpenRoot();
                      return;
                    }
                    if (currentFolder) {
                      onGoBack();
                    }
                  }}
                  className="rounded-[8px] px-1 py-0.5 font-medium text-[#3b6cf6] hover:bg-paper"
                >
                  Archivos
                </button>

                {folderPath.map((item, index) => {
                  const isLast = index === folderPath.length - 1;
                  return (
                    <span key={item.id} className="flex min-w-0 items-center gap-1">
                      <span className="text-faint">›</span>
                      <button
                        type="button"
                        onClick={() => onOpenFolder(item)}
                        className={`truncate rounded-[8px] px-1 py-0.5 text-left ${
                          isLast
                            ? `${sora.className} font-semibold text-ink`
                            : "text-mid hover:bg-line"
                        }`}
                      >
                        {item.name}
                      </button>
                    </span>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onViewChanges?.()}
                className="rounded-[10px] border border-[#d8dee9] bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-line"
              >
                Ver cambios
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.focus()}
                className="inline-flex items-center gap-1 rounded-[10px] bg-[#3b6cf6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2e5ae0]"
              >
                <span className="text-sm leading-none">＋</span>
                Nueva carpeta
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {errorMessage ? (
            <div className="mb-4 rounded-[12px] border border-urgent/30 bg-urgent-muted px-4 py-3 text-sm text-urgent">
              {errorMessage}
            </div>
          ) : null}

          <section
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-[14px] border-2 border-dashed bg-white px-5 py-5 shadow-[0_2px_12px_rgba(15,27,45,.07)] transition-all ${
              dragActive ? "border-[#3b6cf6] bg-paper/40" : "border-[#d5deeb]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-xl text-[#3b6cf6]">
                  ☁️
                </span>
                <span className="min-w-0">
                  <span className={`${sora.className} block text-sm font-semibold text-ink`}>
                    Arrastra archivos aquí
                  </span>
                  <span className="block text-xs text-mid">
                    o haz clic para buscar en tu computadora
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="rounded-[10px] border border-[#3b6cf6] bg-white px-3 py-2 text-xs font-semibold text-[#3b6cf6] hover:bg-paper"
              >
                Subir archivo
              </button>
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInput}
            />
          </section>

          <section className="mt-4 rounded-[14px] border border-[#e4e9f0] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(15,27,45,.07)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[320px] flex-1 items-center gap-2">
                <span className="text-sm text-mid">📁</span>
                <input
                  ref={folderInputRef}
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateFolder();
                    }
                  }}
                  placeholder="Nombre de carpeta"
                  className="h-10 flex-1 rounded-[10px] border border-[#e4e9f0] px-3 text-sm outline-none focus:border-[#3b6cf6]"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="h-10 rounded-[10px] bg-[#3b6cf6] px-3 text-xs font-semibold text-white hover:bg-[#2e5ae0]"
                >
                  Crear carpeta
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-[10px] border border-[#e4e9f0] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-[8px] px-2 py-1 text-xs ${
                      viewMode === "grid" ? "bg-paper text-[#3b6cf6]" : "text-mid"
                    }`}
                  >
                    ⬚
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded-[8px] px-2 py-1 text-xs ${
                      viewMode === "list" ? "bg-paper text-[#3b6cf6]" : "text-mid"
                    }`}
                  >
                    ☰
                  </button>
                </div>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar..."
                  className="h-10 w-44 rounded-[10px] border border-[#e4e9f0] px-3 text-sm outline-none focus:border-[#3b6cf6]"
                />
              </div>
            </div>
          </section>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className={`${sora.className} text-sm font-semibold text-ink`}>
                Carpetas
                <span className="ml-2 text-xs font-medium text-mid">
                  ({filteredFolders.length})
                </span>
              </h2>
            </div>

            {isLoading ? (
              <FoldersSkeleton />
            ) : viewMode === "grid" ? (
              filteredFolders.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#d5deeb] bg-white px-6 py-10 text-center shadow-[0_2px_12px_rgba(15,27,45,.07)]">
                <p className="text-4xl opacity-30">📁</p>
                <p className={`${sora.className} mt-2 text-sm font-semibold text-ink`}>
                  No hay carpetas aquí todavía
                </p>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.focus()}
                  className="mt-3 rounded-[10px] bg-[#3b6cf6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2e5ae0]"
                >
                  Crear primera carpeta
                </button>
              </div>
              ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredFolders.map((folder, index) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onOpenFolder(folder)}
                    className="group relative overflow-hidden rounded-[14px] border border-[#e4e9f0] bg-white p-4 text-left opacity-0 shadow-[0_2px_12px_rgba(15,27,45,.07)] transition-all duration-150 hover:-translate-y-0.5 hover:border-line hover:shadow-[0_8px_18px_rgba(15,27,45,.12)] [animation:coreliaFadeUp_280ms_ease_forwards]"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#3b6cf6] to-[#5b8bff] opacity-0 transition group-hover:opacity-100" />
                    <p className="text-2xl">📁</p>
                    <p className={`${sora.className} mt-2 truncate text-sm font-semibold text-ink`}>
                      {folder.name}
                    </p>
                    <p className="mt-1 text-xs text-mid">
                      {folder.fileCount == null
                        ? "Archivos: sin detalle"
                        : `${folder.fileCount.toLocaleString("es-ES")} archivos`}{" "}
                      ·{" "}
                      {folder.sizeBytes == null
                        ? "Tamaño: sin detalle"
                        : formatBytes(folder.sizeBytes)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-mid">
                      <span>{folder.sizeBytes == null ? "Sin tamaño" : formatBytes(folder.sizeBytes)}</span>
                      <span>⋯</span>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.focus()}
                  className="rounded-[14px] border border-dashed border-[#d5deeb] bg-white p-4 text-left text-xs text-mid transition hover:border-[#3b6cf6] hover:text-[#3b6cf6]"
                >
                  <p className="text-xl">＋</p>
                  <p className="mt-2 font-semibold">Nueva carpeta</p>
                </button>
              </div>
              )
            ) : explorerRows.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#d5deeb] bg-white px-6 py-10 text-center shadow-[0_2px_12px_rgba(15,27,45,.07)]">
                <p className="text-4xl opacity-30">📂</p>
                <p className={`${sora.className} mt-2 text-sm font-semibold text-ink`}>
                  Esta carpeta no tiene elementos
                </p>
                <p className="mt-1 text-xs text-mid">Crea una subcarpeta o sube un archivo para comenzar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[14px] border border-[#e4e9f0] bg-white shadow-[0_2px_12px_rgba(15,27,45,.07)]">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#eef2f8] text-xs uppercase tracking-wide text-mid">
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Tamaño</th>
                      <th className="px-3 py-2">Modificado</th>
                      <th className="px-3 py-2">Subido por</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {explorerRows.map((row) => {
                      if (row.kind === "folder") {
                        const folder = row.folder;
                        return (
                          <tr key={row.id} className="border-b border-[#f1f4f9] transition hover:bg-line">
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => onOpenFolder(folder)}
                                className="flex items-center gap-2 text-left text-sm font-semibold text-ink hover:text-[#3b6cf6]"
                              >
                                <span>📁</span>
                                <span className="truncate">{folder.name}</span>
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink">
                                Carpeta
                              </span>
                            </td>
                            <td className="px-3 py-3 text-ink">
                              {folder.sizeBytes == null ? "-" : formatBytes(folder.sizeBytes)}
                            </td>
                            <td className="px-3 py-3 text-mid">-</td>
                            <td className="px-3 py-3 text-mid">-</td>
                            <td className="px-3 py-3 text-mid">Abrir</td>
                          </tr>
                        );
                      }

                      const file = row.file;
                      const type = row.meta;
                      const isCurrentUser =
                        file.uploadedById === currentUser.id || file.uploadedBy === currentUser.name;

                      return (
                        <tr key={row.id} className="border-b border-[#f1f4f9] transition hover:bg-line">
                          <td className="px-3 py-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="text-xl">{type.icon}</span>
                              <span className="min-w-0">
                                <p className="truncate font-semibold text-ink">{file.name}</p>
                                <p className="truncate text-xs text-mid">
                                  {file.folderPath ?? currentFolder?.name ?? "/"}
                                </p>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.badge}`}>
                              {type.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-ink">{formatBytes(file.sizeBytes)}</td>
                          <td className="px-3 py-3 text-ink">{formatRelativeDate(file.modifiedAt)}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-line text-[11px] font-semibold text-ink">
                                {initialsFromName(file.uploadedBy)}
                              </span>
                              <span className="text-ink">
                                {file.uploadedBy}
                                {isCurrentUser ? " (Tú)" : ""}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              {onPreviewFile && isPreviewable(file) ? (
                                <button
                                  type="button"
                                  onClick={() => void onPreviewFile(file)}
                                  title="Previsualizar"
                                  className="rounded-[8px] border border-[#e4e9f0] px-2 py-1 text-xs text-mid hover:bg-white"
                                >
                                  👁
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void onDownloadFile(file)}
                                className="rounded-[8px] border border-[#e4e9f0] px-2 py-1 text-xs text-mid hover:bg-white"
                              >
                                ⬇
                              </button>
                              <button
                                type="button"
                                onClick={() => void onShareFile(file)}
                                className="rounded-[8px] border border-[#e4e9f0] px-2 py-1 text-xs text-mid hover:bg-white"
                              >
                                ↗
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDeleteFile(file)}
                                className="rounded-[8px] border border-urgent/30 px-2 py-1 text-xs text-urgent hover:bg-urgent-muted"
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {showFilesTable ? (
            <section className="mt-4 rounded-[14px] border border-[#e4e9f0] bg-white shadow-[0_2px_12px_rgba(15,27,45,.07)]">
              <div className="border-b border-[#eef2f8] px-4 py-3">
                <h3 className={`${sora.className} text-sm font-semibold text-ink`}>
                  Archivos en esta carpeta
                  <span className="ml-2 text-xs font-medium text-mid">
                    ({filteredFiles.length})
                  </span>
                </h3>
              </div>

              <div className="px-4 py-3">
                {isLoading ? (
                  <FilesSkeleton />
                ) : filteredFiles.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-[#d5deeb] bg-[#f9fbff] px-5 py-8 text-center">
                    <p className="text-4xl opacity-30">📄</p>
                    <p className={`${sora.className} mt-2 text-sm font-semibold text-ink`}>
                      Esta carpeta está vacía
                    </p>
                    <p className="mt-1 text-xs text-mid">
                      Sube el primer archivo usando el área de arriba
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[880px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#eef2f8] text-xs uppercase tracking-wide text-mid">
                          <th className="px-2 py-2">Nombre</th>
                          <th className="px-2 py-2">Tipo</th>
                          <th className="px-2 py-2">Tamaño</th>
                          <th className="px-2 py-2">Modificado</th>
                          <th className="px-2 py-2">Subido por</th>
                          <th className="px-2 py-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFiles.map((file) => {
                          const type = fileTypeMeta(file);
                          const isCurrentUser =
                            file.uploadedById === currentUser.id ||
                            file.uploadedBy === currentUser.name;
                          return (
                            <tr
                              key={file.id}
                              className="border-b border-[#f1f4f9] transition hover:bg-line"
                            >
                              <td className="px-2 py-3">
                                <div className="flex min-w-0 items-start gap-2">
                                  <span className="text-xl">{type.icon}</span>
                                  <span className="min-w-0">
                                    <p className="truncate font-semibold text-ink">{file.name}</p>
                                    <p className="truncate text-xs text-mid">
                                      {file.folderPath ?? currentFolder?.name ?? "/"}
                                    </p>
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.badge}`}>
                                  {type.label}
                                </span>
                              </td>
                              <td className="px-2 py-3 text-ink">{formatBytes(file.sizeBytes)}</td>
                              <td className="px-2 py-3 text-ink">
                                {formatRelativeDate(file.modifiedAt)}
                              </td>
                              <td className="px-2 py-3">
                                <span className="inline-flex items-center gap-2">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-line text-[11px] font-semibold text-ink">
                                    {initialsFromName(file.uploadedBy)}
                                  </span>
                                  <span className="text-ink">
                                    {file.uploadedBy}
                                    {isCurrentUser ? " (Tú)" : ""}
                                  </span>
                                </span>
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-1">
                                  {onPreviewFile && isPreviewable(file) ? (
                                    <button
                                      type="button"
                                      onClick={() => void onPreviewFile(file)}
                                      title="Previsualizar"
                                      className="rounded-[8px] border border-[#e4e9f0] px-2 py-1 text-xs text-mid hover:bg-white"
                                    >
                                      👁
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => void onDownloadFile(file)}
                                    className="rounded-[8px] border border-[#e4e9f0] px-2 py-1 text-xs text-mid hover:bg-white"
                                  >
                                    ⬇
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void onShareFile(file)}
                                    className="rounded-[8px] border border-[#e4e9f0] px-2 py-1 text-xs text-mid hover:bg-white"
                                  >
                                    ↗
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void onDeleteFile(file)}
                                    className="rounded-[8px] border border-urgent/30 px-2 py-1 text-xs text-urgent hover:bg-urgent-muted"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* Collapsible panels row */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFilesTable((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-semibold transition ${
                showFilesTable
                  ? "border-[#3b6cf6] bg-paper text-[#3b6cf6]"
                  : "border-[#e4e9f0] bg-white text-ink hover:bg-line"
              }`}
            >
              <span className="text-sm leading-none">📄</span>
              Archivos ({filteredFiles.length})
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`h-3 w-3 transition-transform ${showFilesTable ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {recentFiles.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowRecentFiles((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-semibold transition ${
                  showRecentFiles
                    ? "border-[#3b6cf6] bg-paper text-[#3b6cf6]"
                    : "border-[#e4e9f0] bg-white text-ink hover:bg-line"
                }`}
              >
                <span className="text-sm leading-none">🕐</span>
                Recientes ({recentFiles.length > 8 ? "8+" : recentFiles.length})
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`h-3 w-3 transition-transform ${showRecentFiles ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowChangeLog((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-semibold transition ${
                showChangeLog
                  ? "border-[#3b6cf6] bg-paper text-[#3b6cf6]"
                  : "border-[#e4e9f0] bg-white text-ink hover:bg-line"
              }`}
            >
              <span className="text-sm leading-none">📋</span>
              Historial ({changeLog.length})
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`h-3 w-3 transition-transform ${showChangeLog ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>

          {showRecentFiles && recentFiles.length > 0 ? (
            <section className="mt-2 rounded-[14px] border border-[#e4e9f0] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(15,27,45,.07)]">
              <h4 className={`${sora.className} mb-2 text-sm font-semibold text-ink`}>
                Últimos archivos subidos
              </h4>
              <div className="flex flex-wrap gap-2">
                {recentFiles.slice(0, 8).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => void onDownloadFile(file)}
                    className="rounded-full border border-[#e4e9f0] bg-line px-3 py-1 text-xs text-ink hover:bg-white"
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showChangeLog ? (
            <section className="mt-2 rounded-[14px] border border-[#e4e9f0] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(15,27,45,.07)]">
              <div className="mb-2 flex items-center justify-between">
                <h4 className={`${sora.className} text-sm font-semibold text-ink`}>
                  Historial de cambios
                </h4>
                <button
                  type="button"
                  onClick={() => onViewChanges?.()}
                  className="rounded-[10px] border border-[#e4e9f0] bg-white px-3 py-1.5 text-xs font-semibold text-mid hover:bg-line"
                >
                  Ver todos
                </button>
              </div>

              {changeLog.length === 0 ? (
                <p className="text-sm text-mid">Sin cambios registrados aún</p>
              ) : (
                <ul className="space-y-2">
                  {changeLog.map((change) => (
                    <li
                      key={change.id}
                      className="flex items-start justify-between gap-3 rounded-[12px] border border-[#eef2f8] bg-line px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-line text-[11px] font-semibold text-ink">
                            {initialsFromName(change.actorName)}
                          </span>
                          <p className="min-w-0 text-sm text-ink">
                            <span className="font-semibold text-ink">{change.actorName}</span>{" "}
                            {change.description}{" "}
                            {change.fileName ? (
                              <span className="font-semibold text-[#3b6cf6]">{change.fileName}</span>
                            ) : null}
                            {change.folderPath ? (
                              <span className="text-mid"> en {change.folderPath}</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-mid">
                        {formatRelativeDate(change.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="mt-4 rounded-[14px] border border-[#e4e9f0] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(15,27,45,.07)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🗄️</span>
                <h4 className={`${sora.className} text-sm font-semibold text-ink`}>
                  Almacenamiento usado
                </h4>
              </div>
              <p className="text-xs text-mid">
                {storageTotal > 0
                  ? `${formatBytes(storageUsed)} de ${formatBytes(storageTotal)}`
                  : `${formatBytes(storageUsed)} usados`}
              </p>
            </div>

            <div className="mt-2 h-2 rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3b6cf6] to-[#10b981] transition-all"
                style={{ width: `${storagePct}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-mid">
                {storageTotal > 0
                  ? `Espacio disponible: ${formatBytes(spaceAvailable)}`
                  : "Cuota de almacenamiento no reportada por la API"}
              </p>
              {storageTotal > 0 && storagePct >= 80 ? (
                <button
                  type="button"
                  className="rounded-[10px] border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                >
                  Ampliar
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @keyframes coreliaFadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .files-module-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .files-module-scroll::-webkit-scrollbar-thumb {
          background: #d0d0d0;
          border-radius: 999px;
        }
        .files-module-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </section>
  );
};
