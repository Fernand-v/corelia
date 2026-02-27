"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SystemStatus } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { useAuthStore } from "@/lib/api";
import { useSession } from "@/lib/session";

const API_V1 = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const STATUS_BASE_URL = API_V1.replace(/\/api\/v1$/, "");

const serviceLabel: Record<SystemStatus["services"][number]["service"], string> = {
  api: "API",
  postgres: "Base de datos",
  redis: "Redis",
  storage: "Almacenamiento",
  media: "VPN/Media"
};

const statusLabel: Record<SystemStatus["services"][number]["status"], string> = {
  up: "Operativo",
  degraded: "Degradado",
  down: "Caído"
};

const toneForStatus = (status: SystemStatus["services"][number]["status"]) => {
  if (status === "down") {
    return "text-red-700 bg-red-50 border-red-200";
  }
  if (status === "degraded") {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

const fetchStatus = async (): Promise<SystemStatus> => {
  const response = await fetch(`${STATUS_BASE_URL}/status`);
  if (!response.ok) {
    throw new Error("No se pudo consultar el estado del sistema");
  }
  return response.json() as Promise<SystemStatus>;
};

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
  const [message, setMessage] = useState("Mantenimiento en curso. Volveremos pronto.");

  const statusQuery = useQuery({
    queryKey: ["system-status"],
    queryFn: fetchStatus,
    refetchInterval: 20_000
  });

  const maintenanceMutation = useMutation({
    mutationFn: (input: { enabled: boolean }) =>
      updateMaintenance({
        token: accessToken,
        enabled: input.enabled,
        ...(input.enabled ? { message } : {})
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-status"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
    }
  });

  const canManageMaintenance = useMemo(
    () => session.data?.activeRole === "ADMINISTRADOR",
    [session.data?.activeRole]
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Estado del Sistema</p>
        <h1 className="text-2xl font-semibold text-slate-900">Monitoreo y mantenimiento</h1>
        {statusQuery.data ? (
          <p className="text-sm text-slate-600">
            Último healthcheck:{" "}
            {new Date(statusQuery.data.now).toLocaleString("es-ES", {
              dateStyle: "medium",
              timeStyle: "short"
            })}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Servicios</h2>
        {statusQuery.isLoading ? <p className="text-sm text-slate-600">Cargando estado...</p> : null}
        {statusQuery.error ? <p className="text-sm text-red-600">{statusQuery.error.message}</p> : null}
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
              {service.detail ? <p className="mt-1 text-xs">{service.detail}</p> : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Modo mantenimiento</h2>
        <p className="text-sm text-slate-600">
          Estado actual: {statusQuery.data?.maintenance.enabled ? "Activo" : "Inactivo"}
        </p>
        <input
          className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
          placeholder="Mensaje para usuarios"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!canManageMaintenance}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="danger"
            disabled={!canManageMaintenance || maintenanceMutation.isPending}
            onClick={() => maintenanceMutation.mutate({ enabled: true })}
          >
            Activar mantenimiento
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canManageMaintenance || maintenanceMutation.isPending}
            onClick={() => maintenanceMutation.mutate({ enabled: false })}
          >
            Desactivar mantenimiento
          </Button>
        </div>
        {!canManageMaintenance ? (
          <p className="text-xs text-slate-500">Solo administradores pueden cambiar este estado.</p>
        ) : null}
        {maintenanceMutation.error ? (
          <p className="text-sm text-red-600">{maintenanceMutation.error.message}</p>
        ) : null}
      </Card>
    </div>
  );
};
