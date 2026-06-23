"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { BrowserPushConfig } from "@corelia/types";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import {
  isBrowserPushSupported,
  registerBrowserPushServiceWorker,
  serializePushSubscription,
  urlBase64ToUint8Array
} from "@/lib/browser-push";

const resolveStatus = (
  supported: boolean,
  enabled: boolean,
  permission: NotificationPermission | "unsupported",
  subscribed: boolean
) => {
  if (!supported || permission === "unsupported") {
    return {
      label: "No disponible",
      tone: "bg-line text-mid",
      description: "Este navegador no soporta notificaciones push."
    };
  }

  if (!enabled) {
    return {
      label: "Deshabilitado",
      tone: "bg-paper text-ink",
      description: "El servidor todavía no tiene configuradas las claves VAPID."
    };
  }

  if (permission === "denied") {
    return {
      label: "Bloqueado",
      tone: "bg-urgent-muted text-urgent",
      description: "El navegador bloqueó el permiso. Revísalo en la configuración del sitio."
    };
  }

  if (subscribed) {
    return {
      label: "Activo",
      tone: "bg-paper text-ink",
      description: "Este navegador recibirá avisos incluso cuando no tengas Corelia abierta."
    };
  }

  return {
    label: "Listo para activar",
    tone: "bg-paper text-ink",
    description: "Actívalo para recibir avisos inmediatos de tareas, mensajes y reuniones."
  };
};

export const BrowserPushCard = () => {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const localHttpUrl =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
      ? `http://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`
      : null;

  const configQuery = useQuery({
    queryKey: ["notifications", "push-config"],
    queryFn: () => apiRequest<BrowserPushConfig>("/notifications/push/config"),
    retry: false,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    const nextSupported = isBrowserPushSupported();
    setSupported(nextSupported);
    setPermission(nextSupported ? Notification.permission : "unsupported");
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!supported) {
      setInitialized(true);
      return () => {
        cancelled = true;
      };
    }

    const config = configQuery.data;
    if (!config) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        setPermission(Notification.permission);

        if (!config.enabled || !config.publicKey) {
          setSubscribed(false);
          setSyncError(null);
          return;
        }

        const registration = await registerBrowserPushServiceWorker();
        const subscription = await registration.pushManager.getSubscription();

        if (cancelled) {
          return;
        }

        setSubscribed(Boolean(subscription));
        setSyncError(null);

        if (subscription && Notification.permission === "granted") {
          await apiRequest("/notifications/push/subscription", {
            method: "POST",
            body: JSON.stringify({
              subscription: serializePushSubscription(subscription)
            })
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : "No se pudo preparar push en este navegador");
        }
      } finally {
        if (!cancelled) {
          setInitialized(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configQuery.data, supported]);

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!supported) {
        throw new Error("Este navegador no soporta notificaciones push");
      }

      const config = configQuery.data;
      if (!config?.enabled || !config.publicKey) {
        throw new Error("Las notificaciones push no están configuradas en el servidor");
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error(
          nextPermission === "denied"
            ? "El navegador bloqueó el permiso de notificaciones"
            : "No se concedió el permiso de notificaciones"
        );
      }

      const registration = await registerBrowserPushServiceWorker();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey)
        });
      }

      await apiRequest("/notifications/push/subscription", {
        method: "POST",
        body: JSON.stringify({
          subscription: serializePushSubscription(subscription)
        })
      });

      setSubscribed(true);
      setSyncError(null);
    }
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!supported) {
        return;
      }

      const registration = await registerBrowserPushServiceWorker();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await apiRequest("/notifications/push/subscription", {
          method: "DELETE",
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        }).catch(() => undefined);

        await subscription.unsubscribe().catch(() => false);
      }

      setSubscribed(false);
      setSyncError(null);
    }
  });

  const status = resolveStatus(
    supported,
    configQuery.data?.enabled ?? false,
    permission,
    subscribed
  );

  const isBusy = enableMutation.isPending || disableMutation.isPending;

  return (
    <Card className="border border-line bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
            Push del navegador
          </p>
          <h2 className="text-lg font-semibold text-ink">Notificaciones fuera de Corelia</h2>
          <p className="max-w-2xl text-sm leading-6 text-mid">{status.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (subscribed) {
              disableMutation.mutate();
              return;
            }

            enableMutation.mutate();
          }}
          disabled={isBusy || !supported || configQuery.isLoading || (!subscribed && permission === "denied")}
          className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink"
        >
          {isBusy
            ? "Procesando..."
            : subscribed
              ? "Desactivar en este navegador"
              : "Activar push del navegador"}
        </button>

        {!initialized || configQuery.isLoading ? (
          <p className="text-sm text-mid">Preparando configuración…</p>
        ) : null}
        {configQuery.error ? (
          <p className="text-sm text-urgent">{configQuery.error.message}</p>
        ) : null}
        {enableMutation.error ? (
          <p className="text-sm text-urgent">{enableMutation.error.message}</p>
        ) : null}
        {disableMutation.error ? (
          <p className="text-sm text-urgent">{disableMutation.error.message}</p>
        ) : null}
        {syncError ? (
          <div className="space-y-1 text-sm text-urgent">
            <p>{syncError}</p>
            {localHttpUrl ? (
              <a className="font-medium text-ink underline underline-offset-2" href={localHttpUrl}>
                Abrir esta pantalla en HTTP local
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
};
