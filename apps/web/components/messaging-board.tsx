"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel, Message } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { apiRequest, useAuthStore } from "@/lib/api";
import { getRealtimeSocket, disconnectRealtimeSocket } from "@/lib/realtime";
import { useSession } from "@/lib/session";

type ChatMode = "project" | "global";

type FailedMessage = {
  tempId: string;
  channelId: string;
  content: string;
  error: string;
};

type ProjectMembersResponse = {
  projectId: string;
  projectName: string;
  members: Array<{
    userId: string;
    fullName: string;
    email: string;
    role: string;
    joinedAt: string;
  }>;
};

type ProjectMemberStatus = {
  userId: string;
  fullName: string;
  initials: string;
  availability: "DISPONIBLE" | "OCUPADO" | "EN_REUNION" | "AUSENTE";
  activeTasks: number;
  maxActiveTasks: number;
  overloaded: boolean;
  role: string;
};

type DirectoryUser = {
  userId: string;
  fullName: string;
  activeRole: string;
  teamName: string | null;
  contact: {
    email: string;
  };
};

type MentionableMember = {
  userId: string;
  fullName: string;
  handle: string;
};

type ComposerDraft = {
  content: string;
  mentions: string[];
  hasContent: boolean;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeHandle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

const buildMentionMembers = (
  members: Array<{ userId: string; fullName: string; email?: string }>
): MentionableMember[] => {
  const baseHandleByUserId = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const member of members) {
    const emailHandle = normalizeHandle(member.email?.split("@")[0] ?? "");
    const fallbackHandle = normalizeHandle(member.fullName.split(/\s+/)[0] ?? member.userId);
    const baseHandle = emailHandle || fallbackHandle || member.userId;
    baseHandleByUserId.set(member.userId, baseHandle);
    counts.set(baseHandle, (counts.get(baseHandle) ?? 0) + 1);
  }

  const used = new Map<string, number>();
  return members.map((member) => {
    const baseHandle = baseHandleByUserId.get(member.userId) ?? member.userId;
    const total = counts.get(baseHandle) ?? 1;
    const seen = (used.get(baseHandle) ?? 0) + 1;
    used.set(baseHandle, seen);

    return {
      userId: member.userId,
      fullName: member.fullName,
      handle: `${baseHandle}${total > 1 ? seen : ""}`
    };
  });
};

const availabilityLabel: Record<ProjectMemberStatus["availability"], string> = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  EN_REUNION: "En reunión",
  AUSENTE: "Ausente"
};

const availabilityClassName: Record<ProjectMemberStatus["availability"], string> = {
  DISPONIBLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OCUPADO: "border-amber-200 bg-amber-50 text-amber-700",
  EN_REUNION: "border-blue-200 bg-blue-50 text-blue-700",
  AUSENTE: "border-slate-300 bg-slate-100 text-slate-600"
};

const getTextBeforeCaret = (root: HTMLElement): string => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) {
    return "";
  }

  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().replace(/\u00a0/g, " ");
};

const createRangeFromCharacterOffsets = (
  root: HTMLElement,
  startChar: number,
  endChar: number
): Range | null => {
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const textLength = node.textContent?.length ?? 0;
    const next = current + textLength;

    if (!startNode && startChar <= next) {
      startNode = node;
      startOffset = Math.max(0, startChar - current);
    }

    if (!endNode && endChar <= next) {
      endNode = node;
      endOffset = Math.max(0, endChar - current);
      break;
    }

    current = next;
  }

  if (!startNode || !endNode) {
    return null;
  }

  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
};

const extractDraftFromEditor = (root: HTMLElement): ComposerDraft => {
  const mentions: string[] = [];
  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push((node.textContent ?? "").replace(/\u00a0/g, " "));
      return;
    }

    if (node instanceof HTMLBRElement) {
      parts.push("\n");
      return;
    }

    if (node instanceof HTMLElement && node.dataset.mentionId) {
      const mentionId = node.dataset.mentionId;
      const mentionHandle = node.dataset.mentionHandle;
      if (mentionId && mentionHandle) {
        mentions.push(mentionId);
        parts.push(`@${mentionHandle}`);
      }
      return;
    }

    node.childNodes.forEach((child) => walk(child));
  };

  root.childNodes.forEach((child) => walk(child));

  const content = parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    content,
    mentions: [...new Set(mentions)],
    hasContent: content.length > 0
  };
};

const MessageComposer = ({
  mentionMembers,
  disabled,
  sending,
  onSend
}: {
  mentionMembers: MentionableMember[];
  disabled: boolean;
  sending: boolean;
  onSend: (draft: { content: string; mentions: string[] }) => void;
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const filteredMentionMembers = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }

    const normalizedQuery = normalizeHandle(mentionQuery);
    return mentionMembers
      .filter((member) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          normalizeHandle(member.handle).includes(normalizedQuery) ||
          normalize(member.fullName).includes(normalize(mentionQuery))
        );
      })
      .slice(0, 8);
  }, [mentionMembers, mentionQuery]);

  useEffect(() => {
    if (selectedMentionIndex >= filteredMentionMembers.length) {
      setSelectedMentionIndex(0);
    }
  }, [filteredMentionMembers.length, selectedMentionIndex]);

  const updateComposerState = () => {
    const root = editorRef.current;
    if (!root) {
      return;
    }

    const draft = extractDraftFromEditor(root);
    setHasContent(draft.hasContent);

    const textBeforeCaret = getTextBeforeCaret(root);
    const mentionMatch = textBeforeCaret.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    setMentionQuery(mentionMatch ? mentionMatch[1] ?? "" : null);
  };

  const clearEditor = () => {
    const root = editorRef.current;
    if (!root) {
      return;
    }

    root.innerHTML = "";
    setHasContent(false);
    setMentionQuery(null);
    setSelectedMentionIndex(0);
  };

  const insertLineBreak = () => {
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) {
      return;
    }

    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    updateComposerState();
  };

  const insertMention = (member: MentionableMember) => {
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) {
      return;
    }

    const currentRange = selection.getRangeAt(0);
    if (!root.contains(currentRange.endContainer)) {
      return;
    }

    const textBeforeCaret = getTextBeforeCaret(root);
    const mentionMatch = textBeforeCaret.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    let workingRange = currentRange.cloneRange();

    if (mentionMatch) {
      const mentionLength = (mentionMatch[1]?.length ?? 0) + 1;
      const endChar = textBeforeCaret.length;
      const startChar = endChar - mentionLength;
      const replaceRange = createRangeFromCharacterOffsets(root, startChar, endChar);
      if (replaceRange) {
        replaceRange.deleteContents();
        workingRange = replaceRange;
        workingRange.collapse(true);
      }
    }

    const mention = document.createElement("span");
    mention.contentEditable = "false";
    mention.dataset.mentionId = member.userId;
    mention.dataset.mentionHandle = member.handle;
    mention.className =
      "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700";
    mention.textContent = `@${member.handle}`;

    const separator = document.createTextNode(" ");
    workingRange.insertNode(mention);
    workingRange.setStartAfter(mention);
    workingRange.collapse(true);
    workingRange.insertNode(separator);
    workingRange.setStartAfter(separator);
    workingRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(workingRange);
    root.focus();

    setMentionQuery(null);
    setSelectedMentionIndex(0);
    setHasContent(true);
  };

  const removeMentionBeforeCaret = (event: KeyboardEvent<HTMLDivElement>) => {
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    let mentionToRemove: HTMLElement | null = null;

    if (container === root) {
      const previous = root.childNodes[range.startOffset - 1];
      if (previous instanceof HTMLElement && previous.dataset.mentionId) {
        mentionToRemove = previous;
      }
    } else if (container.nodeType === Node.TEXT_NODE) {
      const textNode = container as Text;

      if (range.startOffset === 0) {
        const previous = textNode.previousSibling;
        if (previous instanceof HTMLElement && previous.dataset.mentionId) {
          mentionToRemove = previous;
          if (textNode.textContent?.startsWith(" ")) {
            textNode.textContent = textNode.textContent.slice(1);
          }
        }
      }
    }

    if (!mentionToRemove) {
      return;
    }

    event.preventDefault();
    mentionToRemove.remove();
    updateComposerState();
  };

  const submitDraft = () => {
    const root = editorRef.current;
    if (!root || disabled || sending) {
      return;
    }

    const draft = extractDraftFromEditor(root);
    if (!draft.hasContent) {
      return;
    }

    onSend({
      content: draft.content,
      mentions: draft.mentions
    });
    clearEditor();
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl border border-slate-300 bg-white px-3 py-2">
        {!hasContent ? (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
            Escribe un mensaje. Usa @ para mencionar.
          </p>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          className="min-h-[88px] max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-900 outline-none"
          onInput={updateComposerState}
          onClick={updateComposerState}
          onKeyUp={updateComposerState}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              removeMentionBeforeCaret(event);
              return;
            }

            if (mentionQuery !== null && filteredMentionMembers.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedMentionIndex((current) => (current + 1) % filteredMentionMembers.length);
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedMentionIndex((current) =>
                  (current - 1 + filteredMentionMembers.length) % filteredMentionMembers.length
                );
                return;
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const selected = filteredMentionMembers[selectedMentionIndex] ?? filteredMentionMembers[0];
                if (selected) {
                  insertMention(selected);
                }
                return;
              }
            }

            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              insertLineBreak();
              return;
            }

            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
        />
      </div>

      {mentionQuery !== null && filteredMentionMembers.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Mencionar usuario</p>
          <ul className="space-y-1">
            {filteredMentionMembers.map((member, index) => (
              <li key={member.userId}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1 text-left text-sm ${
                    index === selectedMentionIndex
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(member);
                  }}
                >
                  <span className="font-medium">@{member.handle}</span>{" "}
                  <span className="text-xs text-slate-500">{member.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={disabled || sending || !hasContent}
          onClick={submitDraft}
        >
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
};

export const MessagingBoard = () => {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const session = useSession();
  const params = useSearchParams();
  const listRef = useRef<HTMLUListElement | null>(null);
  const projectChannelAutoCreateAttemptedRef = useRef(false);

  const projectId = params.get("projectId");
  const requestedChannelId = params.get("channelId");
  const highlightedMessageId = params.get("messageId");

  const [chatMode, setChatMode] = useState<ChatMode>("project");
  const [selectedProjectChannelId, setSelectedProjectChannelId] = useState("");
  const [selectedGlobalChannelId, setSelectedGlobalChannelId] = useState("");
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"offline" | "online">("offline");
  const [globalUserSearch, setGlobalUserSearch] = useState("");

  const projectChannelsQuery = useQuery({
    queryKey: ["messaging", "channels", "project", projectId],
    queryFn: () =>
      apiRequest<Channel[]>(`/messaging/channels?projectId=${encodeURIComponent(projectId!)}`),
    enabled: Boolean(projectId)
  });

  const allChannelsQuery = useQuery({
    queryKey: ["messaging", "channels", "all"],
    queryFn: () => apiRequest<Channel[]>("/messaging/channels"),
    enabled: Boolean(token)
  });

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => apiRequest<ProjectMembersResponse>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId)
  });

  const projectStatusQuery = useQuery({
    queryKey: ["project-members-status", projectId],
    queryFn: () =>
      apiRequest<ProjectMemberStatus[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(projectId!)}`
      ),
    enabled: Boolean(projectId)
  });

  const directoryQuery = useQuery({
    queryKey: ["identity-directory"],
    queryFn: () => apiRequest<DirectoryUser[]>("/identity/directory"),
    enabled: Boolean(token)
  });

  const projectChannels = useMemo(() => projectChannelsQuery.data ?? [], [projectChannelsQuery.data]);
  const globalChannels = useMemo(
    () =>
      (allChannelsQuery.data ?? []).filter(
        (channel) => channel.projectId === null && channel.teamId === null
      ),
    [allChannelsQuery.data]
  );

  const projectMentionMembers = useMemo(
    () =>
      buildMentionMembers(
        (projectMembersQuery.data?.members ?? []).map((member) => ({
          userId: member.userId,
          fullName: member.fullName,
          email: member.email
        }))
      ),
    [projectMembersQuery.data?.members]
  );

  const globalMentionMembers = useMemo(
    () =>
      buildMentionMembers(
        (directoryQuery.data ?? []).map((person) => ({
          userId: person.userId,
          fullName: person.fullName,
          email: person.contact.email
        }))
      ),
    [directoryQuery.data]
  );

  const activeMentionMembers =
    chatMode === "project" ? projectMentionMembers : globalMentionMembers;

  const mentionNameByHandle = useMemo(
    () => new Map(activeMentionMembers.map((member) => [normalizeHandle(member.handle), member.fullName])),
    [activeMentionMembers]
  );

  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of projectMembersQuery.data?.members ?? []) {
      map.set(member.userId, member.fullName);
    }
    for (const person of directoryQuery.data ?? []) {
      if (!map.has(person.userId)) {
        map.set(person.userId, person.fullName);
      }
    }
    return map;
  }, [directoryQuery.data, projectMembersQuery.data?.members]);

  useEffect(() => {
    projectChannelAutoCreateAttemptedRef.current = false;
  }, [projectId]);

  const createProjectChannelMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !projectMembersQuery.data) {
        throw new Error("Selecciona un proyecto para crear el canal principal");
      }

      return apiRequest<Channel>("/messaging/channels", {
        method: "POST",
        body: JSON.stringify({
          name: `${projectMembersQuery.data.projectName} · General`,
          scope: "PROYECTO",
          projectId,
          memberIds: projectMembersQuery.data.members.map((member) => member.userId)
        })
      });
    },
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: ["messaging", "channels"] });
      setSelectedProjectChannelId(channel.id);
      setChatMode("project");
    }
  });

  const createDirectChannelMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      apiRequest<Channel>("/messaging/channels/direct", {
        method: "POST",
        body: JSON.stringify({ targetUserId })
      }),
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: ["messaging", "channels"] });
      setChatMode("global");
      setSelectedGlobalChannelId(channel.id);
      setGlobalUserSearch("");
    }
  });

  useEffect(() => {
    if (!projectId || !projectMembersQuery.data) {
      return;
    }

    if (projectChannels.length === 0 && !projectChannelAutoCreateAttemptedRef.current) {
      projectChannelAutoCreateAttemptedRef.current = true;
      createProjectChannelMutation.mutate();
      return;
    }

    if (
      requestedChannelId &&
      projectChannels.some((channel) => channel.id === requestedChannelId)
    ) {
      setSelectedProjectChannelId(requestedChannelId);
      setChatMode("project");
      return;
    }

    if (
      selectedProjectChannelId &&
      projectChannels.some((channel) => channel.id === selectedProjectChannelId)
    ) {
      return;
    }

    setSelectedProjectChannelId(projectChannels[0]?.id ?? "");
  }, [
    createProjectChannelMutation,
    projectChannels,
    projectId,
    projectMembersQuery.data,
    requestedChannelId,
    selectedProjectChannelId
  ]);

  useEffect(() => {
    if (
      requestedChannelId &&
      globalChannels.some((channel) => channel.id === requestedChannelId)
    ) {
      setSelectedGlobalChannelId(requestedChannelId);
      setChatMode("global");
      return;
    }

    if (
      selectedGlobalChannelId &&
      globalChannels.some((channel) => channel.id === selectedGlobalChannelId)
    ) {
      return;
    }

    setSelectedGlobalChannelId(globalChannels[0]?.id ?? "");
  }, [globalChannels, requestedChannelId, selectedGlobalChannelId]);

  const activeChannelId =
    chatMode === "project" ? selectedProjectChannelId : selectedGlobalChannelId;

  const messagesQuery = useQuery({
    queryKey: ["messages", activeChannelId],
    queryFn: () => apiRequest<Message[]>(`/messages?channelId=${encodeURIComponent(activeChannelId)}`),
    enabled: Boolean(activeChannelId)
  });

  useEffect(() => {
    if (!highlightedMessageId || !messagesQuery.data || !listRef.current) {
      return;
    }

    const element = listRef.current.querySelector<HTMLElement>(`#message-${highlightedMessageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessageId, messagesQuery.data]);

  useEffect(() => {
    if (!token || !activeChannelId) {
      setRealtimeStatus("offline");
      return;
    }

    const socket = getRealtimeSocket(token);

    const subscribe = () => {
      socket.emit("subscribe:channel", activeChannelId, (result: { ok: boolean }) => {
        setRealtimeStatus(result.ok ? "online" : "offline");
      });
    };

    const onConnect = () => subscribe();
    const onDisconnect = () => setRealtimeStatus("offline");
    const onChannelMessage = (message: Message) => {
      if (message.channelId !== activeChannelId) {
        return;
      }

      queryClient.setQueryData<Message[]>(["messages", activeChannelId], (current) => {
        const list = current ?? [];
        const deduped = list.filter((item) => item.id !== message.id);
        return [...deduped, message];
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("channel:message", onChannelMessage);

    if (socket.connected) {
      subscribe();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("channel:message", onChannelMessage);
    };
  }, [activeChannelId, queryClient, token]);

  useEffect(() => {
    if (!token) {
      disconnectRealtimeSocket();
    }
  }, [token]);

  const sendMutation = useMutation({
    mutationFn: async (payload: { content: string; mentions: string[] }) =>
      apiRequest<Message>("/messages", {
        method: "POST",
        body: JSON.stringify({
          channelId: activeChannelId,
          content: payload.content,
          mentions: payload.mentions
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", activeChannelId] });
    },
    onError: (error, payload) => {
      if (!activeChannelId) {
        return;
      }

      setFailedMessages((current) => [
        ...current,
        {
          tempId: crypto.randomUUID(),
          channelId: activeChannelId,
          content: payload.content,
          error: error.message
        }
      ]);
    }
  });

  const visibleFailedMessages = useMemo(
    () => failedMessages.filter((message) => message.channelId === activeChannelId),
    [activeChannelId, failedMessages]
  );

  const filteredGlobalUsers = useMemo(() => {
    const query = normalize(globalUserSearch);
    return (directoryQuery.data ?? [])
      .filter((user) => user.userId !== session.data?.id)
      .filter((user) => {
        if (!query) {
          return true;
        }
        return (
          normalize(user.fullName).includes(query) ||
          normalize(user.contact.email).includes(query)
        );
      })
      .slice(0, 8);
  }, [directoryQuery.data, globalUserSearch, session.data?.id]);

  const projectMainChannel = projectChannels[0] ?? null;
  const currentChannel =
    chatMode === "project"
      ? projectMainChannel
      : globalChannels.find((channel) => channel.id === selectedGlobalChannelId) ?? null;

  const renderMessageContent = (content: string) => {
    const segments = content.split(/(@[a-zA-Z0-9._-]+)/g);
    return segments.map((segment, index) => {
      if (!segment.startsWith("@")) {
        return <span key={`${segment}-${index}`}>{segment}</span>;
      }

      const handle = normalizeHandle(segment.slice(1));
      const mentionedName = mentionNameByHandle.get(handle);
      if (!mentionedName) {
        return <span key={`${segment}-${index}`}>{segment}</span>;
      }

      return (
        <span
          key={`${segment}-${index}`}
          title={mentionedName}
          className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700"
        >
          {segment}
        </span>
      );
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr_300px]">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Conversaciones</h2>
          <span
            className={`rounded-lg border px-2 py-1 text-[11px] ${
              realtimeStatus === "online"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {realtimeStatus === "online" ? "Realtime activo" : "Polling/API"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={chatMode === "project" ? "primary" : "secondary"}
            className="h-8 text-xs"
            onClick={() => setChatMode("project")}
            disabled={!projectMainChannel}
          >
            Proyecto
          </Button>
          <Button
            type="button"
            variant={chatMode === "global" ? "primary" : "secondary"}
            className="h-8 text-xs"
            onClick={() => setChatMode("global")}
          >
            Global
          </Button>
        </div>

        {chatMode === "project" ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600">
              {projectMembersQuery.data?.projectName
                ? `Canal único del proyecto: ${projectMembersQuery.data.projectName}`
                : "Canal único del proyecto"}
            </p>
            {!projectMainChannel ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Preparando canal del proyecto...
              </p>
            ) : (
              <button
                type="button"
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  selectedProjectChannelId === projectMainChannel.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setSelectedProjectChannelId(projectMainChannel.id)}
              >
                <p className="text-sm font-semibold">{projectMainChannel.name}</p>
                <p className="text-xs opacity-80">Canal contextual del proyecto</p>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Nuevo mensaje global
              </span>
              <input
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                placeholder="Buscar usuario..."
                value={globalUserSearch}
                onChange={(event) => setGlobalUserSearch(event.target.value)}
              />
            </label>

            {createDirectChannelMutation.error ? (
              <p className="text-xs text-red-600">{createDirectChannelMutation.error.message}</p>
            ) : null}

            <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {filteredGlobalUsers.map((user) => (
                <li key={user.userId}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => createDirectChannelMutation.mutate(user.userId)}
                  >
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-xs text-slate-500">{user.contact.email}</p>
                  </button>
                </li>
              ))}
            </ul>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Historial global
              </p>
              <ul className="space-y-1">
                {globalChannels.map((channel) => (
                  <li key={channel.id}>
                    <button
                      type="button"
                      className={`w-full rounded-lg border px-2 py-2 text-left ${
                        channel.id === selectedGlobalChannelId
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedGlobalChannelId(channel.id)}
                    >
                      <p className="text-sm font-medium">{channel.name}</p>
                      <p className={`text-xs ${channel.id === selectedGlobalChannelId ? "text-slate-300" : "text-slate-500"}`}>
                        Mensaje directo guardado
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <header className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {currentChannel?.name ?? "Mensajería"}
          </h2>
          <p className="text-sm text-slate-600">
            Interfaz tipo chat. Enter envía y Shift+Enter agrega salto de línea.
          </p>
        </header>

        {!activeChannelId ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Selecciona una conversación para comenzar.
          </p>
        ) : (
          <>
            {messagesQuery.isLoading ? <p className="text-sm text-slate-600">Cargando historial...</p> : null}
            {messagesQuery.error ? <p className="text-sm text-red-600">{messagesQuery.error.message}</p> : null}

            <ul
              ref={listRef}
              className="max-h-[520px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#eef2ff_55%,_#f8fafc_100%)] p-3"
            >
              {messagesQuery.data?.map((message) => {
                const isMine = message.authorId === session.data?.id;
                const highlighted = message.id === highlightedMessageId;
                return (
                  <li
                    id={`message-${message.id}`}
                    key={message.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <article
                      className={`max-w-[80%] rounded-2xl border px-3 py-2 shadow-sm ${
                        isMine
                          ? "border-blue-200 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-900"
                      } ${highlighted ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
                    >
                      {!isMine ? (
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {authorNameById.get(message.authorId) ?? "Usuario"}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {renderMessageContent(message.content)}
                      </p>
                      <p
                        className={`mt-1 text-[11px] ${
                          isMine ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {formatDateTime(message.createdAt)}
                      </p>
                    </article>
                  </li>
                );
              })}

              {visibleFailedMessages.map((item) => (
                <li key={item.tempId} className="flex justify-end">
                  <article className="max-w-[80%] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                    <p className="mt-1 text-[11px] text-red-700">No enviado: {item.error}</p>
                  </article>
                </li>
              ))}
            </ul>

            <MessageComposer
              mentionMembers={activeMentionMembers}
              disabled={!activeChannelId}
              sending={sendMutation.isPending}
              onSend={(draft) => {
                sendMutation.mutate(draft);
              }}
            />
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Estado del equipo</h2>
        <p className="text-xs text-slate-600">
          Disponibilidad actual de miembros del proyecto para coordinar mensajes y reuniones.
        </p>

        {projectStatusQuery.isLoading ? <p className="text-sm text-slate-600">Cargando estado...</p> : null}
        {projectStatusQuery.error ? <p className="text-sm text-red-600">{projectStatusQuery.error.message}</p> : null}

        <ul className="space-y-2">
          {projectStatusQuery.data?.map((member) => (
            <li key={member.userId} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{member.fullName}</p>
                  <p className="text-xs text-slate-500">{member.role}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${availabilityClassName[member.availability]}`}
                >
                  {availabilityLabel[member.availability]}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Tareas activas: {member.activeTasks}/{member.maxActiveTasks}{" "}
                {member.overloaded ? "· Carga alta" : ""}
              </p>
            </li>
          ))}
        </ul>

        {!projectId ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Selecciona un proyecto para ver disponibilidad del equipo.
          </p>
        ) : null}
      </Card>
    </div>
  );
};
