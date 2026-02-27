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

  return (
    <div className="relative">
      <button
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            realtimeOnline ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        <span>{realtimeOnline ? "Realtime" : "Polling 30s"}</span>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
          {unread}
        </span>
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
          {latest.length === 0 ? (
            <p className="text-xs text-slate-500">Sin notificaciones.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {latest.slice(0, 12).map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={extractNotificationPath(notification.body) as Route}
                    className={`block rounded-lg border px-2 py-2 ${
                      notification.readAt
                        ? "border-slate-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <p className="text-xs font-medium text-slate-900">{notification.title}</p>
                    <p className="text-[11px] text-slate-600">{notification.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
