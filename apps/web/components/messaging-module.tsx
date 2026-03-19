"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

type ConversationItem = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt?: string | null;
  unreadCount?: number;
  isOnline?: boolean;
};

type ChatAttachment = {
  id: string;
  name: string;
  mimeType?: string | null;
  sizeLabel?: string | null;
  sizeBytes?: number | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  kind?: "TEXT" | "FILE" | "CALL_INVITE";
  meetingUrl?: string | null;
  callExpired?: boolean;
  attachments?: ChatAttachment[];
  status?: "sent" | "delivered" | "read";
};

export type PendingFile = {
  id: string;
  file: File;
  previewUrl: string | null;
  type: "image" | "video" | "audio" | "pdf" | "other";
};

export type UploadProgress = {
  fileId: string;
  progress: number;
  status: "compressing" | "uploading" | "done" | "error";
  errorMessage?: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  activeTasks?: number | null;
  status?: "EN_REUNION" | "DISPONIBLE" | "OCUPADO" | "AUSENTE";
};

type CurrentUser = {
  id: string;
  name: string;
};

type EmojiOption = {
  id: string;
  name: string;
  native: string;
  keywords: string[];
};

type ActiveComposerToken = {
  type: "mention" | "emoji";
  start: number;
  end: number;
  query: string;
};

export type TypingUser = {
  userId: string;
  userName: string;
};

export type MessagingModuleProps = {
  conversations: ConversationItem[];
  activeConversation: ConversationItem | null;
  messages: ChatMessage[];
  teamMembers: TeamMember[];
  typingUsers?: TypingUser[] | undefined;
  onSendMessage: (input: { content: string; mentions: string[] }) => void | Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onPreviewAttachment?: ((
    attachmentId: string,
    fileName: string,
    mimeType?: string | null
  ) => void | Promise<void>) | undefined;
  onDownloadAttachment?: ((attachmentId: string, fileName: string) => void | Promise<void>) | undefined;
  onComposerChange?: ((value: string) => void) | undefined;
  currentUser: CurrentUser;
  onOpenNewChat?: (() => void) | undefined;
  onStartCall?: (() => void) | undefined;
  actionError?: string | null | undefined;
  pendingFiles?: PendingFile[] | undefined;
  uploadProgress?: UploadProgress[] | undefined;
  onRemovePendingFile?: ((fileId: string) => void) | undefined;
  onConfirmSendFiles?: (() => void) | undefined;
  onRetryUpload?: ((fileId: string) => void) | undefined;
  resolveAttachmentUrl?: ((attachmentId: string) => Promise<string>) | undefined;
};

// ─── Utility Functions ───────────────────────────────────────────────────────

const formatTime = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", { dateStyle: "medium" });

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
};

const normalizeHandle = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");

const mentionNodes = (content: string) => {
  const pieces = content.split(/(@[a-zA-Z0-9._-]+)/g);
  return pieces.map((piece, index) => {
    if (/^@[a-zA-Z0-9._-]+$/.test(piece)) {
      return (
        <span key={`mention-${piece}-${index}`} className="font-semibold text-[#128c7e]">
          {piece}
        </span>
      );
    }
    return <span key={`piece-${index}`}>{piece}</span>;
  });
};

const statusBadge = (status: TeamMember["status"]) => {
  if (status === "EN_REUNION") return "bg-amber-100 text-amber-800";
  if (status === "AUSENTE") return "bg-slate-200 text-slate-700";
  if (status === "OCUPADO") return "bg-red-100 text-red-700";
  return "bg-emerald-100 text-emerald-700";
};

const statusLabel: Record<NonNullable<TeamMember["status"]>, string> = {
  EN_REUNION: "En reunión",
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  AUSENTE: "Ausente"
};

const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAttachmentCategory = (input: { mimeType?: string | null; name: string }) => {
  const mime = (input.mimeType ?? "").toLowerCase().trim();
  const name = input.name.toLowerCase();

  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name)) return "image" as const;
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi)$/i.test(name)) return "video" as const;
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return "audio" as const;
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf" as const;
  return "other" as const;
};

const buildEmojiOptions = (): EmojiOption[] => {
  const source = (emojiData as { emojis?: Record<string, any> }).emojis ?? {};
  return Object.entries(source)
    .map(([id, value]) => ({
      id,
      name: String(value.name ?? id),
      native: String(value.skins?.[0]?.native ?? ""),
      keywords: Array.isArray(value.keywords) ? value.keywords.map((item: unknown) => String(item)) : []
    }))
    .filter((item) => Boolean(item.native));
};

const isWhitespace = (value: string) => /\s/.test(value);

const getActiveComposerToken = (
  text: string,
  selectionStart: number,
  selectionEnd: number
): ActiveComposerToken | null => {
  if (!text || selectionStart < 0 || selectionEnd < 0 || selectionStart > text.length || selectionEnd > text.length)
    return null;

  const caretStart = Math.min(selectionStart, selectionEnd);
  const caretEnd = Math.max(selectionStart, selectionEnd);
  let tokenStart = caretStart;
  while (tokenStart > 0 && !isWhitespace(text[tokenStart - 1] ?? " ")) tokenStart -= 1;
  let tokenEnd = caretEnd;
  while (tokenEnd < text.length && !isWhitespace(text[tokenEnd] ?? " ")) tokenEnd += 1;

  const token = text.slice(tokenStart, tokenEnd);
  if (!token) return null;

  const prefix = token[0];
  if (prefix !== "@" && prefix !== ":") return null;
  const previous = tokenStart > 0 ? (text[tokenStart - 1] ?? " ") : " ";
  if (!isWhitespace(previous)) return null;

  if (prefix === "@" && /^@[a-zA-Z0-9._-]*$/.test(token)) {
    return { type: "mention", start: tokenStart, end: tokenEnd, query: text.slice(tokenStart + 1, caretEnd) };
  }
  if (prefix === ":" && /^:[a-zA-Z0-9_+-]*$/.test(token)) {
    return { type: "emoji", start: tokenStart, end: tokenEnd, query: text.slice(tokenStart + 1, caretEnd) };
  }
  return null;
};

// ─── Inline Media Components ─────────────────────────────────────────────────

const LazyMediaLoader = ({
  attachmentId,
  resolveUrl,
  children
}: {
  attachmentId: string;
  resolveUrl?: ((id: string) => Promise<string>) | undefined;
  children: (url: string | null, loading: boolean) => React.ReactNode;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!resolveUrl || loadedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadedRef.current) {
          loadedRef.current = true;
          observer.disconnect();
          setLoading(true);
          resolveUrl(attachmentId)
            .then((blobUrl) => setUrl(blobUrl))
            .catch(() => setUrl(null))
            .finally(() => setLoading(false));
        }
      },
      { rootMargin: "200px" }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [attachmentId, resolveUrl]);

  return <div ref={containerRef}>{children(url, loading)}</div>;
};

const MediaSkeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className ?? "h-48 w-64"}`} />
);

const ChatImageAttachment = ({
  attachment,
  resolveUrl,
  onPreview,
  isMine
}: {
  attachment: ChatAttachment;
  resolveUrl?: ((id: string) => Promise<string>) | undefined;
  onPreview?: (() => void) | undefined;
  isMine: boolean;
}) => (
  <LazyMediaLoader attachmentId={attachment.id} resolveUrl={resolveUrl}>
    {(url, loading) => {
      if (loading) return <MediaSkeleton className="h-48 w-full max-w-[280px]" />;
      if (!url) {
        return (
          <button
            type="button"
            onClick={onPreview}
            className="flex h-32 w-full max-w-[280px] items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500 hover:bg-slate-200"
          >
            Cargar imagen
          </button>
        );
      }
      return (
        <button type="button" onClick={onPreview} className="group relative block overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.name}
            className="max-h-[300px] max-w-[280px] rounded-xl object-cover transition group-hover:brightness-90"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100">
            <span className="rounded-full bg-black/50 p-2 text-white">🔍</span>
          </span>
        </button>
      );
    }}
  </LazyMediaLoader>
);

const ChatVideoAttachment = ({
  attachment,
  resolveUrl,
  onPreview,
  isMine
}: {
  attachment: ChatAttachment;
  resolveUrl?: ((id: string) => Promise<string>) | undefined;
  onPreview?: (() => void) | undefined;
  isMine: boolean;
}) => (
  <LazyMediaLoader attachmentId={attachment.id} resolveUrl={resolveUrl}>
    {(url, loading) => {
      if (loading) return <MediaSkeleton className="h-48 w-full max-w-[320px]" />;
      if (!url) {
        return (
          <button
            type="button"
            onClick={onPreview}
            className="flex h-40 w-full max-w-[320px] items-center justify-center rounded-xl bg-slate-900/90 text-white hover:bg-slate-800"
          >
            <span className="flex flex-col items-center gap-1">
              <span className="text-3xl">▶</span>
              <span className="text-xs">{attachment.name}</span>
            </span>
          </button>
        );
      }
      return (
        <button type="button" onClick={onPreview} className="group relative block overflow-hidden rounded-xl">
          <video
            src={url}
            muted
            preload="metadata"
            className="max-h-[250px] max-w-[320px] rounded-xl bg-black object-cover"
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              vid.currentTime = Math.min(1, vid.duration * 0.1);
            }}
          />
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-2xl text-slate-900 shadow-lg transition group-hover:scale-110">
              ▶
            </span>
          </span>
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {formatFileSize(attachment.sizeBytes)}
          </span>
        </button>
      );
    }}
  </LazyMediaLoader>
);

const ChatAudioAttachment = ({
  attachment,
  resolveUrl,
  isMine
}: {
  attachment: ChatAttachment;
  resolveUrl?: ((id: string) => Promise<string>) | undefined;
  isMine: boolean;
}) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <LazyMediaLoader attachmentId={attachment.id} resolveUrl={resolveUrl}>
      {(url, loading) => {
        if (loading) return <MediaSkeleton className="h-14 w-64" />;
        if (!url) {
          return (
            <div className="flex h-14 w-64 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
              Audio no disponible
            </div>
          );
        }
        return (
          <div className={`flex w-64 items-center gap-3 rounded-xl p-2 ${isMine ? "bg-[#c5f0c0]" : "bg-slate-50"}`}>
            <audio
              ref={audioRef}
              src={url}
              preload="metadata"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
                setProgress(duration > 0 ? (e.currentTarget.currentTime / duration) * 100 : 0);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
            />
            <button
              type="button"
              onClick={togglePlay}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${isMine ? "bg-[#128c7e]" : "bg-[#128c7e]"}`}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className="relative h-[6px] cursor-pointer rounded-full bg-slate-300"
                onClick={handleSeek}
                role="progressbar"
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-[#128c7e] transition-all"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#128c7e] shadow"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#667781]">
                <span>{formatSeconds(currentTime)}</span>
                <span>{duration > 0 ? formatSeconds(duration) : "--:--"}</span>
              </div>
            </div>
          </div>
        );
      }}
    </LazyMediaLoader>
  );
};

const ChatPdfAttachment = ({
  attachment,
  onPreview,
  onDownload
}: {
  attachment: ChatAttachment;
  onPreview?: (() => void) | undefined;
  onDownload?: (() => void) | undefined;
}) => (
  <button
    type="button"
    onClick={onPreview}
    className="group flex w-64 items-center gap-3 rounded-xl border border-[#e4e9f0] bg-white/90 p-3 transition hover:bg-slate-50"
  >
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-xl text-red-600">
      PDF
    </span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-xs font-semibold text-[#111b21]">{attachment.name}</span>
      <span className="block text-[10px] text-[#667781]">
        {formatFileSize(attachment.sizeBytes)} · Documento PDF
      </span>
    </span>
    <span className="shrink-0 text-[#667781] opacity-0 transition group-hover:opacity-100">⬇</span>
  </button>
);

const ChatGenericAttachment = ({
  attachment,
  onDownload
}: {
  attachment: ChatAttachment;
  onDownload?: (() => void) | undefined;
}) => {
  const ext = attachment.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return (
    <button
      type="button"
      onClick={onDownload}
      className="group flex w-64 items-center gap-3 rounded-xl border border-[#e4e9f0] bg-white/90 p-3 transition hover:bg-slate-50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-600">
        {ext.slice(0, 4)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-xs font-semibold text-[#111b21]">{attachment.name}</span>
        <span className="block text-[10px] text-[#667781]">{formatFileSize(attachment.sizeBytes)}</span>
      </span>
      <span className="shrink-0 text-lg text-[#667781] opacity-60 transition group-hover:opacity-100">⬇</span>
    </button>
  );
};

const ChatAttachmentRenderer = ({
  attachment,
  isMine,
  resolveUrl,
  onPreview,
  onDownload
}: {
  attachment: ChatAttachment;
  isMine: boolean;
  resolveUrl?: ((id: string) => Promise<string>) | undefined;
  onPreview?: (() => void) | undefined;
  onDownload?: (() => void) | undefined;
}) => {
  const category = getAttachmentCategory(attachment);

  switch (category) {
    case "image":
      return <ChatImageAttachment attachment={attachment} resolveUrl={resolveUrl} onPreview={onPreview} isMine={isMine} />;
    case "video":
      return <ChatVideoAttachment attachment={attachment} resolveUrl={resolveUrl} onPreview={onPreview} isMine={isMine} />;
    case "audio":
      return <ChatAudioAttachment attachment={attachment} resolveUrl={resolveUrl} isMine={isMine} />;
    case "pdf":
      return <ChatPdfAttachment attachment={attachment} onPreview={onPreview} onDownload={onDownload} />;
    default:
      return <ChatGenericAttachment attachment={attachment} onDownload={onDownload} />;
  }
};

// ─── Upload Progress Components ──────────────────────────────────────────────

const UploadProgressBubble = ({ progress }: { progress: UploadProgress }) => {
  const label =
    progress.status === "compressing"
      ? "Comprimiendo..."
      : progress.status === "uploading"
        ? `Subiendo ${Math.round(progress.progress)}%`
        : progress.status === "error"
          ? progress.errorMessage ?? "Error al subir"
          : "Enviado";

  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/80 p-2">
      {progress.status === "error" ? (
        <span className="text-xs text-red-600">{label}</span>
      ) : (
        <>
          <div className="h-1.5 flex-1 rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#25d366] transition-all"
              style={{ width: `${progress.status === "done" ? 100 : progress.progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] text-[#667781]">{label}</span>
        </>
      )}
    </div>
  );
};

// ─── Pending Files Preview ───────────────────────────────────────────────────

const PendingFilePreview = ({
  pendingFiles,
  uploadProgress,
  onRemove,
  onConfirm,
  onRetry
}: {
  pendingFiles: PendingFile[];
  uploadProgress: UploadProgress[];
  onRemove?: ((fileId: string) => void) | undefined;
  onConfirm?: (() => void) | undefined;
  onRetry?: ((fileId: string) => void) | undefined;
}) => {
  if (pendingFiles.length === 0) return null;

  const progressMap = new Map(uploadProgress.map((p) => [p.fileId, p]));
  const anyUploading = uploadProgress.some((p) => p.status === "uploading" || p.status === "compressing");

  return (
    <div className="border-t border-[#e4e9f0] bg-[#f0f2f5] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#667781]">
          {pendingFiles.length} archivo{pendingFiles.length > 1 ? "s" : ""} seleccionado{pendingFiles.length > 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pendingFiles.forEach((f) => onRemove?.(f.id))}
            disabled={anyUploading}
            className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={anyUploading}
            className="rounded-lg bg-[#25d366] px-3 py-1 text-xs font-semibold text-white hover:bg-[#128c7e] disabled:opacity-50"
          >
            {anyUploading ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {pendingFiles.map((pf) => {
          const prog = progressMap.get(pf.id);
          return (
            <div key={pf.id} className="relative shrink-0">
              {pf.type === "image" && pf.previewUrl ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-[#e4e9f0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pf.previewUrl} alt={pf.file.name} className="h-full w-full object-cover" />
                  {prog && prog.status !== "done" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-xs font-bold text-white">
                        {prog.status === "error" ? "!" : `${Math.round(prog.progress)}%`}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : pf.type === "video" ? (
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[#e4e9f0] bg-slate-900">
                  {pf.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pf.previewUrl} alt={pf.file.name} className="h-full w-full object-cover opacity-70" />
                  ) : null}
                  <span className="absolute text-2xl text-white">▶</span>
                  {prog && prog.status !== "done" ? (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
                      <div className="h-full bg-[#25d366]" style={{ width: `${prog.progress}%` }} />
                    </div>
                  ) : null}
                </div>
              ) : pf.type === "audio" ? (
                <div className="flex h-20 w-28 flex-col items-center justify-center rounded-xl border border-[#e4e9f0] bg-slate-50 px-2">
                  <span className="text-2xl">🎵</span>
                  <span className="mt-1 w-full truncate text-center text-[9px] text-slate-600">{pf.file.name}</span>
                  {prog && prog.status !== "done" ? (
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-[#25d366]" style={{ width: `${prog.progress}%` }} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-20 w-28 flex-col items-center justify-center rounded-xl border border-[#e4e9f0] bg-white px-2">
                  <span className="text-lg">{pf.type === "pdf" ? "📕" : "📄"}</span>
                  <span className="mt-1 w-full truncate text-center text-[9px] text-slate-700">{pf.file.name}</span>
                  <span className="text-[9px] text-slate-500">{formatFileSize(pf.file.size)}</span>
                </div>
              )}
              {!prog || prog.status === "error" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (prog?.status === "error") {
                      onRetry?.(pf.id);
                    } else {
                      onRemove?.(pf.id);
                    }
                  }}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white shadow hover:bg-red-600"
                >
                  {prog?.status === "error" ? "↻" : "✕"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const MessagingModule = ({
  conversations,
  activeConversation,
  messages,
  teamMembers,
  typingUsers = [],
  onSendMessage,
  onSelectConversation,
  onUploadFile,
  onPreviewAttachment,
  onDownloadAttachment,
  onComposerChange,
  currentUser,
  onOpenNewChat,
  onStartCall,
  actionError = null,
  pendingFiles = [],
  uploadProgress = [],
  onRemovePendingFile,
  onConfirmSendFiles,
  onRetryUpload,
  resolveAttachmentUrl
}: MessagingModuleProps) => {
  const [conversationFilter, setConversationFilter] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [composerSelection, setComposerSelection] = useState({ start: 0, end: 0 });
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [dismissedTokenSignature, setDismissedTokenSignature] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "team">("list");

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const filteredConversations = useMemo(() => {
    const needle = conversationFilter.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.lastMessage.toLowerCase().includes(needle)
    );
  }, [conversationFilter, conversations]);

  const mentionsByHandle = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const member of teamMembers) {
      const baseHandle = normalizeHandle(member.name.split(/\s+/)[0] ?? member.name);
      if (baseHandle && !map.has(baseHandle)) map.set(baseHandle, member);
    }
    return map;
  }, [teamMembers]);

  const activeToken = useMemo(
    () => getActiveComposerToken(composerValue, composerSelection.start, composerSelection.end),
    [composerSelection.end, composerSelection.start, composerValue]
  );
  const tokenSignature = activeToken
    ? `${activeToken.type}:${activeToken.start}:${activeToken.end}:${activeToken.query}`
    : null;

  const mentionQuery = activeToken?.type === "mention" ? activeToken.query : null;
  const emojiQuery = activeToken?.type === "emoji" ? activeToken.query : null;

  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const normalized = normalizeHandle(mentionQuery);
    return teamMembers
      .filter((m) => !normalized || normalizeHandle(m.name).includes(normalized))
      .slice(0, 6);
  }, [mentionQuery, teamMembers]);

  const emojiOptions = useMemo(() => buildEmojiOptions(), []);
  const emojiAutocompleteOptions = useMemo(() => {
    if (emojiQuery === null) return [];
    const normalized = emojiQuery.trim().toLowerCase();
    return emojiOptions
      .filter(
        (e) =>
          !normalized ||
          e.id.includes(normalized) ||
          e.name.toLowerCase().includes(normalized) ||
          e.keywords.some((k) => k.toLowerCase().includes(normalized))
      )
      .slice(0, 8);
  }, [emojiOptions, emojiQuery]);

  const showMentionDropdown =
    mentionQuery !== null && mentionOptions.length > 0 && tokenSignature !== dismissedTokenSignature;
  const showEmojiAutocomplete =
    !showMentionDropdown &&
    emojiQuery !== null &&
    emojiAutocompleteOptions.length > 0 &&
    tokenSignature !== dismissedTokenSignature;

  useEffect(() => { setDropdownIndex(0); }, [mentionQuery, emojiQuery]);
  useEffect(() => {
    if (!tokenSignature) { setDismissedTokenSignature(null); return; }
    if (dismissedTokenSignature && dismissedTokenSignature !== tokenSignature) setDismissedTokenSignature(null);
  }, [dismissedTokenSignature, tokenSignature]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | PointerEvent | TouchEvent) => {
      const target = event.target as Node;
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) setEmojiPickerOpen(false);
    };
    if (!emojiPickerOpen) return;
    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("touchstart", handleClickOutside);
    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
      window.removeEventListener("touchstart", handleClickOutside);
    };
  }, [emojiPickerOpen]);

  const insertAtCursor = (text: string) => {
    const textarea = composerRef.current;
    if (!textarea) {
      setComposerValue((c) => `${c}${text}`);
      setComposerSelection((c) => ({ start: c.start + text.length, end: c.start + text.length }));
      return;
    }
    const start = textarea.selectionStart ?? composerValue.length;
    const end = textarea.selectionEnd ?? composerValue.length;
    setComposerValue((c) => `${c.slice(0, start)}${text}${c.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + text.length;
      textarea.setSelectionRange(cursor, cursor);
      setComposerSelection({ start: cursor, end: cursor });
    });
  };

  const insertEmoji = (native: string) => { if (native) insertAtCursor(native); };

  const replaceActiveToken = (replacement: string) => {
    if (!activeToken) { insertAtCursor(replacement); return; }
    const nextValue = composerValue.slice(0, activeToken.start) + replacement + composerValue.slice(activeToken.end);
    const cursor = activeToken.start + replacement.length;
    setComposerValue(nextValue);
    setDismissedTokenSignature(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(cursor, cursor);
      setComposerSelection({ start: cursor, end: cursor });
    });
  };

  const handleInsertMention = (member: TeamMember) => {
    const handle = normalizeHandle(member.name.split(/\s+/)[0] ?? member.name);
    if (handle) replaceActiveToken(`@${handle} `);
  };

  const handleInsertEmojiAutocomplete = (emoji: EmojiOption) => replaceActiveToken(`${emoji.native} `);

  const handleSend = () => {
    const content = composerValue.trim();
    if (!content) return;
    const mentionIds = [...content.matchAll(/@([a-zA-Z0-9._-]+)/g)]
      .map((m) => mentionsByHandle.get(normalizeHandle(m[1] ?? ""))?.id ?? null)
      .filter((item): item is string => Boolean(item));
    void onSendMessage({ content, mentions: [...new Set(mentionIds)] });
    setComposerValue("");
    setComposerSelection({ start: 0, end: 0 });
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown) {
      if (event.key === "ArrowDown") { event.preventDefault(); setDropdownIndex((c) => (c + 1) % mentionOptions.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setDropdownIndex((c) => (c - 1 + mentionOptions.length) % mentionOptions.length); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); const m = mentionOptions[dropdownIndex] ?? mentionOptions[0]; if (m) handleInsertMention(m); return; }
      if (event.key === "Escape") { event.preventDefault(); if (tokenSignature) setDismissedTokenSignature(tokenSignature); return; }
    }
    if (showEmojiAutocomplete) {
      if (event.key === "ArrowDown") { event.preventDefault(); setDropdownIndex((c) => (c + 1) % emojiAutocompleteOptions.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setDropdownIndex((c) => (c - 1 + emojiAutocompleteOptions.length) % emojiAutocompleteOptions.length); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); const e = emojiAutocompleteOptions[dropdownIndex] ?? emojiAutocompleteOptions[0]; if (e) handleInsertEmojiAutocomplete(e); return; }
      if (event.key === "Escape") { event.preventDefault(); if (tokenSignature) setDismissedTokenSignature(tokenSignature); return; }
    }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSend(); }
  };

  const handleUploadInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    void onUploadFile(file);
    event.target.value = "";
  };

  return (
    <section
      className={`${plusJakartaSans.className} h-full w-full overflow-hidden bg-[#f0f2f5] text-[#111b21]`}
      style={{ scrollbarWidth: "thin" }}
    >
      <div className="h-full w-full overflow-hidden bg-white md:grid md:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* ─── Conversations Panel ──────────────────────────── */}
        <aside className={`${mobileView === "list" ? "flex" : "hidden"} md:flex h-full flex-col border-r border-[#e4e9f0] bg-white`}>
          <header className="flex items-center justify-between border-b border-[#e4e9f0] px-4 py-3">
            <h2 className="text-base font-semibold">Mensajes</h2>
            <button
              type="button"
              onClick={() => onOpenNewChat?.()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e9f0] text-[#667781] hover:bg-[#f0f2f5]"
            >
              +
            </button>
          </header>
          <div className="border-b border-[#e4e9f0] p-3">
            <input
              value={conversationFilter}
              onChange={(e) => setConversationFilter(e.target.value)}
              placeholder="Buscar conversación..."
              className="h-10 w-full rounded-xl border border-[#e4e9f0] bg-[#f0f2f5] px-3 text-sm outline-none focus:border-[#25d366]"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conversation) => {
              const active = conversation.id === activeConversation?.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => { onSelectConversation(conversation.id); setMobileView("chat"); }}
                  className={`w-full border-b border-[#f4f6f9] px-4 py-3 text-left ${active ? "bg-[#e9f8ef]" : "hover:bg-[#f7f9fb]"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-11 w-11 shrink-0 rounded-full bg-[#128c7e] text-center text-sm font-bold leading-[2.75rem] text-white">
                      {initialsFromName(conversation.name)}
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${conversation.isOnline ? "bg-[#25d366]" : "bg-slate-300"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{conversation.name}</p>
                        <span className="shrink-0 text-[11px] text-[#667781]">{formatTime(conversation.lastMessageAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-[#667781]">{conversation.lastMessage}</p>
                        {conversation.unreadCount ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1 text-[11px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ─── Chat Panel ───────────────────────────────────── */}
        <main className={`${mobileView === "chat" ? "flex" : "hidden"} md:flex relative h-full flex-col overflow-hidden bg-[#eae6df]`}>
          <header className="z-10 flex items-center justify-between border-b border-[#e4e9f0] bg-white px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => setMobileView("list")} className="mr-1 shrink-0 rounded-full p-1.5 text-[#667781] hover:bg-[#f0f2f5] md:hidden">←</button>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{activeConversation?.name ?? "Selecciona una conversación"}</h3>
                <p className="truncate text-xs text-[#667781]">Canal activo</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-full p-2 text-[#667781] hover:bg-[#f0f2f5]">📞</button>
              <button type="button" onClick={() => onStartCall?.()} disabled={!activeConversation} className="rounded-full p-2 text-[#667781] hover:bg-[#f0f2f5] disabled:cursor-not-allowed disabled:opacity-40">🎥</button>
              <button type="button" onClick={() => setMobileView("team")} className="rounded-full p-2 text-[#667781] hover:bg-[#f0f2f5] md:hidden">👥</button>
              <button type="button" className="hidden rounded-full p-2 text-[#667781] hover:bg-[#f0f2f5] md:block">⋯</button>
            </div>
          </header>

          {/* Messages Area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              backgroundImage: "radial-gradient(rgba(17, 27, 33, 0.08) 1px, transparent 1px)",
              backgroundSize: "18px 18px"
            }}
          >
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#667781]">
                No hay mensajes en esta conversación.
              </div>
            ) : null}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const showDateDivider = !previous || formatDate(previous.createdAt) !== formatDate(message.createdAt);
              const isMine = message.senderId === currentUser.id;

              return (
                <div key={message.id} className="mb-2">
                  {showDateDivider ? (
                    <div className="mb-3 text-center">
                      <span className="inline-flex rounded-lg bg-white/80 px-3 py-1 text-[11px] text-[#667781] shadow-sm">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <article
                      className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                        isMine ? "rounded-br-md bg-[#d9fdd3]" : "rounded-bl-md border border-[#e4e9f0] bg-white"
                      }`}
                    >
                      {!isMine ? (
                        <p className="mb-1 text-[11px] font-semibold text-[#128c7e]">{message.senderName}</p>
                      ) : null}

                      {/* Inline Media Attachments */}
                      {message.kind === "FILE" && (message.attachments?.length ?? 0) > 0 ? (
                        <div className="mb-1 space-y-1.5">
                          {message.attachments?.map((attachment) => (
                            <ChatAttachmentRenderer
                              key={attachment.id}
                              attachment={attachment}
                              isMine={isMine}
                              resolveUrl={resolveAttachmentUrl}
                              onPreview={() =>
                                onPreviewAttachment?.(attachment.id, attachment.name, attachment.mimeType)
                              }
                              onDownload={() => onDownloadAttachment?.(attachment.id, attachment.name)}
                            />
                          ))}
                        </div>
                      ) : null}

                      {message.content && !(message.kind === "FILE" && (message.attachments?.length ?? 0) > 0) ? (
                        <p className="whitespace-pre-wrap break-words text-sm">{mentionNodes(message.content)}</p>
                      ) : null}

                      {message.kind === "CALL_INVITE" ? (
                        message.callExpired ? (
                          <span className="mt-2 inline-flex rounded-full bg-slate-300 px-3 py-1 text-xs font-semibold text-slate-700">
                            Llamada vencida
                          </span>
                        ) : message.meetingUrl ? (
                          <a
                            href={message.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex rounded-full bg-[#128c7e] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f6f66]"
                          >
                            Unirme a llamada
                          </a>
                        ) : null
                      ) : null}

                      <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                        <span>{formatTime(message.createdAt)}</span>
                        {isMine ? <span className="text-[#53bdeb]">✓✓</span> : null}
                      </div>
                    </article>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {typingUsers.length > 0 ? (
            <div className="flex items-center gap-2 border-t border-[#e4e9f0] bg-[#f0f2f5] px-4 py-1.5">
              <span className="flex items-center gap-[3px]">
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#667781]" style={{ animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: "0s" }} />
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#667781]" style={{ animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: "0.2s" }} />
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#667781]" style={{ animation: "typingBounce 1.4s infinite ease-in-out", animationDelay: "0.4s" }} />
              </span>
              <span className="text-xs text-[#667781]">
                {typingUsers.length === 1
                  ? `${typingUsers[0]!.userName} está escribiendo`
                  : typingUsers.length === 2
                    ? `${typingUsers[0]!.userName} y ${typingUsers[1]!.userName} están escribiendo`
                    : `${typingUsers[0]!.userName} y ${typingUsers.length - 1} más están escribiendo`}
              </span>
            </div>
          ) : null}

          {/* Pending Files Preview */}
          <PendingFilePreview
            pendingFiles={pendingFiles}
            uploadProgress={uploadProgress}
            onRemove={onRemovePendingFile}
            onConfirm={onConfirmSendFiles}
            onRetry={onRetryUpload}
          />

          {/* Composer Footer */}
          <footer className="border-t border-[#e4e9f0] bg-white px-3 py-3">
            <div className="relative">
              <div className="flex items-end gap-2">
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setEmojiPickerOpen((c) => !c)}
                    className="rounded-full p-2 text-[#667781] hover:bg-[#f0f2f5]"
                    aria-label="Abrir selector de emojis"
                  >
                    😀
                  </button>
                  {emojiPickerOpen ? (
                    <div className="absolute bottom-[110%] left-0 z-30 overflow-hidden rounded-2xl border border-[#e4e9f0] bg-white shadow-xl">
                      <Picker
                        data={emojiData}
                        onEmojiSelect={(emoji: { native?: string }) => { insertEmoji(emoji.native ?? ""); setEmojiPickerOpen(false); }}
                        locale="es"
                        theme="light"
                        previewPosition="none"
                        perLine={8}
                        maxFrequentRows={2}
                        skinTonePosition="none"
                      />
                    </div>
                  ) : null}
                </div>
                <label className="rounded-full p-2 text-[#667781] hover:bg-[#f0f2f5] cursor-pointer">
                  📎
                  <input type="file" className="hidden" onChange={handleUploadInput} />
                </label>
                <div className="relative flex-1 rounded-2xl border border-[#e4e9f0] bg-[#f0f2f5] px-3 py-2">
                  <textarea
                    ref={composerRef}
                    value={composerValue}
                    onChange={(e) => {
                      setComposerValue(e.target.value);
                      setComposerSelection({ start: e.target.selectionStart ?? e.target.value.length, end: e.target.selectionEnd ?? e.target.value.length });
                      onComposerChange?.(e.target.value);
                    }}
                    onSelect={(e) => setComposerSelection({ start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 })}
                    onClick={(e) => setComposerSelection({ start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 })}
                    onKeyUp={(e) => setComposerSelection({ start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 })}
                    onKeyDown={handleComposerKeyDown}
                    rows={2}
                    placeholder="Escribe un mensaje..."
                    className="w-full resize-none bg-transparent text-sm outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25d366] text-white hover:bg-[#128c7e]"
                >
                  ➤
                </button>
              </div>

              {showMentionDropdown ? (
                <div className="absolute bottom-[105%] left-0 right-0 rounded-xl border border-[#e4e9f0] bg-white p-2 shadow-lg sm:left-12 sm:right-14">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#667781]">Mencionar usuario</p>
                  <ul className="space-y-1">
                    {mentionOptions.map((member, index) => (
                      <li key={member.id}>
                        <button
                          type="button"
                          onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => { event.preventDefault(); handleInsertMention(member); }}
                          className={`w-full rounded-lg px-2 py-1 text-left text-sm ${index === dropdownIndex ? "bg-[#e9f8ef]" : "hover:bg-[#f0f2f5]"}`}
                        >
                          @{normalizeHandle(member.name.split(/\s+/)[0] ?? member.name)} · {member.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showEmojiAutocomplete ? (
                <div className="absolute bottom-[105%] left-0 right-0 rounded-xl border border-[#e4e9f0] bg-white p-2 shadow-lg sm:left-12 sm:right-14">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#667781]">Emoji</p>
                  <ul className="space-y-1">
                    {emojiAutocompleteOptions.map((emoji, index) => (
                      <li key={emoji.id}>
                        <button
                          type="button"
                          onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) => { event.preventDefault(); handleInsertEmojiAutocomplete(emoji); }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${index === dropdownIndex ? "bg-[#e9f8ef]" : "hover:bg-[#f0f2f5]"}`}
                        >
                          <span className="text-lg leading-none">{emoji.native}</span>
                          <span className="truncate">:{emoji.id}:</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {actionError ? <p className="mt-2 text-xs text-red-600">{actionError}</p> : null}
          </footer>
        </main>

        {/* ─── Team Panel ───────────────────────────────────── */}
        <aside className={`${mobileView === "team" ? "flex" : "hidden"} md:flex h-full flex-col border-l border-[#e4e9f0] bg-white`}>
          <header className="flex items-center gap-2 border-b border-[#e4e9f0] px-4 py-3">
            <button type="button" onClick={() => setMobileView("chat")} className="shrink-0 rounded-full p-1.5 text-[#667781] hover:bg-[#f0f2f5] md:hidden">←</button>
            <h4 className="text-sm font-semibold">Equipo</h4>
          </header>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {teamMembers.length === 0 ? (
              <p className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] px-3 py-2 text-xs text-[#667781]">
                Sin participantes disponibles en este canal.
              </p>
            ) : null}
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <article key={member.id} className="rounded-xl border border-[#e4e9f0] bg-[#f9fbfd] p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="h-9 w-9 rounded-full bg-[#128c7e] text-center text-xs font-semibold leading-9 text-white">
                      {initialsFromName(member.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{member.name}</p>
                      <p className="truncate text-[11px] text-[#667781]">{member.role}</p>
                      <p className="text-[11px] text-[#667781]">
                        Tareas activas: {(member.activeTasks ?? 0).toLocaleString("es-ES")}
                      </p>
                    </div>
                  </div>
                  {member.status ? (
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(member.status)}`}>
                      {statusLabel[member.status]}
                    </span>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
