"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel, Message, MessagingConversationsResponse } from "@corelia/types";
import type { TypingUser, PendingFile, UploadProgress } from "@/components/messaging-module";
import { apiRequest, getApiBaseUrl, getAuthToken, useAuthStore } from "@/lib/api";
import { buildMaskedCallRoute } from "@/lib/call-route-ref";
import { getContextFromSearchParams } from "@/lib/context";
import { useFrontendSettings } from "@/lib/frontend-settings";
import { getRealtimeSocket, disconnectRealtimeSocket } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { MessagingModule } from "@/components/messaging-module";
import { UiModal } from "@/components/ui-modal";

type DirectoryUser = {
  userId: string;
  fullName: string;
  activeRole: string;
  presence?: "EN_LINEA" | "DESCONECTADO" | "EN_REUNION";
  teamName: string | null;
  contact: {
    email: string;
  };
};

type ProjectMember = {
  userId: string;
  fullName: string;
  availability: "DISPONIBLE" | "OCUPADO" | "EN_REUNION" | "AUSENTE";
  activeTasks: number;
  role: string;
};

type AttachmentPreviewTarget = {
  id: string;
  name: string;
  mimeType: string | null;
};

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_QUALITY = 0.8;

const getFileCategory = (file: File): PendingFile["type"] => {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi)$/i.test(name)) return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return "audio";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "other";
};

const compressImage = (file: File): Promise<File> =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        resolve(file);
        return;
      }
      const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
        },
        file.type,
        IMAGE_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

const generateVideoThumbnail = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.muted = true;
    video.preload = "metadata";
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 320);
      canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbUrl = canvas.toDataURL("image/jpeg", 0.6);
      URL.revokeObjectURL(url);
      resolve(thumbUrl);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });

const uploadFileWithProgress = (
  channelId: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<Message> =>
  new Promise((resolve, reject) => {
    const token = getAuthToken();
    if (!token) { reject(new Error("Sin sesion")); return; }

    const formData = new FormData();
    formData.append("channelId", channelId);
    formData.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBaseUrl()}/messaging/messages/file`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Respuesta invalida del servidor")); }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body.message ?? `Error ${xhr.status}`));
        } catch {
          reject(new Error(`Error ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Error de red al subir archivo"));
    xhr.send(formData);
  });

const downloadAttachment = async (attachmentId: string, fileName: string) => {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(
    `${getApiBaseUrl()}/messaging/attachments/${encodeURIComponent(attachmentId)}/content?mode=attachment`,
    { headers }
  );

  if (!response.ok) {
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const previewText = (message: { content: string; kind: Message["kind"] }) => {
  if (message.kind === "CALL_INVITE") {
    return "Invitación de videollamada";
  }
  if (message.kind === "FILE") {
    return message.content || "Archivo compartido";
  }
  return message.content;
};

const isImageMime = (mimeType: string | null | undefined) =>
  (mimeType ?? "").toLowerCase().startsWith("image/");

const isVideoFile = (input: { mimeType: string | null | undefined; fileName: string }) => {
  const mime = (input.mimeType ?? "").toLowerCase().trim();
  if (mime.startsWith("video/")) {
    return true;
  }

  const name = input.fileName.toLowerCase();
  return (
    name.endsWith(".mp4") ||
    name.endsWith(".webm") ||
    name.endsWith(".mov") ||
    name.endsWith(".m4v")
  );
};

const isAudioFile = (input: { mimeType: string | null | undefined; fileName: string }) => {
  const mime = (input.mimeType ?? "").toLowerCase().trim();
  if (mime.startsWith("audio/")) {
    return true;
  }

  const name = input.fileName.toLowerCase();
  return (
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".ogg") ||
    name.endsWith(".m4a")
  );
};

const isPdfFile = (input: { mimeType: string | null | undefined; fileName: string }) => {
  const mime = (input.mimeType ?? "").toLowerCase().trim();
  return mime === "application/pdf" || input.fileName.toLowerCase().endsWith(".pdf");
};

const isInstantCallInviteExpired = (createdAt: string, expiryHours: number) => {
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  const expiryMs = Math.max(1, expiryHours) * 60 * 60 * 1000;
  return Date.now() >= createdAtMs + expiryMs;
};

export const MessagingBoard = () => {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const session = useSession();
  const { settings: frontendSettings } = useFrontendSettings();
  const params = useSearchParams();
  const dashboardContext = useMemo(() => getContextFromSearchParams(params), [params]);
  const ensuredProjectRef = useRef<string | null>(null);

  const requestedProjectId = dashboardContext.projectId;
  const requestedChannelId = params.get("channelId");

  const [activeChannelId, setActiveChannelId] = useState("");
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [privateSearch, setPrivateSearch] = useState("");
  const [privateTargetUserId, setPrivateTargetUserId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentPreviewTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const blobCacheRef = useRef(new Map<string, string>());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const clearPreviewUrl = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const closePreview = useCallback(() => {
    setPreviewAttachment(null);
    setPreviewLoading(false);
    setPreviewError(null);
    clearPreviewUrl();
  }, [clearPreviewUrl]);

  useEffect(() => {
    return () => {
      clearPreviewUrl();
      for (const url of blobCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobCacheRef.current.clear();
      for (const pf of pendingFiles) {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearPreviewUrl]);

  const resolveAttachmentUrl = useCallback(async (attachmentId: string): Promise<string> => {
    const cached = blobCacheRef.current.get(attachmentId);
    if (cached) return cached;

    const authToken = getAuthToken();
    if (!authToken) throw new Error("Sin sesion");

    const response = await fetch(
      `${getApiBaseUrl()}/messaging/attachments/${encodeURIComponent(attachmentId)}/content?mode=inline`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    if (!response.ok) throw new Error("No se pudo cargar el adjunto");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    blobCacheRef.current.set(attachmentId, url);
    return url;
  }, []);

  const handleAddPendingFiles = useCallback(async (files: File[]) => {
    const newPending: PendingFile[] = [];
    for (const file of files) {
      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const type = getFileCategory(file);
      let previewUrl: string | null = null;

      if (type === "image") {
        previewUrl = URL.createObjectURL(file);
      } else if (type === "video") {
        previewUrl = await generateVideoThumbnail(file);
      }

      newPending.push({ id, file, previewUrl, type });
    }
    setPendingFiles((current) => [...current, ...newPending]);
  }, []);

  const handleRemovePendingFile = useCallback((fileId: string) => {
    setPendingFiles((current) => {
      const removed = current.find((f) => f.id === fileId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((f) => f.id !== fileId);
    });
    setUploadProgress((current) => current.filter((p) => p.fileId !== fileId));
  }, []);

  const handleConfirmSendFiles = useCallback(async () => {
    if (!activeChannelId || pendingFiles.length === 0) return;

    const filesToSend = [...pendingFiles];
    const progressEntries: UploadProgress[] = filesToSend.map((pf) => ({
      fileId: pf.id,
      progress: 0,
      status: pf.type === "image" ? "compressing" : "uploading"
    }));
    setUploadProgress(progressEntries);

    for (const pf of filesToSend) {
      try {
        let fileToUpload = pf.file;

        if (pf.type === "image") {
          setUploadProgress((prev) =>
            prev.map((p) => (p.fileId === pf.id ? { ...p, status: "compressing", progress: 0 } : p))
          );
          fileToUpload = await compressImage(pf.file);
          setUploadProgress((prev) =>
            prev.map((p) => (p.fileId === pf.id ? { ...p, status: "uploading", progress: 0 } : p))
          );
        }

        await uploadFileWithProgress(activeChannelId, fileToUpload, (pct) => {
          setUploadProgress((prev) =>
            prev.map((p) => (p.fileId === pf.id ? { ...p, progress: pct } : p))
          );
        });

        setUploadProgress((prev) =>
          prev.map((p) => (p.fileId === pf.id ? { ...p, status: "done", progress: 100 } : p))
        );
      } catch (error) {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.fileId === pf.id
              ? { ...p, status: "error", errorMessage: error instanceof Error ? error.message : "Error al subir" }
              : p
          )
        );
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["messaging", "messages", activeChannelId] }),
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] })
    ]);

    setPendingFiles((current) => {
      for (const pf of current) {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      }
      return [];
    });

    setTimeout(() => setUploadProgress([]), 2000);
  }, [activeChannelId, pendingFiles, queryClient]);

  const handleRetryUpload = useCallback(async (fileId: string) => {
    const pf = pendingFiles.find((f) => f.id === fileId);
    if (!pf || !activeChannelId) return;

    setUploadProgress((prev) =>
      prev.map((p) => (p.fileId === fileId ? { ...p, status: "uploading", progress: 0, errorMessage: null } : p))
    );

    try {
      let fileToUpload = pf.file;
      if (pf.type === "image") {
        fileToUpload = await compressImage(pf.file);
      }

      await uploadFileWithProgress(activeChannelId, fileToUpload, (pct) => {
        setUploadProgress((prev) =>
          prev.map((p) => (p.fileId === fileId ? { ...p, progress: pct } : p))
        );
      });

      setUploadProgress((prev) =>
        prev.map((p) => (p.fileId === fileId ? { ...p, status: "done", progress: 100 } : p))
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messaging", "messages", activeChannelId] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] })
      ]);
    } catch (error) {
      setUploadProgress((prev) =>
        prev.map((p) =>
          p.fileId === fileId
            ? { ...p, status: "error", errorMessage: error instanceof Error ? error.message : "Error al subir" }
            : p
        )
      );
    }
  }, [activeChannelId, pendingFiles, queryClient]);

  const handlePreviewAttachment = useCallback(
    async (attachmentId: string, fileName: string, mimeType?: string | null) => {
      const authToken = getAuthToken();
      if (!authToken) {
        setActionError("Sesion no valida para previsualizar el adjunto");
        return;
      }

      setActionError(null);
      setPreviewAttachment({
        id: attachmentId,
        name: fileName,
        mimeType: mimeType ?? null
      });
      setPreviewLoading(true);
      setPreviewError(null);
      clearPreviewUrl();

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/messaging/attachments/${encodeURIComponent(attachmentId)}/content?mode=inline`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({
            message: "No se pudo cargar la previsualizacion del adjunto"
          }));
          throw new Error(body.message ?? "No se pudo cargar la previsualizacion del adjunto");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : "Error al previsualizar el adjunto");
      } finally {
        setPreviewLoading(false);
      }
    },
    [clearPreviewUrl]
  );

  const channelsQuery = useQuery({
    queryKey: ["messaging", "channels"],
    queryFn: () => apiRequest<Channel[]>("/messaging/channels"),
    enabled: Boolean(token)
  });

  const conversationsQuery = useQuery({
    queryKey: ["messaging", "conversations"],
    queryFn: () => apiRequest<MessagingConversationsResponse>("/messaging/conversations"),
    enabled: Boolean(token)
  });

  const directoryQuery = useQuery({
    queryKey: ["identity-directory"],
    queryFn: () => apiRequest<DirectoryUser[]>("/identity/directory"),
    enabled: Boolean(token)
  });

  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);

  const previewByChannelId = useMemo(() => {
    const map = new Map<
      string,
      {
        content: string;
        kind: Message["kind"];
        createdAt: string;
      }
    >();

    const source = conversationsQuery.data;
    if (!source) {
      return map;
    }

    for (const item of source.projectItems) {
      if (item.channelId && item.lastMessage) {
        map.set(item.channelId, {
          content: item.lastMessage.content,
          kind: item.lastMessage.kind,
          createdAt: item.lastMessage.createdAt
        });
      }
    }

    for (const item of source.privateItems) {
      if (item.lastMessage) {
        map.set(item.channelId, {
          content: item.lastMessage.content,
          kind: item.lastMessage.kind,
          createdAt: item.lastMessage.createdAt
        });
      }
    }

    return map;
  }, [conversationsQuery.data]);

  const channelItems = useMemo(() => {
    return channels
      .map((channel) => {
        const preview = previewByChannelId.get(channel.id);
        return {
          id: channel.id,
          name: channel.name,
          projectId: channel.projectId,
          lastMessage: preview ? previewText(preview) : "Sin mensajes",
          lastMessageAt: preview?.createdAt ?? channel.createdAt
        };
      })
      .sort((left, right) => {
        return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime();
      });
  }, [channels, previewByChannelId]);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) ?? null,
    [activeChannelId, channels]
  );

  const messagesQuery = useQuery({
    queryKey: ["messaging", "messages", activeChannelId],
    queryFn: () =>
      apiRequest<Message[]>(`/messaging/channels/${encodeURIComponent(activeChannelId)}/messages`),
    enabled: Boolean(activeChannelId)
  });

  const activeProjectId = activeChannel?.projectId ?? null;

  const projectMembersQuery = useQuery({
    queryKey: ["tasks", "project-members", activeProjectId],
    queryFn: () =>
      apiRequest<ProjectMember[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(activeProjectId ?? "")}`
      ),
    enabled: Boolean(activeProjectId)
  });

  const ensureGeneralChannelMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiRequest<Channel>(`/messaging/projects/${projectId}/general-channel/ensure`, {
        method: "POST"
      }),
    onSuccess: async (channel) => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messaging", "channels"] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "messages"] })
      ]);
      setActiveChannelId(channel.id);
    },
    onError: (error) => {
      setActionError(error.message);
    }
  });

  const recoverProjectChannelAccess = (message: string) => {
    const normalized = message.toLowerCase();
    if (!normalized.includes("acceso")) {
      return false;
    }

    if (!activeProjectId || ensureGeneralChannelMutation.isPending) {
      return false;
    }

    setActionError(
      "No tenías acceso al canal actual del proyecto. Se está sincronizando el canal general."
    );
    ensureGeneralChannelMutation.mutate(activeProjectId);
    return true;
  };

  const sendTextMutation = useMutation({
    mutationFn: (payload: { content: string; mentions: string[] }) =>
      apiRequest<Message>("/messaging/messages", {
        method: "POST",
        body: JSON.stringify({
          channelId: activeChannelId,
          content: payload.content,
          mentions: payload.mentions
        })
      }),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messaging", "messages", activeChannelId] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] })
      ]);
    },
    onError: (error) => {
      if (!recoverProjectChannelAccess(error.message)) {
        setActionError(error.message);
      }
    }
  });

  const sendFileMessageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("channelId", activeChannelId);
      formData.append("file", file, file.name);

      return apiRequest<Message>("/messaging/messages/file", {
        method: "POST",
        body: formData
      });
    },
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messaging", "messages", activeChannelId] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] })
      ]);
    },
    onError: (error) => {
      if (!recoverProjectChannelAccess(error.message)) {
        setActionError(error.message);
      }
    }
  });

  const instantCallMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ meetingId: string; joinUrl: string }>(
        `/messaging/channels/${encodeURIComponent(activeChannelId)}/instant-call`,
        { method: "POST" }
      ),
    onSuccess: async (result) => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messaging", "messages", activeChannelId] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] })
      ]);
      window.open(result.joinUrl, "_blank", "noopener,noreferrer");
    },
    onError: (error) => {
      setActionError(error.message);
    }
  });

  const createDirectChannelMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      apiRequest<Channel>("/messaging/channels/direct", {
        method: "POST",
        body: JSON.stringify({ targetUserId })
      }),
    onSuccess: async (channel) => {
      setActionError(null);
      setPrivateModalOpen(false);
      setPrivateSearch("");
      setPrivateTargetUserId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messaging", "channels"] }),
        queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] })
      ]);
      setActiveChannelId(channel.id);
    },
    onError: (error) => {
      setActionError(error.message);
    }
  });

  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const user of directoryQuery.data ?? []) {
      map.set(user.userId, user.fullName);
    }

    if (session.data) {
      map.set(session.data.id, `${session.data.firstName} ${session.data.lastName}`.trim());
    }

    return map;
  }, [directoryQuery.data, session.data]);

  useEffect(() => {
    if (!token || !activeChannelId) {
      return;
    }

    const socket = getRealtimeSocket(token);
    const subscribe = () => {
      socket.emit("subscribe:channel", activeChannelId, () => undefined);
    };

    const onConnect = () => subscribe();
    const onChannelMessage = (message: Message) => {
      if (message.channelId !== activeChannelId) {
        return;
      }

      queryClient.setQueryData<Message[]>(["messaging", "messages", activeChannelId], (current) => {
        const list = current ?? [];
        const deduped = list.filter((item) => item.id !== message.id);
        return [...deduped, message];
      });
      void queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
    };

    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const onChannelTyping = (data: { channelId: string; userId: string; isTyping: boolean }) => {
      if (data.channelId !== activeChannelId) {
        return;
      }

      if (data.isTyping) {
        const userName = authorNameById.get(data.userId) ?? "Usuario";

        setTypingUsers((current) => {
          if (current.some((u) => u.userId === data.userId)) {
            return current;
          }
          return [...current, { userId: data.userId, userName }];
        });

        if (typingTimers.has(data.userId)) {
          clearTimeout(typingTimers.get(data.userId));
        }
        typingTimers.set(
          data.userId,
          setTimeout(() => {
            setTypingUsers((current) => current.filter((u) => u.userId !== data.userId));
            typingTimers.delete(data.userId);
          }, 4000)
        );
      } else {
        setTypingUsers((current) => current.filter((u) => u.userId !== data.userId));
        if (typingTimers.has(data.userId)) {
          clearTimeout(typingTimers.get(data.userId));
          typingTimers.delete(data.userId);
        }
      }
    };

    socket.on("connect", onConnect);
    socket.on("channel:message", onChannelMessage);
    socket.on("channel:typing", onChannelTyping);

    if (socket.connected) {
      subscribe();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("channel:message", onChannelMessage);
      socket.off("channel:typing", onChannelTyping);
      for (const timer of typingTimers.values()) {
        clearTimeout(timer);
      }
      typingTimers.clear();
      setTypingUsers([]);
    };
  }, [activeChannelId, authorNameById, queryClient, token]);

  useEffect(() => {
    if (!token) {
      disconnectRealtimeSocket();
    }
  }, [token]);

  useEffect(() => {
    if (!channels.length) {
      setActiveChannelId("");
      return;
    }

    if (requestedChannelId && channels.some((channel) => channel.id === requestedChannelId)) {
      setActiveChannelId(requestedChannelId);
      return;
    }

    if (activeChannelId && channels.some((channel) => channel.id === activeChannelId)) {
      return;
    }

    setActiveChannelId(channelItems[0]?.id ?? channels[0]?.id ?? "");
  }, [activeChannelId, channelItems, channels, requestedChannelId]);

  useEffect(() => {
    if (!requestedProjectId || !channels.length) {
      return;
    }

    if (ensuredProjectRef.current === requestedProjectId) {
      return;
    }

    const existing = channels.find(
      (channel) => channel.projectId === requestedProjectId && /general/i.test(channel.name)
    );

    if (existing) {
      ensuredProjectRef.current = requestedProjectId;
      setActiveChannelId(existing.id);
      return;
    }

    ensuredProjectRef.current = requestedProjectId;
    ensureGeneralChannelMutation.mutate(requestedProjectId);
  }, [channels, ensureGeneralChannelMutation, requestedProjectId]);

  const handleComposerChange = useCallback(
    (value: string) => {
      if (!token || !activeChannelId) {
        return;
      }

      const socket = getRealtimeSocket(token);

      if (value.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit("channel:typing:start", activeChannelId);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          socket.emit("channel:typing:stop", activeChannelId);
        }
      }, 2000);
    },
    [activeChannelId, token]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && token && activeChannelId) {
        const socket = getRealtimeSocket(token);
        socket.emit("channel:typing:stop", activeChannelId);
        isTypingRef.current = false;
      }
    };
  }, [activeChannelId, token]);

  const mappedMessages = useMemo(() => {
    return (messagesQuery.data ?? []).map((message) => {
      const attachments = message.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        sizeLabel: formatBytes(attachment.sizeBytes)
      }));

      return {
        id: message.id,
        senderId: message.authorId,
        senderName: authorNameById.get(message.authorId) ?? "Usuario",
        content: message.content,
        createdAt: message.createdAt,
        kind: message.kind,
        meetingUrl: message.meetingId
          ? buildMaskedCallRoute({
              meetingId: message.meetingId,
              projectId: activeProjectId
            })
          : null,
        callExpired:
          message.kind === "CALL_INVITE"
            ? isInstantCallInviteExpired(message.createdAt, frontendSettings.instantCallExpiryHours)
            : false,
        attachments
      };
    });
  }, [activeProjectId, authorNameById, frontendSettings.instantCallExpiryHours, messagesQuery.data]);

  const teamMembers = useMemo(() => {
    const presenceById = new Map(
      (directoryQuery.data ?? []).map((user) => [user.userId, user.presence ?? "DESCONECTADO"])
    );
    return (projectMembersQuery.data ?? []).map((member) => ({
      status:
        presenceById.get(member.userId) === "EN_REUNION"
          ? "EN_REUNION"
          : presenceById.get(member.userId) === "DESCONECTADO"
            ? "AUSENTE"
            : member.availability,
      id: member.userId,
      name: member.fullName,
      role: member.role,
      activeTasks: member.activeTasks
    }));
  }, [directoryQuery.data, projectMembersQuery.data]);

  const privateCandidates = useMemo(() => {
    const users = directoryQuery.data ?? [];
    const currentUserId = session.data?.id ?? "";
    const needle = normalize(privateSearch);

    return users.filter((user) => {
      if (user.userId === currentUserId) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return normalize(user.fullName).includes(needle) || normalize(user.contact.email).includes(needle);
    });
  }, [directoryQuery.data, privateSearch, session.data?.id]);

  const selectedPrivateCandidate = useMemo(
    () => privateCandidates.find((candidate) => candidate.userId === privateTargetUserId) ?? null,
    [privateCandidates, privateTargetUserId]
  );

  return (
    <section className="h-full min-h-0 w-full">
      <MessagingModule
        conversations={channelItems.map((item) => ({
          id: item.id,
          name: item.name,
          lastMessage: item.lastMessage,
          lastMessageAt: item.lastMessageAt,
          isOnline: false
        }))}
        activeConversation={
          channelItems.find((item) => item.id === activeChannelId)
            ? {
                id: activeChannelId,
                name: activeChannel?.name ?? "Conversación",
                lastMessage:
                  channelItems.find((item) => item.id === activeChannelId)?.lastMessage ?? "Sin mensajes",
                lastMessageAt: channelItems.find((item) => item.id === activeChannelId)?.lastMessageAt ?? null,
                isOnline: false
              }
            : null
        }
        messages={mappedMessages}
        teamMembers={teamMembers}
        typingUsers={typingUsers}
        actionError={actionError}
        currentUser={{
          id: session.data?.id ?? "",
          name: `${session.data?.firstName ?? ""} ${session.data?.lastName ?? ""}`.trim()
        }}
        onOpenNewChat={() => {
          setActionError(null);
          setPrivateSearch("");
          setPrivateTargetUserId("");
          setPrivateModalOpen(true);
        }}
        onStartCall={() => {
          if (!activeChannelId || instantCallMutation.isPending) {
            return;
          }
          instantCallMutation.mutate();
        }}
        onSelectConversation={(conversationId) => {
          setActionError(null);
          setActiveChannelId(conversationId);
        }}
        onComposerChange={handleComposerChange}
        onSendMessage={(input) => {
          if (!activeChannelId) {
            setActionError("Selecciona una conversación antes de enviar mensajes");
            return;
          }

          if (isTypingRef.current && token) {
            isTypingRef.current = false;
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = null;
            }
            const socket = getRealtimeSocket(token);
            socket.emit("channel:typing:stop", activeChannelId);
          }

          sendTextMutation.mutate({
            content: input.content,
            mentions: input.mentions
          });
        }}
        pendingFiles={pendingFiles}
        uploadProgress={uploadProgress}
        onRemovePendingFile={handleRemovePendingFile}
        onConfirmSendFiles={() => { void handleConfirmSendFiles(); }}
        onRetryUpload={(fileId) => { void handleRetryUpload(fileId); }}
        resolveAttachmentUrl={resolveAttachmentUrl}
        onUploadFile={(file) => {
          if (!activeChannelId) {
            setActionError("Selecciona una conversación antes de adjuntar");
            return;
          }

          if (file.size > MAX_ATTACHMENT_SIZE) {
            setActionError("El archivo supera el límite de 50MB");
            return;
          }

          void handleAddPendingFiles([file]);
        }}
        onDownloadAttachment={(attachmentId, fileName) => {
          void downloadAttachment(attachmentId, fileName);
        }}
        onPreviewAttachment={(attachmentId, fileName, mimeType) => {
          void handlePreviewAttachment(attachmentId, fileName, mimeType);
        }}
      />

      {previewAttachment ? (
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
            aria-label={`Previsualizar ${previewAttachment.name}`}
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">{previewAttachment.name}</h3>
                <p className="text-xs text-slate-500">{previewAttachment.mimeType ?? "Archivo adjunto"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void downloadAttachment(previewAttachment.id, previewAttachment.name);
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
              ) : previewError ? (
                <div className="flex h-96 items-center justify-center px-6">
                  <p className="text-center text-sm text-slate-500">{previewError}</p>
                </div>
              ) : previewUrl ? (
                isImageMime(previewAttachment.mimeType) ? (
                  <div className="flex items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={previewAttachment.name}
                      className="max-h-[75vh] max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : isVideoFile({
                      mimeType: previewAttachment.mimeType,
                      fileName: previewAttachment.name
                    }) ? (
                  <div className="flex items-center justify-center p-4">
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-[75vh] w-full rounded-lg bg-black"
                    >
                      Tu navegador no soporta la etiqueta de video.
                    </video>
                  </div>
                ) : isAudioFile({
                      mimeType: previewAttachment.mimeType,
                      fileName: previewAttachment.name
                    }) ? (
                  <div className="flex h-[40vh] items-center justify-center p-4">
                    <audio src={previewUrl} controls className="w-full max-w-xl">
                      Tu navegador no soporta la etiqueta de audio.
                    </audio>
                  </div>
                ) : isPdfFile({
                      mimeType: previewAttachment.mimeType,
                      fileName: previewAttachment.name
                    }) ? (
                  <iframe
                    src={previewUrl}
                    title={previewAttachment.name}
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

      <UiModal
        open={privateModalOpen}
        onClose={() => {
          if (!createDirectChannelMutation.isPending) {
            setPrivateModalOpen(false);
            setPrivateSearch("");
            setPrivateTargetUserId("");
          }
        }}
        title="Nuevo chat privado"
      >
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Buscar usuario</span>
            <input
              type="text"
              value={privateSearch}
              onChange={(event) => setPrivateSearch(event.target.value)}
              placeholder="Nombre o correo"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selecciona un usuario</p>
            <div className="h-64 overflow-y-auto rounded-xl border border-slate-200">
              {privateCandidates.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">No hay usuarios que coincidan con tu búsqueda.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {privateCandidates.map((candidate) => {
                    const selected = candidate.userId === privateTargetUserId;
                    return (
                      <li key={candidate.userId}>
                        <button
                          type="button"
                          onClick={() => setPrivateTargetUserId(candidate.userId)}
                          className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition ${
                            selected ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{candidate.fullName}</span>
                            <span className={`block truncate text-xs ${selected ? "text-slate-200" : "text-slate-500"}`}>
                              {candidate.contact.email}
                            </span>
                            <span className={`block truncate text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                              {candidate.activeRole}
                              {candidate.teamName ? ` · ${candidate.teamName}` : ""}
                            </span>
                          </span>
                          {selected ? (
                            <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-semibold">
                              Seleccionado
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPrivateModalOpen(false)}
            disabled={createDirectChannelMutation.isPending}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!privateTargetUserId) {
                setActionError("Selecciona un usuario para iniciar el chat");
                return;
              }

              createDirectChannelMutation.mutate(privateTargetUserId);
            }}
            disabled={!privateTargetUserId || createDirectChannelMutation.isPending}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {createDirectChannelMutation.isPending
              ? "Creando..."
              : selectedPrivateCandidate
                ? `Crear chat con ${selectedPrivateCandidate.fullName}`
                : "Crear chat"}
          </button>
        </div>
      </UiModal>
    </section>
  );
};
