"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { BrowserPushCard } from "@/components/browser-push-card";

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

const summarizeNotificationBody = (body: string) => {
  const compact = body
    .replace(/\s*Ruta:\s*\/\S+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact || "Sin detalle";
};

const parseNotificationDisplay = (notification: NotificationItem) => {
  const cleaned = summarizeNotificationBody(notification.body);
  const separatorIndex = cleaned.indexOf(":");
  if (separatorIndex > 0) {
    const head = cleaned.slice(0, separatorIndex).trim();
    const tail = cleaned.slice(separatorIndex + 1).trim();
    return { title: head || notification.title, subtitle: tail || notification.title };
  }
  return { title: notification.title, subtitle: cleaned };
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => apiRequest<NotificationItem[]>("/notifications")
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const notifications = notificationsQuery.data ?? [];
      const unreadIds = notifications
        .filter((n) => n.readAt === null)
        .map((n) => n.id);
      if (unreadIds.length === 0) return { updated: 0 };
      return apiRequest<{ updated: number }>("/notifications/read", {
        method: "POST",
        body: JSON.stringify({ ids: unreadIds })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markReadMutation = useMutation({
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "all"] });
      const previous = queryClient.getQueryData<NotificationItem[]>(["notifications", "all"]);
      queryClient.setQueryData<NotificationItem[]>(["notifications", "all"], (current) =>
        (current ?? []).map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", "all"], context.previous);
      }
    },
    mutationFn: (notificationId: string) =>
      apiRequest<{ updated: number }>("/notifications/read", {
        method: "POST",
        body: JSON.stringify({ ids: [notificationId] })
      }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-0 sm:px-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Notificaciones</h1>
          <p className="text-sm text-mid">
            {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="rounded-xl border border-line px-3 py-2 text-sm text-ink hover:bg-line disabled:cursor-not-allowed disabled:opacity-60"
          >
            {markAllReadMutation.isPending ? "Marcando..." : "Marcar todas como leídas"}
          </button>
        ) : null}
      </header>

      <BrowserPushCard />

      <Card className="divide-y divide-line overflow-hidden p-0">
        {notificationsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-line" />
            ))}
          </div>
        ) : notificationsQuery.error ? (
          <p className="p-4 text-sm text-urgent">{notificationsQuery.error.message}</p>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-mid">No tienes notificaciones.</p>
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => {
              const display = parseNotificationDisplay(notification);
              const isUnread = notification.readAt === null;
              const href = extractNotificationPath(notification.body);

              return (
                <li
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-line ${
                    isUnread ? "bg-accent-muted/40" : ""
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    {isUnread ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-line" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={href as Route}
                      onClick={() => {
                        if (isUnread) {
                          markReadMutation.mutate(notification.id);
                        }
                      }}
                      className="block"
                    >
                      <p className={`text-sm font-semibold leading-snug ${isUnread ? "text-ink" : "text-mid"}`}>
                        {display.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-mid">{display.subtitle}</p>
                      <p className="mt-1 text-[11px] text-faint">{formatDateTime(notification.createdAt)}</p>
                    </Link>
                  </div>

                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(notification.id)}
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] text-mid hover:bg-line"
                    >
                      Leída
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
