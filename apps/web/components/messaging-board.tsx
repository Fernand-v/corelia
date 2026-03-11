"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel, Message, MessagingConversationsResponse } from "@corelia/types";
import { apiRequest, getApiBaseUrl, getAuthToken, useAuthStore } from "@/lib/api";
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

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

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

export const MessagingBoard = () => {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const session = useSession();
  const params = useSearchParams();
  const ensuredProjectRef = useRef<string | null>(null);

  const requestedProjectId = params.get("projectId");
  const requestedChannelId = params.get("channelId");

  const [activeChannelId, setActiveChannelId] = useState("");
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [privateSearch, setPrivateSearch] = useState("");
  const [privateTargetUserId, setPrivateTargetUserId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

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

    socket.on("connect", onConnect);
    socket.on("channel:message", onChannelMessage);

    if (socket.connected) {
      subscribe();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("channel:message", onChannelMessage);
    };
  }, [activeChannelId, queryClient, token]);

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
          ? `/call?meetingId=${message.meetingId}${activeProjectId ? `&projectId=${activeProjectId}` : ""}`
          : null,
        attachments
      };
    });
  }, [activeProjectId, authorNameById, messagesQuery.data]);

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
        onSendMessage={(input) => {
          if (!activeChannelId) {
            setActionError("Selecciona una conversación antes de enviar mensajes");
            return;
          }

          sendTextMutation.mutate({
            content: input.content,
            mentions: input.mentions
          });
        }}
        onUploadFile={(file) => {
          if (!activeChannelId) {
            setActionError("Selecciona una conversación antes de adjuntar");
            return;
          }

          if (file.size > MAX_ATTACHMENT_SIZE) {
            setActionError("El archivo supera el límite de 50MB");
            return;
          }

          sendFileMessageMutation.mutate(file);
        }}
        onDownloadAttachment={(attachmentId, fileName) => {
          void downloadAttachment(attachmentId, fileName);
        }}
      />

      <UiModal
        open={privateModalOpen}
        onClose={() => {
          if (!createDirectChannelMutation.isPending) {
            setPrivateModalOpen(false);
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

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Seleccionar usuario</span>
            <select
              value={privateTargetUserId}
              onChange={(event) => setPrivateTargetUserId(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            >
              <option value="">Seleccionar...</option>
              {privateCandidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.fullName} · {candidate.contact.email}
                </option>
              ))}
            </select>
          </label>
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
            {createDirectChannelMutation.isPending ? "Creando..." : "Crear chat"}
          </button>
        </div>
      </UiModal>
    </section>
  );
};
