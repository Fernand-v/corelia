"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReportsExecutiveResponse, RoleCode } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { apiRequest, getApiBaseUrl, getAuthToken } from "@/lib/api";
import { useSession } from "@/lib/session";

const REPORT_ALLOWED_ROLES = new Set<RoleCode>([
  "COLABORADOR",
  "COORDINADOR_EQUIPO",
  "LIDER_PROYECTO",
  "ADMINISTRADOR"
]);

const roleLabel: Record<RoleCode, string> = {
  ADMINISTRADOR: "Administrador",
  LIDER_PROYECTO: "Líder de Proyecto",
  COORDINADOR_EQUIPO: "Coordinador de Equipo",
  COLABORADOR: "Colaborador",
  OBSERVADOR: "Observador",
  INVITADO_EXTERNO: "Invitado Externo"
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const formatNumber = (value: number) => new Intl.NumberFormat("es-ES").format(value);

const formatPct = (value: number) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)}%`;

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const toRangeIso = (value: string, endOfDay: boolean): string => {
  if (!value) {
    return "";
  }
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
};

type Filters = {
  from: string;
  to: string;
  projectId: string;
  teamId: string;
};

const buildQueryString = (filters: Filters) => {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", toRangeIso(filters.from, false));
  }
  if (filters.to) {
    params.set("to", toRangeIso(filters.to, true));
  }
  if (filters.projectId) {
    params.set("projectId", filters.projectId);
  }
  if (filters.teamId) {
    params.set("teamId", filters.teamId);
  }
  return params.toString();
};

export const ReportsDashboardView = () => {
  const session = useSession();

  const today = useMemo(() => new Date(), []);
  const defaultFilters = useMemo<Filters>(() => {
    const from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    return {
      from: toDateInputValue(from),
      to: toDateInputValue(today),
      projectId: "",
      teamId: ""
    };
  }, [today]);

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);

  const activeRole = session.data?.activeRole ?? null;
  const roleCanAccessReports = activeRole ? REPORT_ALLOWED_ROLES.has(activeRole) : false;

  const reportQuery = useQuery({
    queryKey: ["reports-executive", appliedFilters.from, appliedFilters.to, appliedFilters.projectId, appliedFilters.teamId],
    queryFn: () => {
      const query = buildQueryString(appliedFilters);
      return apiRequest<ReportsExecutiveResponse>(`/reports/executive${query ? `?${query}` : ""}`);
    },
    enabled: session.isSuccess && roleCanAccessReports
  });

  const downloadReport = async (format: "pdf" | "xlsx") => {
    if (downloading) {
      return;
    }
    const token = getAuthToken();
    if (!token) {
      return;
    }
    setDownloading(format);
    try {
      const query = buildQueryString(appliedFilters);
      const response = await fetch(`${getApiBaseUrl()}/reports/executive/export.${format}${query ? `?${query}` : ""}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "No se pudo exportar el reporte" }));
        throw new Error(body.message ?? "No se pudo exportar el reporte");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const filename = `executive-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  if (session.isLoading) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Cargando sesión...</p>
      </Card>
    );
  }

  if (session.error || !session.data) {
    return (
      <Card>
        <p className="text-sm text-red-600">{session.error?.message ?? "No se pudo cargar la sesión."}</p>
      </Card>
    );
  }

  if (!roleCanAccessReports) {
    return (
      <Card className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-600">Tu rol no tiene acceso a este módulo.</p>
      </Card>
    );
  }

  const report = reportQuery.data;
  const projectOptions = report?.scope.projects ?? [];
  const teamOptions = report?.scope.teams ?? [];

  return (
    <div className="space-y-5">
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Reportes ejecutivos</p>
            <h1 className="text-2xl font-semibold text-slate-900">{roleLabel[session.data.activeRole]}</h1>
            <p className="text-sm text-slate-600">
              KPI de productividad, SLA, carga por equipo y avance por proyecto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-3 text-xs"
              disabled={Boolean(downloading) || reportQuery.isLoading || !report}
              onClick={() => downloadReport("pdf")}
            >
              {downloading === "pdf" ? "Exportando..." : "Exportar PDF"}
            </Button>
            <Button
              type="button"
              className="h-8 px-3 text-xs"
              disabled={Boolean(downloading) || reportQuery.isLoading || !report}
              onClick={() => downloadReport("xlsx")}
            >
              {downloading === "xlsx" ? "Exportando..." : "Exportar XLSX"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Desde</span>
            <input
              type="date"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Hasta</span>
            <input
              type="date"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Proyecto</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={filters.projectId}
              onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}
            >
              <option value="">Todos</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Equipo</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={filters.teamId}
              onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))}
            >
              <option value="">Todos</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="button" className="h-10 px-3 text-xs" onClick={() => setAppliedFilters(filters)}>
              Aplicar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-3 text-xs"
              onClick={() => {
                setFilters(defaultFilters);
                setAppliedFilters(defaultFilters);
              }}
            >
              Limpiar
            </Button>
          </div>
        </div>
        {report ? (
          <p className="text-xs text-slate-500">
            Generado: {formatDateTime(report.generatedAt)} · Rango efectivo: {formatDateTime(report.range.from)} -{" "}
            {formatDateTime(report.range.to)}
          </p>
        ) : null}
      </Card>

      {reportQuery.isLoading ? (
        <Card>
          <p className="text-sm text-slate-600">Cargando reportes...</p>
        </Card>
      ) : null}
      {reportQuery.error ? (
        <Card>
          <p className="text-sm text-red-600">{reportQuery.error.message}</p>
        </Card>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">Productividad</p>
              <p className="text-sm text-slate-700">Creadas: {formatNumber(report.blocks.productivity.tasksCreated)}</p>
              <p className="text-sm text-slate-700">Completadas: {formatNumber(report.blocks.productivity.tasksCompleted)}</p>
              <p className="text-sm text-slate-700">Tasa cierre: {formatPct(report.blocks.productivity.completionRate)}</p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">SLA</p>
              <p className="text-sm text-slate-700">Evaluadas: {formatNumber(report.blocks.sla.evaluated)}</p>
              <p className="text-sm text-slate-700">A tiempo: {formatNumber(report.blocks.sla.onTime)}</p>
              <p className="text-sm text-slate-700">Incumplidas: {formatNumber(report.blocks.sla.breached)}</p>
              <p className="text-sm text-slate-700">SLA: {formatPct(report.blocks.sla.slaPct)}</p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">Carga</p>
              <p className="text-sm text-slate-700">Activas: {formatNumber(report.blocks.workload.activeTasksNow)}</p>
              <p className="text-sm text-slate-700">Capacidad: {formatNumber(report.blocks.workload.capacitySlots)}</p>
              <p className="text-sm text-slate-700">Carga: {formatPct(report.blocks.workload.loadPct)}</p>
              <p className="text-sm text-slate-700">
                Sobrecargados: {formatNumber(report.blocks.workload.overloadedCount)}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tiempo</p>
              <p className="text-sm text-slate-700">
                Minutos registrados: {formatNumber(report.blocks.productivity.totalLoggedMinutes)}
              </p>
              <p className="text-sm text-slate-700">Promedio ciclo: {formatNumber(report.blocks.productivity.avgCycleHours)} h</p>
            </Card>
          </div>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Avance por proyecto</h2>
            {report.blocks.progressByClient.length === 0 ? (
              <p className="text-sm text-slate-600">No hay proyectos en el alcance actual.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Proyecto</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Completadas</th>
                      <th className="px-2 py-2">% Avance</th>
                      <th className="px-2 py-2">Vencidas</th>
                      <th className="px-2 py-2">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.blocks.progressByClient.map((item) => (
                      <tr key={item.projectId} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-medium text-slate-800">{item.projectName}</td>
                        <td className="px-2 py-2 text-slate-700">{formatNumber(item.totalTasks)}</td>
                        <td className="px-2 py-2 text-slate-700">{formatNumber(item.completedTasks)}</td>
                        <td className="px-2 py-2 text-slate-700">{formatPct(item.completionPct)}</td>
                        <td className="px-2 py-2 text-slate-700">{formatNumber(item.overdueOpenTasks)}</td>
                        <td className="px-2 py-2 text-slate-700">{formatPct(item.slaPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {session.data.activeRole !== "COLABORADOR" ? (
            <div className="grid gap-3 xl:grid-cols-2">
              <Card className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Carga por equipo</h2>
                {report.blocks.workload.byTeam.length === 0 ? (
                  <p className="text-sm text-slate-600">No hay equipos en el alcance seleccionado.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.blocks.workload.byTeam.map((team) => (
                      <li key={team.teamId} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{team.teamName}</p>
                        <p className="text-xs text-slate-600">
                          Activas: {formatNumber(team.activeTasksNow)} · Capacidad: {formatNumber(team.capacitySlots)} ·
                          Carga: {formatPct(team.loadPct)} · Sobrecargados: {formatNumber(team.overloadedCount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Carga por usuario</h2>
                {report.blocks.workload.byUser.length === 0 ? (
                  <p className="text-sm text-slate-600">No hay usuarios en el alcance seleccionado.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.blocks.workload.byUser.slice(0, 30).map((user) => (
                      <li key={user.userId} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
                        <p className="text-xs text-slate-600">
                          {user.teamName ?? "Sin equipo"} · Activas: {formatNumber(user.activeTasksNow)} · Capacidad:{" "}
                          {formatNumber(user.capacitySlots)} · Carga: {formatPct(user.loadPct)} ·{" "}
                          {user.overloaded ? "Sobrecargado" : "Normal"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : (
            <Card className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Carga personal</h2>
              {report.blocks.workload.byUser[0] ? (
                <p className="text-sm text-slate-700">
                  Activas: {formatNumber(report.blocks.workload.byUser[0].activeTasksNow)} · Capacidad:{" "}
                  {formatNumber(report.blocks.workload.byUser[0].capacitySlots)} · Carga:{" "}
                  {formatPct(report.blocks.workload.byUser[0].loadPct)}
                </p>
              ) : (
                <p className="text-sm text-slate-600">No hay datos de carga personal.</p>
              )}
            </Card>
          )}

          {report.blocks.budget && report.blocks.budget.byProject.length > 0 ? (
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Presupuesto por proyecto</h2>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Proyecto</th>
                      <th className="px-2 py-2">Estimado</th>
                      <th className="px-2 py-2">Aprobado</th>
                      <th className="px-2 py-2">Pendiente</th>
                      <th className="px-2 py-2">Restante</th>
                      <th className="px-2 py-2">% Ejecutado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.blocks.budget.byProject.map((item) => (
                      <tr key={item.projectId} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-medium text-slate-800">{item.projectName}</td>
                        <td className="px-2 py-2 text-slate-700">{formatNumber(item.totalEstimated)}</td>
                        <td className="px-2 py-2 text-green-700">{formatNumber(item.totalApproved)}</td>
                        <td className="px-2 py-2 text-amber-600">{formatNumber(item.totalPending)}</td>
                        <td className={`px-2 py-2 ${item.totalRemaining >= 0 ? "text-slate-700" : "text-red-600"}`}>
                          {formatNumber(item.totalRemaining)}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{formatPct(item.executionPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 font-semibold">
                      <td className="px-2 py-2 text-slate-900">Total</td>
                      <td className="px-2 py-2 text-slate-900">{formatNumber(report.blocks.budget.totalEstimated)}</td>
                      <td className="px-2 py-2 text-green-700">{formatNumber(report.blocks.budget.totalApproved)}</td>
                      <td className="px-2 py-2 text-amber-600">{formatNumber(report.blocks.budget.totalPending)}</td>
                      <td className={`px-2 py-2 ${report.blocks.budget.totalRemaining >= 0 ? "text-slate-900" : "text-red-600"}`}>
                        {formatNumber(report.blocks.budget.totalRemaining)}
                      </td>
                      <td className="px-2 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ) : null}

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Serie diaria</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Creadas</th>
                    <th className="px-2 py-2">Completadas</th>
                    <th className="px-2 py-2">Vencían</th>
                    <th className="px-2 py-2">SLA a tiempo</th>
                    <th className="px-2 py-2">SLA incumplida</th>
                    <th className="px-2 py-2">Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.blocks.series.daily.map((item) => (
                    <tr key={item.date} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-slate-700">{item.date}</td>
                      <td className="px-2 py-2 text-slate-700">{formatNumber(item.created)}</td>
                      <td className="px-2 py-2 text-slate-700">{formatNumber(item.completed)}</td>
                      <td className="px-2 py-2 text-slate-700">{formatNumber(item.due)}</td>
                      <td className="px-2 py-2 text-slate-700">{formatNumber(item.slaOnTime)}</td>
                      <td className="px-2 py-2 text-slate-700">{formatNumber(item.slaBreached)}</td>
                      <td className="px-2 py-2 text-slate-700">{formatNumber(item.loggedMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};
