"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReportsExecutiveResponse, RoleCode } from "@corelia/types";
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
  LIDER_PROYECTO: "Lider de Proyecto",
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

const formatPct = (value: number) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)}%`;

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

const pctColor = (value: number): string => {
  if (value >= 80) return "text-emerald-600";
  if (value >= 50) return "text-amber-600";
  return "text-red-600";
};

const pctBgColor = (value: number): string => {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
};

const loadBarColor = (pct: number): string => {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-blue-500";
};

/* ────────────────────────────────────────
   Sparkline — lightweight SVG mini-chart
   ──────────────────────────────────────── */
const Sparkline = ({
  data,
  color = "#6366f1",
  height = 40,
  width = 200
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) => {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} fillOpacity="0.1" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ────────────────────────────────────────
   KPI Card
   ──────────────────────────────────────── */
const KpiCard = ({
  icon,
  label,
  value,
  subtitle,
  accent = "indigo",
  sparkData
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accent?: "indigo" | "emerald" | "amber" | "blue";
  sparkData?: number[];
}) => {
  const accents = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", ring: "ring-indigo-100", spark: "#6366f1" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", spark: "#10b981" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100", spark: "#f59e0b" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100", spark: "#3b82f6" }
  };
  const a = accents[accent];

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.bg} ring-1 ${a.ring}`}>
          <span className={a.text}>{icon}</span>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="w-24 opacity-80">
            <Sparkline data={sparkData} color={a.spark} height={32} width={96} />
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────
   Progress Ring (donut)
   ──────────────────────────────────────── */
const ProgressRing = ({ value, size = 48, strokeWidth = 5 }: { value: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={clamped >= 80 ? "#10b981" : clamped >= 50 ? "#f59e0b" : "#ef4444"}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
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
  const [showFilters, setShowFilters] = useState(false);

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
      const filename = `reporte-ejecutivo-${new Date().toISOString().slice(0, 10)}.${format}`;
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
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (session.error || !session.data) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
        <p className="text-sm text-red-600">{session.error?.message ?? "No se pudo cargar la sesion."}</p>
      </div>
    );
  }

  if (!roleCanAccessReports) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">Tu rol no tiene acceso a este modulo.</p>
      </div>
    );
  }

  const report = reportQuery.data;
  const projectOptions = report?.scope.projects ?? [];
  const teamOptions = report?.scope.teams ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-6 shadow-lg text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 opacity-80">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <h1 className="text-xl font-bold">Reporte Ejecutivo</h1>
            </div>
            <p className="text-sm text-indigo-200">
              {roleLabel[session.data.activeRole]} — KPIs de productividad, SLA, carga y avance
            </p>
            {report && (
              <p className="text-xs text-indigo-300 mt-1">
                Generado: {formatDateTime(report.generatedAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
              </svg>
              Filtros
            </button>
            <button
              type="button"
              disabled={Boolean(downloading) || reportQuery.isLoading || !report}
              onClick={() => downloadReport("pdf")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              {downloading === "pdf" ? "..." : "PDF"}
            </button>
            <button
              type="button"
              disabled={Boolean(downloading) || reportQuery.isLoading || !report}
              onClick={() => downloadReport("xlsx")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              {downloading === "xlsx" ? "..." : "XLSX"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desde</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors"
                value={filters.from}
                onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hasta</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors"
                value={filters.to}
                onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyecto</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors"
                value={filters.projectId}
                onChange={(e) => setFilters((c) => ({ ...c, projectId: e.target.value }))}
              >
                <option value="">Todos</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equipo</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors"
                value={filters.teamId}
                onChange={(e) => setFilters((c) => ({ ...c, teamId: e.target.value }))}
              >
                <option value="">Todos</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAppliedFilters(filters)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters(defaultFilters);
                setAppliedFilters(defaultFilters);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Limpiar
            </button>
            {report && (
              <p className="ml-auto text-xs text-slate-400">
                Rango: {formatDateTime(report.range.from)} — {formatDateTime(report.range.to)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {reportQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      )}

      {/* Error */}
      {reportQuery.error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-500 shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{reportQuery.error.message}</p>
        </div>
      )}

      {report && (
        <>
          {/* KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              accent="indigo"
              label="Productividad"
              value={formatPct(report.blocks.productivity.completionRate)}
              subtitle={`${formatNumber(report.blocks.productivity.tasksCompleted)} de ${formatNumber(report.blocks.productivity.tasksCreated)} tareas`}
              sparkData={report.blocks.series.daily.map((d) => d.completed)}
              icon={
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              }
            />
            <KpiCard
              accent="emerald"
              label="SLA"
              value={formatPct(report.blocks.sla.slaPct)}
              subtitle={`${formatNumber(report.blocks.sla.onTime)} a tiempo de ${formatNumber(report.blocks.sla.evaluated)}`}
              sparkData={report.blocks.series.daily.map((d) => d.slaOnTime)}
              icon={
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                </svg>
              }
            />
            <KpiCard
              accent="amber"
              label="Carga de trabajo"
              value={formatPct(report.blocks.workload.loadPct)}
              subtitle={`${formatNumber(report.blocks.workload.activeTasksNow)} activas / ${formatNumber(report.blocks.workload.capacitySlots)} capacidad`}
              icon={
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                </svg>
              }
            />
            <KpiCard
              accent="blue"
              label="Tiempo registrado"
              value={`${formatNumber(report.blocks.productivity.totalLoggedMinutes)} min`}
              subtitle={`Ciclo promedio: ${formatNumber(report.blocks.productivity.avgCycleHours)} h`}
              sparkData={report.blocks.series.daily.map((d) => d.loggedMinutes)}
              icon={
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h4.59l-2.1 1.95a.75.75 0 001.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 10-1.02 1.1l2.1 1.95H6.75z" clipRule="evenodd" />
                </svg>
              }
            />
          </div>

          {/* Extra SLA/workload stats row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <ProgressRing value={report.blocks.sla.slaPct} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">SLA cumplido</p>
                <p className={`text-lg font-bold tabular-nums ${pctColor(report.blocks.sla.slaPct)}`}>{formatPct(report.blocks.sla.slaPct)}</p>
                <p className="text-xs text-slate-500">{formatNumber(report.blocks.sla.breached)} incumplidas</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <ProgressRing value={report.blocks.productivity.completionRate} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Tasa de cierre</p>
                <p className={`text-lg font-bold tabular-nums ${pctColor(report.blocks.productivity.completionRate)}`}>{formatPct(report.blocks.productivity.completionRate)}</p>
                <p className="text-xs text-slate-500">{formatNumber(report.blocks.productivity.tasksCompleted)} completadas</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <ProgressRing value={Math.min(report.blocks.workload.loadPct, 100)} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Capacidad usada</p>
                <p className={`text-lg font-bold tabular-nums ${report.blocks.workload.loadPct > 100 ? "text-red-600" : "text-slate-900"}`}>{formatPct(report.blocks.workload.loadPct)}</p>
                <p className="text-xs text-slate-500">{formatNumber(report.blocks.workload.overloadedCount)} sobrecargados</p>
              </div>
            </div>
          </div>

          {/* Project progress */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-indigo-500">
                  <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
                </svg>
                Avance por proyecto
              </h2>
            </div>
            {report.blocks.progressByClient.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No hay proyectos en el alcance actual.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {report.blocks.progressByClient.map((item) => (
                  <div key={item.projectId} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-800">{item.projectName}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500">{formatNumber(item.completedTasks)}/{formatNumber(item.totalTasks)} tareas</span>
                        <span className={`font-bold tabular-nums ${pctColor(item.completionPct)}`}>{formatPct(item.completionPct)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pctBgColor(item.completionPct)}`}
                        style={{ width: `${Math.min(item.completionPct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>SLA: <span className={`font-semibold ${pctColor(item.slaPct)}`}>{formatPct(item.slaPct)}</span></span>
                      {item.overdueOpenTasks > 0 && (
                        <span className="text-red-600 font-medium">{formatNumber(item.overdueOpenTasks)} vencidas</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team + User workload */}
          {session.data.activeRole !== "COLABORADOR" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Teams */}
              <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-500">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                    </svg>
                    Carga por equipo
                  </h2>
                </div>
                {report.blocks.workload.byTeam.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No hay equipos en el alcance.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {report.blocks.workload.byTeam.map((team) => (
                      <div key={team.teamId} className="p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-semibold text-slate-800">{team.teamName}</p>
                          <span className={`text-xs font-bold tabular-nums ${team.loadPct >= 100 ? "text-red-600" : team.loadPct >= 80 ? "text-amber-600" : "text-blue-600"}`}>
                            {formatPct(team.loadPct)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${loadBarColor(team.loadPct)}`}
                            style={{ width: `${Math.min(team.loadPct, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{formatNumber(team.activeTasksNow)} activas</span>
                          <span>{formatNumber(team.capacitySlots)} capacidad</span>
                          {team.overloadedCount > 0 && (
                            <span className="text-red-500 font-medium">{team.overloadedCount} sobrecargados</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Users */}
              <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-blue-500">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                    Carga por usuario
                  </h2>
                </div>
                {report.blocks.workload.byUser.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No hay usuarios en el alcance.</div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {report.blocks.workload.byUser.slice(0, 30).map((user) => (
                      <div key={user.userId} className="p-4 flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${user.overloaded ? "bg-red-500" : "bg-indigo-500"}`}>
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-800 truncate">{user.fullName}</p>
                            <span className={`text-xs font-bold tabular-nums ml-2 shrink-0 ${user.overloaded ? "text-red-600" : "text-slate-600"}`}>
                              {formatPct(user.loadPct)}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${loadBarColor(user.loadPct)}`}
                              style={{ width: `${Math.min(user.loadPct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{user.teamName ?? "Sin equipo"} — {formatNumber(user.activeTasksNow)}/{formatNumber(user.capacitySlots)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Carga personal</h2>
              {report.blocks.workload.byUser[0] ? (
                <div className="flex items-center gap-4">
                  <ProgressRing value={Math.min(report.blocks.workload.byUser[0].loadPct, 100)} size={56} />
                  <div>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{formatPct(report.blocks.workload.byUser[0].loadPct)}</p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(report.blocks.workload.byUser[0].activeTasksNow)} activas / {formatNumber(report.blocks.workload.byUser[0].capacitySlots)} capacidad
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No hay datos de carga personal.</p>
              )}
            </div>
          )}

          {/* Budget */}
          {report.blocks.budget && report.blocks.budget.byProject.length > 0 && (
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-500">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95a.75.75 0 001.192-.91C12.637 5.55 11.596 5 10.5 5s-2.137.55-2.894 1.54A5.205 5.205 0 006.83 8H5.75a.75.75 0 000 1.5h.77a6.333 6.333 0 000 1h-.77a.75.75 0 000 1.5h1.08c.183.528.442 1.023.776 1.46.757.99 1.798 1.54 2.894 1.54s2.137-.55 2.894-1.54a.75.75 0 00-1.192-.91c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95a3.505 3.505 0 01-.343-.55h1.795a.75.75 0 000-1.5H8.026a4.835 4.835 0 010-1h2.224a.75.75 0 000-1.5H8.455c.098-.195.212-.38.343-.55z" clipRule="evenodd" />
                  </svg>
                  Presupuesto por proyecto
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 font-semibold">Proyecto</th>
                      <th className="px-5 py-3 font-semibold">Estimado</th>
                      <th className="px-5 py-3 font-semibold">Aprobado</th>
                      <th className="px-5 py-3 font-semibold">Pendiente</th>
                      <th className="px-5 py-3 font-semibold">Restante</th>
                      <th className="px-5 py-3 font-semibold">Ejecutado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.blocks.budget.byProject.map((item) => (
                      <tr key={item.projectId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{item.projectName}</td>
                        <td className="px-5 py-3 text-slate-700 tabular-nums">{formatNumber(item.totalEstimated)}</td>
                        <td className="px-5 py-3 text-emerald-700 font-medium tabular-nums">{formatNumber(item.totalApproved)}</td>
                        <td className="px-5 py-3 text-amber-600 font-medium tabular-nums">{formatNumber(item.totalPending)}</td>
                        <td className={`px-5 py-3 font-medium tabular-nums ${item.totalRemaining >= 0 ? "text-slate-700" : "text-red-600"}`}>
                          {formatNumber(item.totalRemaining)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.min(item.executionPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-600 tabular-nums w-12 text-right">{formatPct(item.executionPct)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-5 py-3 text-slate-900">Total</td>
                      <td className="px-5 py-3 text-slate-900 tabular-nums">{formatNumber(report.blocks.budget.totalEstimated)}</td>
                      <td className="px-5 py-3 text-emerald-700 tabular-nums">{formatNumber(report.blocks.budget.totalApproved)}</td>
                      <td className="px-5 py-3 text-amber-600 tabular-nums">{formatNumber(report.blocks.budget.totalPending)}</td>
                      <td className={`px-5 py-3 tabular-nums ${report.blocks.budget.totalRemaining >= 0 ? "text-slate-900" : "text-red-600"}`}>
                        {formatNumber(report.blocks.budget.totalRemaining)}
                      </td>
                      <td className="px-5 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Daily series — visual chart + collapsible table */}
          <DailySeriesSection daily={report.blocks.series.daily} />
        </>
      )}
    </div>
  );
};

/* ────────────────────────────────────────
   Daily Series Section with mini-chart
   ──────────────────────────────────────── */
type DailyItem = ReportsExecutiveResponse["blocks"]["series"]["daily"][number];

const DailySeriesSection = ({ daily }: { daily: DailyItem[] }) => {
  const [showTable, setShowTable] = useState(false);

  if (daily.length === 0) return null;

  const maxVal = Math.max(1, ...daily.map((d) => Math.max(d.created, d.completed, d.due)));

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-violet-500">
            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
          </svg>
          Serie diaria
        </h2>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          {showTable ? "Ocultar tabla" : "Ver tabla"}
        </button>
      </div>

      {/* Visual bar chart */}
      <div className="p-5">
        <div className="flex items-end gap-1 h-32 overflow-x-auto">
          {daily.map((day) => {
            const createdH = Math.max(2, (day.created / maxVal) * 100);
            const completedH = Math.max(2, (day.completed / maxVal) * 100);
            return (
              <div key={day.date} className="flex flex-col items-center gap-0.5 min-w-[18px] flex-1 group relative">
                <div className="flex items-end gap-px w-full justify-center" style={{ height: "100px" }}>
                  <div
                    className="w-2 rounded-t bg-indigo-400 transition-all duration-300 group-hover:bg-indigo-500"
                    style={{ height: `${createdH}%` }}
                    title={`Creadas: ${day.created}`}
                  />
                  <div
                    className="w-2 rounded-t bg-emerald-400 transition-all duration-300 group-hover:bg-emerald-500"
                    style={{ height: `${completedH}%` }}
                    title={`Completadas: ${day.completed}`}
                  />
                </div>
                {/* Tooltip on hover */}
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 rounded-lg bg-slate-800 text-white text-xs px-2 py-1.5 shadow-lg whitespace-nowrap">
                  <p className="font-semibold">{day.date}</p>
                  <p>Creadas: {day.created} | Completadas: {day.completed}</p>
                  <p>SLA ok: {day.slaOnTime} | SLA mal: {day.slaBreached}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Creadas
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Completadas
          </span>
        </div>
      </div>

      {/* Collapsible table */}
      {showTable && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Fecha</th>
                <th className="px-4 py-2.5 font-semibold">Creadas</th>
                <th className="px-4 py-2.5 font-semibold">Completadas</th>
                <th className="px-4 py-2.5 font-semibold">Vencian</th>
                <th className="px-4 py-2.5 font-semibold">SLA ok</th>
                <th className="px-4 py-2.5 font-semibold">SLA mal</th>
                <th className="px-4 py-2.5 font-semibold">Minutos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily.map((item) => (
                <tr key={item.date} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2 text-slate-700 font-medium">{item.date}</td>
                  <td className="px-4 py-2 text-slate-600 tabular-nums">{formatNumber(item.created)}</td>
                  <td className="px-4 py-2 text-slate-600 tabular-nums">{formatNumber(item.completed)}</td>
                  <td className="px-4 py-2 text-slate-600 tabular-nums">{formatNumber(item.due)}</td>
                  <td className="px-4 py-2 text-emerald-600 tabular-nums">{formatNumber(item.slaOnTime)}</td>
                  <td className="px-4 py-2 text-red-600 tabular-nums">{formatNumber(item.slaBreached)}</td>
                  <td className="px-4 py-2 text-slate-600 tabular-nums">{formatNumber(item.loggedMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
