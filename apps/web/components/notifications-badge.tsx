"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, useAuthStore } from "@/lib/api";
import { getRealtimeSocket, disconnectRealtimeSocket } from "@/lib/realtime";

type NotificationUnread = {
  unread: number;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const extractNotificationPath = (body: string) => {
  const match = body.match(/Ruta:\s*(\/\S+)/i);
  if (!match?.[1]) {
    return "/home";
  }
  return match[1].replace(/[).,;!?]+$/g, "");
};

const summarizeNotificationBody = (body: string, maxLength = 140) => {
  const compact = body
    .replace(/\s*Ruta:\s*\/\S+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return "Sin detalle";
  }

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
};

const parseNotificationDisplay = (notification: NotificationItem) => {
  const cleaned = summarizeNotificationBody(notification.body, 220);
  const separatorIndex = cleaned.indexOf(":");

  if (separatorIndex > 0) {
    const head = cleaned.slice(0, separatorIndex).trim();
    const tail = cleaned.slice(separatorIndex + 1).trim();
    return {
      title: head || notification.title,
      subtitle: tail || notification.title
    };
  }

  return {
    title: notification.title,
    subtitle: cleaned
  };
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });

export const NotificationsBadge = () => {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const [realtimeOnline, setRealtimeOnline] = useState(false);
  const [open, setOpen] = useState(false);
  const lastSyncRef = useRef<string>(new Date().toISOString());

  const pollingMs = useMemo(() => (realtimeOnline ? false : 30_000), [realtimeOnline]);

  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiRequest<NotificationUnread>("/notifications/unread-count"),
    refetchInterval: pollingMs
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "latest"],
    queryFn: () => apiRequest<NotificationItem[]>("/notifications"),
    refetchInterval: pollingMs
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const notifications = notificationsQuery.data ?? (await apiRequest<NotificationItem[]>("/notifications"));
      const unreadIds = notifications
        .filter((notification) => notification.readAt === null)
        .map((notification) => notification.id);

      if (unreadIds.length === 0) {
        return { updated: 0 };
      }

      return apiRequest<{ updated: number }>("/notifications/read", {
        method: "POST",
        body: JSON.stringify({
          ids: unreadIds
        })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
    }
  });

  const markSingleReadMutation = useMutation({
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "latest"] });
      await queryClient.cancelQueries({ queryKey: ["notifications", "unread-count"] });

      const previousLatest = queryClient.getQueryData<NotificationItem[]>(["notifications", "latest"]);
      const previousUnread = queryClient.getQueryData<NotificationUnread>([
        "notifications",
        "unread-count"
      ]);

      queryClient.setQueryData<NotificationItem[]>(["notifications", "latest"], (current) =>
        (current ?? []).map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item
        )
      );

      if (previousUnread) {
        queryClient.setQueryData<NotificationUnread>(["notifications", "unread-count"], {
          unread: Math.max(0, previousUnread.unread - 1)
        });
      }

      return { previousLatest, previousUnread };
    },
    onError: (_error, _id, context) => {
      if (context?.previousLatest) {
        queryClient.setQueryData(["notifications", "latest"], context.previousLatest);
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(["notifications", "unread-count"], context.previousUnread);
      }
    },
    mutationFn: (notificationId: string) =>
      apiRequest<{ updated: number }>("/notifications/read", {
        method: "POST",
        body: JSON.stringify({
          ids: [notificationId]
        })
      }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
    }
  });

  useEffect(() => {
    if (!token) {
      setRealtimeOnline(false);
      disconnectRealtimeSocket();
      return;
    }

    const socket = getRealtimeSocket(token);

    const onConnect = () => {
      setRealtimeOnline(true);
      socket.emit(
        "notifications:sync",
        { since: lastSyncRef.current },
        () => {
          lastSyncRef.current = new Date().toISOString();
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
        }
      );
    };

    const onDisconnect = () => {
      setRealtimeOnline(false);
    };

    const onNotification = () => {
      lastSyncRef.current = new Date().toISOString();
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "latest"] });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("notification:new", onNotification);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("notification:new", onNotification);
    };
  }, [queryClient, token]);

  const unread = unreadQuery.data?.unread ?? 0;
  const latest = notificationsQuery.data ?? [];
  const unreadNotifications = latest.filter((item) => item.readAt === null);

  return (
    <div className="relative">
      <button
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700"
        onClick={() => setOpen((current) => !current)}
        type="button"
        aria-label="Notificaciones"
        title="Notificaciones"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notificaciones</p>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending ? "Marcando..." : "Marcar leídas"}
            </button>
          </div>

          {notificationsQuery.isLoading ? <p className="text-xs text-slate-500">Cargando...</p> : null}
          {notificationsQuery.error ? (
            <p className="text-xs text-red-600">{notificationsQuery.error.message}</p>
          ) : null}
          {unreadNotifications.length === 0 ? (
            <p className="text-xs text-slate-500">Sin notificaciones.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {unreadNotifications.slice(0, 12).map((notification) => {
                const display = parseNotificationDisplay(notification);

                return (
                  <li key={notification.id}>
                    <Link
                      href={extractNotificationPath(notification.body) as Route}
                      className="block rounded-lg border border-blue-200 bg-blue-50 px-2 py-2"
                      onClick={() => {
                        markSingleReadMutation.mutate(notification.id);
                        setOpen(false);
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-900">{display.title}</p>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          No leído
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{display.subtitle}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
