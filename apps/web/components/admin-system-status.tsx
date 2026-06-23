"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { UiModal } from "@/components/ui-modal";
import { apiRequest, useAuthStore } from "@/lib/api";
import { useSession } from "@/lib/session";

type SystemService = {
  service: "api" | "postgres" | "redis" | "storage" | "media";
  status: "up" | "down" | "degraded";
  detail: string | null;
};

type SystemStatusChange = {
  id: string;
  createdAt: string;
  userId: string | null;
  reason: string | null;
  overallStatus: "OK" | "ERROR";
  changedServices: Array<{
    service: SystemService["service"];
    previousStatus: SystemService["status"] | null;
    previousDetail: string | null;
    nextStatus: SystemService["status"];
    nextDetail: string | null;
  }>;
};

type AdminSystemStatusResponse = {
  now: string;
  overallStatus: "OK" | "ERROR";
  maintenance: {
    enabled: boolean;
    message: string | null;
  };
  services: SystemService[];
  recentChanges: SystemStatusChange[];
};

type AdminSystemStatusCheckResponse = AdminSystemStatusResponse & {
  changed: boolean;
  changedServices: SystemStatusChange["changedServices"];
  auditLogged: boolean;
};

const API_V1 = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const STATUS_BASE_URL = API_V1.replace(/\/api\/v1$/, "");

const serviceLabel: Record<SystemService["service"], string> = {
  api: "API",
  postgres: "Base de datos",
  redis: "Redis",
  storage: "Almacenamiento",
  media: "VPN/Media"
};

const statusLabel: Record<SystemService["status"], string> = {
  up: "Operativo",
  degraded: "Degradado",
  down: "Caído"
};

const toneForStatus = (status: SystemService["status"]) => {
  if (status === "down") {
    return "text-urgent bg-urgent-muted border-urgent/30";
  }
  if (status === "degraded") {
    return "text-ink bg-paper border-line";
  }
  return "text-ink bg-paper border-line";
};

const fetchSystemStatus = async (): Promise<AdminSystemStatusResponse> =>
  apiRequest<AdminSystemStatusResponse>("/admin/system-status");

const runStatusCheck = async (): Promise<AdminSystemStatusCheckResponse> =>
  apiRequest<AdminSystemStatusCheckResponse>("/admin/system-status/check", {
    method: "POST"
  });

const updateMaintenance = async (input: {
  token: string | null;
  enabled: boolean;
  message?: string;
}) => {
  if (!input.token) {
    throw new Error("Sesión no válida");
  }

  const response = await fetch(`${STATUS_BASE_URL}/status/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.token}`
    },
    body: JSON.stringify({
      enabled: input.enabled,
      ...(input.message ? { message: input.message } : {})
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "No se pudo actualizar mantenimiento" }));
    throw new Error(body.message ?? "No se pudo actualizar mantenimiento");
  }

  return response.json();
};

export const AdminSystemStatusView = () => {
  const queryClient = useQueryClient();
  const session = useSession();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceTargetEnabled, setMaintenanceTargetEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Mantenimiento en curso. Volveremos pronto.");
  const [maintenanceConfirm, setMaintenanceConfirm] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["admin-system-status"],
    queryFn: fetchSystemStatus,
    refetchInterval: 30_000
  });

  const statusCheckMutation = useMutation({
    mutationFn: runStatusCheck,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
    }
  });

  const maintenanceMutation = useMutation({
    mutationFn: (input: { enabled: boolean }) =>
      updateMaintenance({
        token: accessToken,
        enabled: input.enabled,
        ...(input.enabled ? { message: maintenanceMessage } : {})
      }),
    onSuccess: async () => {
      setMaintenanceModalOpen(false);
      setMaintenanceConfirm(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
    }
  });

  const canManageMaintenance = useMemo(
    () => session.data?.activeRole === "ADMINISTRADOR",
    [session.data?.activeRole]
  );

  const summaryTone =
    statusQuery.data?.overallStatus === "ERROR"
      ? "border-urgent/30 bg-urgent-muted text-urgent"
      : "border-line bg-paper text-ink";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`rounded-xl border px-3 py-2 text-sm font-semibold ${summaryTone}`}>
            {statusQuery.data?.overallStatus === "ERROR" ? "Error" : "Todo en orden"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={statusCheckMutation.isPending}
              onClick={() => statusCheckMutation.mutate()}
            >
              {statusCheckMutation.isPending ? "Verificando..." : "Verificar estado"}
            </Button>
            <Button
              type="button"
              variant={statusQuery.data?.maintenance.enabled ? "danger" : "secondary"}
              className="h-9 px-3 text-xs"
              disabled={!canManageMaintenance}
              onClick={() => {
                const currentlyEnabled = statusQuery.data?.maintenance.enabled ?? false;
                setMaintenanceTargetEnabled(!currentlyEnabled);
                setMaintenanceMessage(
                  statusQuery.data?.maintenance.message ??
                    "Mantenimiento en curso. Volveremos pronto."
                );
                setMaintenanceConfirm(false);
                setMaintenanceModalOpen(true);
              }}
            >
              Modo mantenimiento
            </Button>
          </div>
        </div>

        <p className="text-xs text-mid">
          Último check:{" "}
          {statusQuery.data
            ? new Date(statusQuery.data.now).toLocaleString("es-ES", {
                dateStyle: "medium",
                timeStyle: "short"
              })
            : "Sin datos"}
        </p>
        {!canManageMaintenance ? (
          <p className="text-xs text-mid">Solo administradores pueden cambiar mantenimiento.</p>
        ) : null}
        {statusCheckMutation.error ? (
          <p className="text-sm text-urgent">{statusCheckMutation.error.message}</p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        {statusQuery.isLoading ? <p className="text-sm text-mid">Cargando estado...</p> : null}
        {statusQuery.error ? <p className="text-sm text-urgent">{statusQuery.error.message}</p> : null}
        <ul className="space-y-2">
          {statusQuery.data?.services.map((service) => (
            <li
              key={service.service}
              className={`rounded-xl border p-3 ${toneForStatus(service.status)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{serviceLabel[service.service]}</p>
                <p className="text-xs">{statusLabel[service.status]}</p>
              </div>
              <details className="mt-2 rounded-lg border border-current/20 bg-paper px-2 py-1">
                <summary className="cursor-pointer text-xs font-medium">Detalle técnico</summary>
                <p className="mt-1 text-xs">{service.detail ?? "Sin detalle adicional"}</p>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-mid">Cambios recientes</p>
        {statusQuery.data?.recentChanges.length ? (
          <ul className="space-y-3">
            {statusQuery.data.recentChanges.map((change) => (
              <li key={change.id} className="rounded-xl border border-line bg-line p-3">
                <p className="text-xs text-mid">
                  {new Date(change.createdAt).toLocaleString("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}{" "}
                  · {change.overallStatus}
                </p>
                {change.reason ? <p className="text-xs text-mid">{change.reason}</p> : null}
                <ul className="mt-2 space-y-1 text-xs text-ink">
                  {change.changedServices.map((serviceChange, index) => (
                    <li key={`${change.id}-${serviceChange.service}-${index}`}>
                      {serviceLabel[serviceChange.service]}:{" "}
                      {serviceChange.previousStatus ? statusLabel[serviceChange.previousStatus] : "sin historial"}{" "}
                      {"->"} {statusLabel[serviceChange.nextStatus]}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mid">No hay cambios de estado registrados.</p>
        )}
      </Card>

      <UiModal
        open={maintenanceModalOpen}
        onClose={() => {
          if (!maintenanceMutation.isPending) {
            setMaintenanceModalOpen(false);
          }
        }}
        title={maintenanceTargetEnabled ? "Activar mantenimiento" : "Desactivar mantenimiento"}
      >
        <p className="text-sm text-ink">
          {maintenanceTargetEnabled
            ? "Se activará el modo mantenimiento para todos los usuarios."
            : "Se desactivará el modo mantenimiento y el sistema volverá a modo normal."}
        </p>
        {maintenanceTargetEnabled ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Mensaje para usuarios</span>
            <input
              className="h-10 w-full rounded-xl border border-line px-3 text-sm"
              value={maintenanceMessage}
              onChange={(event) => setMaintenanceMessage(event.target.value)}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={maintenanceConfirm}
            onChange={(event) => setMaintenanceConfirm(event.target.checked)}
          />
          Confirmo que deseo ejecutar este cambio.
        </label>
        {maintenanceMutation.error ? (
          <p className="text-sm text-urgent">{maintenanceMutation.error.message}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMaintenanceModalOpen(false)}
            disabled={maintenanceMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={maintenanceTargetEnabled ? "danger" : "primary"}
            disabled={
              maintenanceMutation.isPending ||
              !maintenanceConfirm ||
              (maintenanceTargetEnabled && maintenanceMessage.trim().length < 3)
            }
            onClick={() => maintenanceMutation.mutate({ enabled: maintenanceTargetEnabled })}
          >
            {maintenanceMutation.isPending ? "Aplicando..." : "Confirmar"}
          </Button>
        </div>
      </UiModal>
    </div>
  );
};
