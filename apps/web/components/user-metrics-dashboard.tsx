"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReportsExecutiveResponse } from "@corelia/types";
import { Alert, Badge, Card, Empty, Progress, Spinner, Stat } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";
import { useSearchParams } from "next/navigation";

// ── Helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const fmtPct = (n: number) =>
  `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n)}%`;
const fmtHours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("es-ES", { dateStyle: "medium" });

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const toRangeIso = (value: string, endOfDay: boolean): string =>
  `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;

// ── Mini sparkline bar chart ──────────────────────────────────────────────
const SparkBars = ({
  data,
  valueKey,
  color = "bg-slate-700/25"
}: {
  data: ReportsExecutiveResponse["blocks"]["series"]["daily"];
  valueKey: "completed" | "created" | "loggedMinutes";
  color?: string;
}) => {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="flex items-end gap-px h-8">
      {data.slice(-30).map((d, i) => {
        const pct = Math.max(4, (d[valueKey] / max) * 100);
        return (
          <div
            key={i}
            className={`flex-1 rounded-t ${color} hover:opacity-80 transition-opacity`}
            style={{ height: `${pct}%` }}
            title={`${d.date}: ${valueKey === "loggedMinutes" ? fmtHours(d[valueKey]) : d[valueKey]}`}
          />
        );
      })}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
export const UserMetricsDashboard = () => {
  const session = useSession();
  const searchParams = useSearchParams();
  const context = getContextFromSearchParams(searchParams);

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [filters, setFilters] = useState({
    from: toDateInputValue(thirtyDaysAgo),
    to: toDateInputValue(today)
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", toRangeIso(filters.from, false));
    if (filters.to) params.set("to", toRangeIso(filters.to, true));
    if (context.projectId) params.set("projectId", context.projectId);
    if (context.teamId) params.set("teamId", context.teamId);
    return params.toString() ? `?${params.toString()}` : "";
  }, [filters, context.projectId, context.teamId]);

  const { data, isLoading, error, refetch } = useQuery<ReportsExecutiveResponse>({
    queryKey: ["user-metrics", queryString],
    queryFn: () => apiRequest<ReportsExecutiveResponse>(`/reports/executive${queryString}`),
    enabled: !!session
  });

  const rangeLabel = useMemo(() => {
    if (!data) return "";
    return `${fmtDate(data.range.from)} — ${fmtDate(data.range.to)}`;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title="No se pudieron cargar las métricas">
        {(error as Error)?.message}
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-2 underline text-red-700 text-xs"
        >
          Reintentar
        </button>
      </Alert>
    );
  }

  if (!data) return null;

  const { productivity, sla, workload, progressByClient, series } = data.blocks;

  const myWorkload = workload.byUser.find((u) => u.userId === session.data?.id);

  return (
    <div className="space-y-6">
      {/* Header + filtros de fecha */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Mis Métricas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {rangeLabel}
            {data.scope.projectFilter && (
              <span className="ml-2">
                <Badge variant="info">{data.scope.projects[0]?.name ?? "Proyecto"}</Badge>
              </span>
            )}
            {data.scope.teamFilter && !data.scope.projectFilter && (
              <span className="ml-2">
                <Badge variant="neutral">{data.scope.teams[0]?.name ?? "Equipo"}</Badge>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="rounded-xl border border-[rgba(0,0,0,0.09)] bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <span className="self-center text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            max={toDateInputValue(today)}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="rounded-xl border border-[rgba(0,0,0,0.09)] bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      {/* KPIs de productividad */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Tareas completadas"
          value={fmt(productivity.tasksCompleted)}
          trend={productivity.tasksCompleted > 0 ? "up" : "neutral"}
          description={`de ${fmt(productivity.tasksCreated)} creadas`}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
          }
        />
        <Stat
          label="Tasa de completado"
          value={fmtPct(productivity.completionRate)}
          trend={
            productivity.completionRate >= 80
              ? "up"
              : productivity.completionRate >= 50
              ? "neutral"
              : "down"
          }
          trendLabel={productivity.completionRate >= 80 ? "Buen ritmo" : productivity.completionRate >= 50 ? "Aceptable" : "Bajo"}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14.5A6.5 6.5 0 1110 3.5a6.5 6.5 0 010 13z" />
            </svg>
          }
        />
        <Stat
          label="Tiempo registrado"
          value={fmtHours(productivity.totalLoggedMinutes)}
          description={
            productivity.tasksCompleted > 0
              ? `~${fmtHours(Math.round(productivity.avgCycleHours * 60))} por tarea`
              : undefined
          }
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
          }
        />
        <Stat
          label="Cumplimiento SLA"
          value={fmtPct(sla.slaPct)}
          trend={sla.slaPct >= 90 ? "up" : sla.slaPct >= 70 ? "neutral" : "down"}
          description={`${fmt(sla.onTime)} a tiempo · ${fmt(sla.breached)} incumplidos`}
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>

      {/* Barras de progreso de completado y SLA */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Productividad del período</h2>
          <div className="space-y-3">
            <Progress
              value={productivity.completionRate}
              variant={
                productivity.completionRate >= 80
                  ? "success"
                  : productivity.completionRate >= 50
                  ? "warning"
                  : "danger"
              }
              label="Tasa de completado"
              showValue
            />
            <Progress
              value={sla.slaPct}
              variant={sla.slaPct >= 90 ? "success" : sla.slaPct >= 70 ? "warning" : "danger"}
              label="Cumplimiento de SLA"
              showValue
            />
            {myWorkload && (
              <Progress
                value={myWorkload.loadPct}
                max={100}
                variant={myWorkload.overloaded ? "danger" : myWorkload.loadPct > 70 ? "warning" : "success"}
                label="Carga actual de trabajo"
                showValue
              />
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-[rgba(0,0,0,0.06)]">
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900">{fmt(productivity.tasksCreated)}</p>
              <p className="text-xs text-slate-500">Creadas</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-emerald-600">{fmt(productivity.tasksCompleted)}</p>
              <p className="text-xs text-slate-500">Completadas</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-red-600">{fmt(sla.breached)}</p>
              <p className="text-xs text-slate-500">SLA incumplido</p>
            </div>
          </div>
        </Card>

        {/* Carga del equipo */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Carga del equipo</h2>
          {workload.byUser.length > 0 ? (
            <div className="space-y-2.5">
              {workload.byUser.slice(0, 8).map((u) => (
                <div key={u.userId} className="flex items-center gap-3">
                  <span
                    className="w-24 truncate text-xs text-slate-700"
                    title={u.fullName}
                  >
                    {u.fullName.split(" ")[0]}
                  </span>
                  <div className="flex-1">
                    <Progress
                      value={u.loadPct}
                      max={100}
                      size="sm"
                      variant={u.overloaded ? "danger" : u.loadPct > 70 ? "warning" : "success"}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                    {new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(u.loadPct)}%
                  </span>
                  {u.overloaded && (
                    <Badge variant="danger" className="text-[10px] px-1 py-0">
                      ↑
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Sin datos de carga" description="No hay información de carga disponible." />
          )}
          <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)] flex gap-3 text-xs text-slate-500">
            <span>Tareas activas: <strong className="text-slate-800">{fmt(workload.activeTasksNow)}</strong></span>
            <span>Capacidad: <strong className="text-slate-800">{fmt(workload.capacitySlots)}</strong></span>
            {workload.overloadedCount > 0 && (
              <Badge variant="warning">{workload.overloadedCount} sobrecargados</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Actividad diaria (sparklines) */}
      {series.daily.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Actividad diaria</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Tareas completadas
              </p>
              <SparkBars data={series.daily} valueKey="completed" color="bg-emerald-400/40" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Tareas creadas
              </p>
              <SparkBars data={series.daily} valueKey="created" color="bg-blue-400/40" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Tiempo registrado
              </p>
              <SparkBars data={series.daily} valueKey="loggedMinutes" color="bg-violet-400/40" />
            </div>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>
              Período: {fmt(series.daily.length)} días
            </span>
            <span>
              Pico completadas:{" "}
              {fmt(Math.max(...series.daily.map((d) => d.completed)))}
            </span>
          </div>
        </Card>
      )}

      {/* Progreso por proyecto */}
      {progressByClient.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Progreso por proyecto</h2>
          <div className="space-y-4">
            {progressByClient.map((p) => (
              <div key={p.projectId}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-sm font-medium text-slate-800 truncate max-w-[60%]">
                    {p.projectName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.overdueOpenTasks > 0 && (
                      <Badge variant="warning" dot>
                        {fmt(p.overdueOpenTasks)} vencidas
                      </Badge>
                    )}
                    <span className="text-sm font-semibold text-slate-700">
                      {fmtPct(p.completionPct)}
                    </span>
                  </div>
                </div>
                <Progress
                  value={p.completionPct}
                  variant={
                    p.completionPct >= 80
                      ? "success"
                      : p.overdueOpenTasks > 0
                      ? "warning"
                      : "default"
                  }
                  size="sm"
                />
                <div className="mt-1 flex gap-3 text-xs text-slate-400">
                  <span>{fmt(p.completedTasks)} de {fmt(p.totalTasks)} tareas</span>
                  <span>SLA: {fmtPct(p.slaPct)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
