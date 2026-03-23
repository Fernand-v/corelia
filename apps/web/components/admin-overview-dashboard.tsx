"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "@corelia/types";
import { Alert, Badge, Card, Empty, Progress, Spinner, Stat } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

const fmt = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const fmtDate = (v: string) =>
  new Date(v).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });

const serviceLabel: Record<string, string> = {
  api: "API",
  postgres: "Base de datos",
  redis: "Redis",
  storage: "Almacenamiento",
  media: "Media / WebRTC"
};

const serviceStatusVariant = (status: string) => {
  if (status === "up") return "success" as const;
  if (status === "degraded") return "warning" as const;
  return "danger" as const;
};

const serviceStatusLabel: Record<string, string> = {
  up: "Operativo",
  degraded: "Degradado",
  down: "Caído"
};

const actionLabel: Record<string, string> = {
  CREAR: "Crear",
  ACTUALIZAR: "Actualizar",
  ELIMINAR: "Eliminar",
  LEER: "Ver",
  APROBAR: "Aprobar",
  RECHAZAR: "Rechazar",
  LOGIN: "Inicio de sesión",
  LOGOUT: "Cierre de sesión"
};

const entityLabel: Record<string, string> = {
  USUARIO: "Usuario",
  PROYECTO: "Proyecto",
  TAREA: "Tarea",
  EQUIPO: "Equipo",
  AUTOMATIZACION: "Automatización",
  DOCUMENTO: "Documento",
  ARCHIVO: "Archivo",
  REUNION: "Reunión",
  FORMULARIO: "Formulario",
  ANUNCIO: "Anuncio",
  ROL: "Rol"
};

const importSourceLabel: Record<string, string> = {
  CSV: "CSV",
  TRELLO_JSON: "Trello",
  NOTION_CSV: "Notion"
};

const requestStatusLabel: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  EN_PROCESO: "En proceso",
  CERRADA: "Cerrada"
};

const requestStatusVariant = (status: string) => {
  if (status === "APROBADA") return "success" as const;
  if (status === "RECHAZADA") return "danger" as const;
  if (status === "EN_PROCESO") return "info" as const;
  return "neutral" as const;
};

// ── Mini bar chart component (pure CSS, no external lib) ──────────────────
const BarChart = ({ data }: { data: { label: string; value: number; max: number }[] }) => {
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((item) => {
        const pct = item.max > 0 ? Math.max(4, (item.value / item.max) * 100) : 4;
        return (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[10px] text-slate-500 tabular-nums">{item.value}</span>
            <div className="w-full flex items-end" style={{ height: "40px" }}>
              <div
                className="w-full rounded-t bg-slate-700/20 hover:bg-slate-700/40 transition-colors"
                style={{ height: `${pct}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export const AdminOverviewDashboard = () => {
  const { data, isLoading, error, refetch } = useQuery<AdminOverview>({
    queryKey: ["admin-overview"],
    queryFn: () => apiRequest<AdminOverview>("/admin/overview"),
    refetchInterval: 60_000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="danger" title="No se pudo cargar el resumen">
        {(error as Error)?.message ?? "Error desconocido."}
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-2 underline text-red-700 hover:text-red-900 text-xs"
        >
          Reintentar
        </button>
      </Alert>
    );
  }

  const { totals, organization, automations, forms, system, integrations, announcements, imports, audit } = data;

  const overduePct = totals.tasks > 0 ? (totals.overdueTasks / totals.tasks) * 100 : 0;
  const webhookSuccessRate =
    integrations.latestDeliveries.length > 0
      ? (integrations.latestDeliveries.filter((d) => d.success).length /
          integrations.latestDeliveries.length) *
        100
      : null;

  const formsByStatus = forms.byStatus.map((s) => ({
    label: requestStatusLabel[s.status] ?? s.status,
    value: s.total,
    max: Math.max(...forms.byStatus.map((x) => x.total), 1)
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Resumen del Sistema
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {organization.name} · Generado el {fmtDate(data.generatedAt)}
          </p>
        </div>
        {system.maintenanceEnabled && (
          <Alert variant="warning" title="Modo mantenimiento activo">
            {system.maintenanceMessage}
          </Alert>
        )}
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Usuarios"
          value={fmt(totals.users)}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
            </svg>
          }
        />
        <Stat
          label="Equipos"
          value={fmt(totals.teams)}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M10 2a6 6 0 100 12A6 6 0 0010 2zm0 1a5 5 0 110 10A5 5 0 0110 3z" />
            </svg>
          }
        />
        <Stat
          label="Proyectos"
          value={fmt(totals.projects)}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          }
        />
        <Stat
          label="Tareas"
          value={fmt(totals.tasks)}
          description={`${fmt(totals.overdueTasks)} vencidas`}
          trend={totals.overdueTasks > 0 ? "down" : "neutral"}
          trendLabel={totals.overdueTasks > 0 ? `${fmt(totals.overdueTasks)} vencidas` : undefined}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Fila: Estado de servicios + tareas vencidas */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Estado de servicios */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Estado de servicios</h2>
          <div className="space-y-2">
            {system.services.map((svc) => (
              <div key={svc.service} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700">{serviceLabel[svc.service] ?? svc.service}</span>
                <div className="flex items-center gap-2">
                  {svc.detail && (
                    <span className="max-w-[180px] truncate text-xs text-slate-500" title={svc.detail}>
                      {svc.detail}
                    </span>
                  )}
                  <Badge variant={serviceStatusVariant(svc.status)} dot>
                    {serviceStatusLabel[svc.status] ?? svc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Carga de tareas */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Carga de tareas</h2>
          <div className="space-y-3">
            <Progress
              value={overduePct}
              variant={overduePct > 20 ? "danger" : overduePct > 10 ? "warning" : "success"}
              label="Tareas vencidas"
              showValue
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total: {fmt(totals.tasks)} tareas</span>
              <span className="font-medium text-red-600">{fmt(totals.overdueTasks)} vencidas</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)]">
            <h3 className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Automatizaciones
            </h3>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="font-semibold text-slate-900">{fmt(automations.enabled)}</span>
                <span className="ml-1 text-slate-500">activas</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900">{fmt(automations.total)}</span>
                <span className="ml-1 text-slate-500">total</span>
              </div>
              {automations.failedLast24h > 0 && (
                <Badge variant="danger" dot>
                  {automations.failedLast24h} fallidas (24h)
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Fila: Formularios + Webhooks */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Formularios */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Formularios y solicitudes</h2>
          <div className="flex gap-4 mb-4 text-sm">
            <div>
              <span className="font-semibold text-slate-900">{fmt(forms.activeRequests)}</span>
              <span className="ml-1 text-slate-500">activas</span>
            </div>
            <div>
              <span className="font-semibold text-amber-600">{fmt(forms.pendingApproval)}</span>
              <span className="ml-1 text-slate-500">pendientes de aprobación</span>
            </div>
          </div>
          {formsByStatus.length > 0 ? (
            <>
              <BarChart data={formsByStatus} />
              <div className="mt-2 flex flex-wrap gap-2">
                {forms.byStatus.map((s) => (
                  <span key={s.status} className="flex items-center gap-1 text-xs text-slate-500">
                    <Badge variant={requestStatusVariant(s.status)}>
                      {requestStatusLabel[s.status] ?? s.status}
                    </Badge>
                    <span className="font-medium text-slate-700">{fmt(s.total)}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <Empty title="Sin solicitudes" description="No hay formularios registrados aún." />
          )}
        </Card>

        {/* Webhooks */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Integraciones y webhooks</h2>
          <div className="flex gap-4 mb-4 text-sm">
            <div>
              <span className="font-semibold text-slate-900">{fmt(integrations.webhooksConfigured)}</span>
              <span className="ml-1 text-slate-500">configurados</span>
            </div>
            <div>
              <span className="font-semibold text-emerald-600">{fmt(integrations.webhooksEnabled)}</span>
              <span className="ml-1 text-slate-500">habilitados</span>
            </div>
            {webhookSuccessRate !== null && (
              <div>
                <span
                  className={`font-semibold ${webhookSuccessRate >= 80 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(webhookSuccessRate)}%
                </span>
                <span className="ml-1 text-slate-500">éxito</span>
              </div>
            )}
          </div>
          {integrations.latestDeliveries.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Últimos envíos
              </p>
              {integrations.latestDeliveries.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500 truncate">{fmtDate(d.attemptedAt)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {d.statusCode && (
                      <span className="text-slate-400 font-mono">{d.statusCode}</span>
                    )}
                    <Badge variant={d.success ? "success" : "danger"} dot>
                      {d.success ? "OK" : "Error"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Sin entregas recientes" description="No se han enviado webhooks todavía." />
          )}
        </Card>
      </div>

      {/* Fila: Anuncios + Importaciones */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Anuncios */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Anuncios activos
            <Badge className="ml-2" variant={announcements.active > 0 ? "info" : "neutral"}>
              {fmt(announcements.active)}
            </Badge>
          </h2>
          {announcements.recent.length > 0 ? (
            <div className="space-y-2">
              {announcements.recent.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-slate-50/80 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-800 truncate">{a.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(a.expiresAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Sin anuncios recientes" />
          )}
        </Card>

        {/* Importaciones */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Importaciones recientes</h2>
          {imports.latestJobs.length > 0 ? (
            <div className="space-y-2">
              {imports.latestJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{job.filename}</p>
                    <p className="text-xs text-slate-500">{fmtDate(job.startedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="neutral">{importSourceLabel[job.source] ?? job.source}</Badge>
                    <Badge variant={job.success ? "success" : "danger"} dot>
                      {job.success ? "OK" : "Error"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Sin importaciones recientes" />
          )}
        </Card>
      </div>

      {/* Auditoría reciente */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Auditoría reciente</h2>
        {audit.latestEvents.length > 0 ? (
          <div className="divide-y divide-[rgba(0,0,0,0.05)]">
            {audit.latestEvents.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="neutral">
                    {entityLabel[ev.entityType] ?? ev.entityType}
                  </Badge>
                  <span className="text-sm text-slate-600 truncate">
                    {actionLabel[ev.action] ?? ev.action}
                    {ev.userName && (
                      <span className="text-slate-400"> · {ev.userName}</span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{fmtDate(ev.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Sin eventos recientes" />
        )}
      </Card>
    </div>
  );
};
