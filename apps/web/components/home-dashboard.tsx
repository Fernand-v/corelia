"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { HomeDashboard } from "@corelia/types";
import type { Route } from "next";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";
import { AnnouncementContent } from "@/components/announcement-content";

const availabilityLabel: Record<string, string> = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  EN_REUNION: "En reunión",
  AUSENTE: "Ausente"
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", {
    dateStyle: "medium"
  });

const formatRelative = (value: string) => {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMin = Math.round((then - now) / 60000);
  const absMin = Math.abs(diffMin);
  if (absMin < 1) return "ahora";
  if (absMin < 60) return diffMin < 0 ? `hace ${absMin} min` : `en ${absMin} min`;
  const hours = Math.round(absMin / 60);
  if (hours < 24) return diffMin < 0 ? `hace ${hours} h` : `en ${hours} h`;
  const days = Math.round(hours / 24);
  return diffMin < 0 ? `hace ${days} d` : `en ${days} d`;
};

const summarizeNotification = (body: string, maxLength = 140) => {
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

type AvailabilityTone = { dot: string; text: string; bg: string };
const defaultAvailabilityTone: AvailabilityTone = {
  dot: "bg-slate-400",
  text: "text-slate-600",
  bg: "bg-slate-100 border-slate-200"
};
const availabilityTone: Record<string, AvailabilityTone> = {
  DISPONIBLE: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200/70" },
  OCUPADO: { dot: "bg-accent", text: "text-accent", bg: "bg-accent-muted border-accent/20" },
  EN_REUNION: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200/70" },
  AUSENTE: defaultAvailabilityTone
};

const contextLabel = (dashboard: HomeDashboard) => {
  const context = dashboard.activeContext;
  if (context.type === "PROYECTO") return context.projectName ? `Proyecto · ${context.projectName}` : "Proyecto";
  if (context.type === "EQUIPO") return context.teamName ? `Equipo · ${context.teamName}` : "Equipo";
  if (context.type === "EXTERNO") return "Acceso externo";
  return "Organización global";
};

// ---------- Primitives ----------

const SectionTitle = ({
  children,
  subtitle,
  action
}: {
  children: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      <h2 className="text-sm font-semibold tracking-tight text-slate-800">{children}</h2>
      {subtitle ? <p className="text-[11px] text-slate-400">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);

const Stat = ({
  label,
  value,
  tone = "default",
  icon
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "warning" | "success" | "accent";
  icon?: React.ReactNode;
}) => {
  const toneClasses: Record<string, string> = {
    default: "text-slate-900",
    danger: "text-red-600",
    warning: "text-amber-600",
    success: "text-emerald-600",
    accent: "text-accent"
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-glass-border bg-white/70 p-4 shadow-sm backdrop-blur-sm transition-all duration-150 hover:bg-white/90 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{label}</p>
        {icon ? <span className="text-slate-300 group-hover:text-slate-400 transition-colors">{icon}</span> : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
};

const Pill = ({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "warning" | "success" | "accent";
}) => {
  const tones: Record<string, string> = {
    neutral: "border-slate-200 bg-white/70 text-slate-600",
    danger: "border-red-100 bg-red-50/80 text-red-600",
    warning: "border-amber-100 bg-amber-50/80 text-amber-700",
    success: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
    accent: "border-accent/20 bg-accent-muted text-accent"
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
};

const ProgressRing = ({ value, size = 44 }: { value: number; size?: number }) => {
  const safe = Math.max(0, Math.min(100, value));
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = safe >= 80 ? "#10b981" : safe >= 50 ? "#f59e0b" : "#6366f1";
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={c - (safe / 100) * c}
        strokeLinecap="round"
        className="transition-all duration-700 ease-macos"
      />
    </svg>
  );
};

const ProgressBar = ({ value, tone }: { value: number; tone?: "auto" | "accent" }) => {
  const safe = Math.max(0, Math.min(100, value));
  const color =
    tone === "accent"
      ? "bg-accent"
      : safe >= 80
        ? "bg-emerald-500"
        : safe >= 50
          ? "bg-amber-500"
          : "bg-indigo-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-macos ${color}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
};

const EmptyState = ({ label, icon }: { label: string; icon?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/40 px-4 py-6 text-center">
    {icon ? <div className="text-slate-300">{icon}</div> : null}
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

// ---------- Icons ----------

const Icon = {
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8zM9 19a3 3 0 006 0" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M21 20v-2a4 4 0 00-3-3.87M10 7a4 4 0 11-8 0 4 4 0 018 0zM16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Folder: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  ),
  Alert: () => (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
      <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-10.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM8 12a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  Bolt: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  Inbox: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l3-8h12l3 8M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 13h5l1 2h6l1-2h5" />
    </svg>
  ),
  Doc: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" />
      <path strokeLinecap="round" d="M14 3v6h6" />
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  )
};

// ---------- Main ----------

export const HomeDashboardView = () => {
  const params = useSearchParams();
  const dashboardContext = getContextFromSearchParams(params);
  const projectId = dashboardContext.projectId;
  const teamId = dashboardContext.teamId;

  const query = useQuery<HomeDashboard, Error>({
    queryKey: ["home-dashboard", projectId, teamId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (projectId) qs.set("projectId", projectId);
      if (teamId) qs.set("teamId", teamId);
      const suffix = qs.toString();
      return apiRequest<HomeDashboard>(`/home${suffix ? `?${suffix}` : ""}`);
    }
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
      </div>
    );
  }

  if (query.error) {
    return (
      <Card className="border-red-200/70 bg-red-50/60">
        <p className="text-sm text-red-700">{query.error.message}</p>
      </Card>
    );
  }

  if (!query.data) {
    return (
      <Card>
        <p className="text-sm text-slate-600">No hay información disponible.</p>
      </Card>
    );
  }

  const dashboard = query.data;
  const blocks = dashboard.blocks;
  const canCreateAnnouncements =
    dashboard.role === "ADMINISTRADOR" ||
    dashboard.role === "LIDER_PROYECTO" ||
    dashboard.role === "COORDINADOR_EQUIPO";
  const roleDisplay = (dashboard as { roleDisplayName?: string }).roleDisplayName ?? dashboard.role;
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 6 ? "Buenas noches" : greetingHour < 12 ? "Buenos días" : greetingHour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      {/* ================ HERO ================ */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border bg-gradient-to-br from-white/90 via-white/75 to-accent-muted/50 p-6 shadow-panel backdrop-blur-header">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{greeting}</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {roleDisplay}
            </h1>
            <p className="text-sm text-slate-500">
              {dashboard.organizationName} <span className="mx-1.5 text-slate-300">·</span> {contextLabel(dashboard)}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Actualizado {formatRelative(dashboard.generatedAt)}
              </span>
            </p>
          </div>

          <Link
            href={"/notifications" as Route}
            className="group relative inline-flex items-center gap-2 rounded-2xl border border-glass-border bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-150 hover:bg-white/95 hover:shadow-md"
          >
            <Icon.Bell />
            <span>Notificaciones</span>
            {dashboard.unreadNotificationCount > 0 ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {dashboard.unreadNotificationCount}
              </span>
            ) : null}
          </Link>
        </div>

        {blocks.externalBanner ? (
          <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-800">
            <span className="mt-0.5 text-amber-600">
              <Icon.Alert />
            </span>
            <span>{blocks.externalBanner}</span>
          </div>
        ) : null}

        {dashboard.quickActions.length > 0 ? (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {dashboard.quickActions.map((action) => (
              <Link
                key={action.key}
                href={action.path as Route}
                className="inline-flex items-center gap-1.5 rounded-xl border border-glass-border bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all duration-100 hover:-translate-y-0.5 hover:bg-white hover:text-accent hover:shadow-md"
              >
                {action.label}
                <Icon.ArrowRight />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {/* ================ MI DÍA ================ */}
      {blocks.myDay ? (
        <section className="space-y-3">
          <SectionTitle subtitle="Lo que necesita tu atención hoy">Mi día</SectionTitle>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  <Icon.Clock />
                  Tareas de hoy o vencidas
                </p>
                <span className="text-[11px] text-slate-400">
                  {blocks.myDay.dueOrOverdueTasks.length} {blocks.myDay.dueOrOverdueTasks.length === 1 ? "tarea" : "tareas"}
                </span>
              </div>
              {blocks.myDay.dueOrOverdueTasks.length === 0 ? (
                <EmptyState label="Sin tareas urgentes para hoy." icon={<Icon.Clock />} />
              ) : (
                <ul className="space-y-2">
                  {blocks.myDay.dueOrOverdueTasks.slice(0, 8).map((task) => (
                    <li
                      key={task.id}
                      className={`group flex items-start gap-3 rounded-xl border bg-white/60 p-3 transition-colors duration-100 hover:bg-white/90 ${
                        task.overdue ? "border-red-200/60" : "border-glass-border"
                      }`}
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          task.overdue ? "bg-red-500" : "bg-accent"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{task.title}</p>
                          {task.overdue ? <Pill tone="danger">Vencida</Pill> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {task.projectName} <span className="text-slate-300">·</span> {task.status}
                          {task.dueDate ? (
                            <>
                              <span className="text-slate-300"> · </span>
                              {formatDateTime(task.dueDate)}
                            </>
                          ) : (
                            <>
                              <span className="text-slate-300"> · </span>
                              Sin fecha
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-3">
              <Card className="space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  <Icon.Calendar />
                  Próxima reunión
                </p>
                {blocks.myDay.nextMeeting ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-900">{blocks.myDay.nextMeeting.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(blocks.myDay.nextMeeting.startsAt)}{" "}
                      <span className="text-slate-400">({formatRelative(blocks.myDay.nextMeeting.startsAt)})</span>
                    </p>
                    {blocks.myDay.nextMeeting.projectName ? (
                      <p className="text-xs text-slate-500">{blocks.myDay.nextMeeting.projectName}</p>
                    ) : null}
                    <Link
                      href={blocks.myDay.nextMeeting.joinPath as Route}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors duration-100 hover:bg-accent-hover"
                    >
                      Unirme
                      <Icon.ArrowRight />
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Sin reuniones pendientes.</p>
                )}
              </Card>

              <Card className="space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  <Icon.Inbox />
                  Solicitudes pendientes
                </p>
                <p className="text-3xl font-semibold tabular-nums text-slate-900">
                  {blocks.myDay.pendingRequests.length}
                </p>
                {blocks.myDay.pendingRequests.length > 0 ? (
                  <Link
                    href={"/requests" as Route}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Revisar <Icon.ArrowRight />
                  </Link>
                ) : (
                  <p className="text-[11px] text-slate-400">Todo al día.</p>
                )}
              </Card>
            </div>
          </div>
        </section>
      ) : null}

      {/* ================ MIS PROYECTOS ================ */}
      {blocks.myProjects ? (
        <section className="space-y-3">
          <SectionTitle
            subtitle={`${blocks.myProjects.length} ${blocks.myProjects.length === 1 ? "proyecto" : "proyectos"}`}
          >
            Mis proyectos activos
          </SectionTitle>
          {blocks.myProjects.length === 0 ? (
            <EmptyState label="No hay proyectos asociados." icon={<Icon.Folder />} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {blocks.myProjects.map((project) => {
                const pct = project.completionPct;
                const pctColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-indigo-600";

                return (
                  <Link
                    key={project.projectId}
                    href={
                      withDashboardContext("/projects", {
                        projectId: project.projectId,
                        projectName: project.name,
                        teamId: teamId ?? null
                      }) as Route
                    }
                    className="group relative overflow-hidden rounded-2xl border border-glass-border bg-white/75 p-4 shadow-sm backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
                  >
                    {project.risk && (
                      <span className="absolute right-3 top-3 flex h-2.5 w-2.5" aria-label="Proyecto en riesgo">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                    )}

                    <div className="space-y-3">
                      <p className="pr-5 text-sm font-semibold text-slate-900 transition-colors group-hover:text-accent">
                        {project.name}
                      </p>

                      <div className="flex items-center gap-3">
                        <ProgressRing value={pct} />
                        <div>
                          <p className={`text-xl font-bold tabular-nums ${pctColor}`}>{pct}%</p>
                          <p className="text-[11px] text-slate-400">completado</p>
                        </div>
                      </div>

                      <ProgressBar value={pct} />

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {project.involvedBlockedTasks > 0 ? (
                          <Pill tone="danger">
                            <Icon.Alert />
                            {project.involvedBlockedTasks} bloqueadas
                          </Pill>
                        ) : (
                          <Pill tone="success">Sin bloqueos</Pill>
                        )}
                        {project.risk && <Pill tone="danger">Riesgo</Pill>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* ================ ACTIVIDAD RECIENTE ================ */}
      {blocks.recentActivity ? (
        <section className="space-y-3">
          <SectionTitle>Actividad reciente</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="space-y-3">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                <Icon.Bell />
                Notificaciones no leídas
              </p>
              {blocks.recentActivity.unreadNotifications.length === 0 ? (
                <EmptyState label="Sin notificaciones no leídas." />
              ) : (
                <ul className="space-y-2">
                  {blocks.recentActivity.unreadNotifications.slice(0, 5).map((notification) => (
                    <li key={notification.id}>
                      <Link
                        href={(notification.path.startsWith("/") ? notification.path : "/home") as Route}
                        className="block rounded-xl border border-glass-border bg-white/60 p-3 transition-colors duration-100 hover:bg-white/90"
                      >
                        <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                          {summarizeNotification(notification.body)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatRelative(notification.createdAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-3">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
                <Icon.Bolt />
                Cambios en tareas
              </p>
              {blocks.recentActivity.recentTaskChanges.length === 0 ? (
                <EmptyState label="Sin cambios recientes." />
              ) : (
                <ul className="space-y-1.5">
                  {blocks.recentActivity.recentTaskChanges.slice(0, 6).map((change) => (
                    <li
                      key={`${change.taskId}-${change.changedAt}`}
                      className="flex items-start gap-2 rounded-xl border border-glass-border bg-white/60 p-3"
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          change.changeType === "REASIGNACION" ? "bg-accent" : "bg-indigo-400"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{change.taskTitle}</p>
                        <p className="text-[11px] text-slate-500">
                          {change.changeType === "REASIGNACION" ? "Reasignación" : "Cambio de estado"}
                          <span className="text-slate-300"> · </span>
                          {formatRelative(change.changedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      ) : null}

      {/* ================ ANUNCIOS ================ */}
      {blocks.announcements ? (
        <section className="space-y-3">
          <SectionTitle
            action={
              <div className="flex items-center gap-2">
                <Link
                  href={"/announcements" as Route}
                  className="rounded-xl border border-glass-border bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm transition-colors duration-100 hover:bg-white"
                >
                  Ver todos
                </Link>
                {canCreateAnnouncements ? (
                  <Link
                    href={"/announcements/new" as Route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors duration-100 hover:bg-accent-hover"
                  >
                    <Icon.Plus />
                    Nuevo
                  </Link>
                ) : null}
              </div>
            }
          >
            Anuncios activos
          </SectionTitle>
          {blocks.announcements.length === 0 ? (
            <EmptyState label="No hay anuncios activos." icon={<Icon.Doc />} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {blocks.announcements.map((announcement) => (
                <li
                  key={announcement.id}
                  className="rounded-2xl border border-glass-border bg-white/70 p-4 shadow-sm backdrop-blur-sm transition-colors duration-100 hover:bg-white/90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{announcement.title}</p>
                    {announcement.isNew ? <Pill tone="accent">Nuevo</Pill> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    <AnnouncementContent
                      blocks={announcement.content?.blocks}
                      fallbackBody={announcement.body}
                      compact
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <Icon.Clock />
                    Expira {formatDate(announcement.expiresAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* ================ MI EQUIPO HOY ================ */}
      {blocks.teamToday ? (
        <section className="space-y-3">
          <SectionTitle>Mi equipo hoy</SectionTitle>
          {blocks.teamToday.length === 0 ? (
            <EmptyState label="No hay equipos asignados." icon={<Icon.Users />} />
          ) : (
            <div className="space-y-4">
              {blocks.teamToday.map((team) => (
                <Card key={team.teamId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted text-accent">
                      <Icon.Users />
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{team.teamName}</p>
                    <span className="text-[11px] text-slate-400">
                      {team.members.length} {team.members.length === 1 ? "miembro" : "miembros"}
                    </span>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {team.members.map((member) => {
                      const tone = availabilityTone[member.availability] ?? defaultAvailabilityTone;
                      return (
                        <li
                          key={member.userId}
                          className="rounded-xl border border-glass-border bg-white/60 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium text-slate-900">{member.fullName}</p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.bg} ${tone.text}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {availabilityLabel[member.availability]}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Capacidad</span>
                              <span className="tabular-nums">{member.capacityPct}%</span>
                            </div>
                            <ProgressBar value={member.capacityPct} />
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                            {member.overdueTasks > 0 ? (
                              <Pill tone="danger">{member.overdueTasks} vencidas</Pill>
                            ) : (
                              <span className="text-slate-400">Sin vencidas</span>
                            )}
                            {member.overloaded ? <Pill tone="warning">Sobrecarga</Pill> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ================ TAREAS SIN RESPONSABLE ================ */}
      {blocks.unassignedTasks ? (
        <section className="space-y-3">
          <SectionTitle subtitle="Asigna un responsable para desbloquearlas">Tareas sin responsable</SectionTitle>
          {blocks.unassignedTasks.length === 0 ? (
            <EmptyState label="No hay tareas sin responsable." />
          ) : (
            <Card>
              <ul className="divide-y divide-glass-border">
                {blocks.unassignedTasks.slice(0, 10).map((task) => (
                  <li key={task.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {task.projectName}
                        <span className="text-slate-300"> · </span>
                        {task.status}
                      </p>
                    </div>
                    <Link
                      href={
                        withDashboardContext("/tasks", {
                          projectId: task.projectId,
                          projectName: task.projectName,
                          teamId: teamId ?? null
                        }) as Route
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-glass-border bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors duration-100 hover:bg-white hover:text-accent"
                    >
                      Asignar
                      <Icon.ArrowRight />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}

      {/* ================ ESTADO DE PROYECTOS ================ */}
      {blocks.projectStatus ? (
        <section className="space-y-3">
          <SectionTitle>Estado de mis proyectos</SectionTitle>
          {blocks.projectStatus.length === 0 ? (
            <EmptyState label="No lideras proyectos activos." icon={<Icon.Folder />} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {blocks.projectStatus.map((project) => (
                <Card key={project.projectId} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                    {project.risk ? <Pill tone="danger">Riesgo</Pill> : <Pill tone="success">Saludable</Pill>}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Avance</span>
                      <span className="tabular-nums font-medium text-slate-700">{project.completionPct}%</span>
                    </div>
                    <ProgressBar value={project.completionPct} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-glass-border bg-white/60 px-2.5 py-1.5">
                      <p className="text-slate-400">Bloqueadas</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-slate-800">{project.blockedPct}%</p>
                    </div>
                    <div className="rounded-lg border border-glass-border bg-white/60 px-2.5 py-1.5">
                      <p className="text-slate-400">Próximo hito</p>
                      <p className="mt-0.5 truncate font-semibold text-slate-800">
                        {project.nextMilestone
                          ? `${project.nextMilestone.title} · ${project.nextMilestone.daysRemaining}d`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={
                      withDashboardContext("/projects", {
                        projectId: project.projectId,
                        projectName: project.name,
                        teamId: teamId ?? null
                      }) as Route
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Ver detalles <Icon.ArrowRight />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ================ DECISIONES PENDIENTES ================ */}
      {blocks.pendingDecisions ? (
        <section className="space-y-3">
          <SectionTitle subtitle="Esperan tu aprobación">Decisiones pendientes</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat
              label="Reasignaciones"
              value={blocks.pendingDecisions.reassignmentApprovals}
              tone={blocks.pendingDecisions.reassignmentApprovals > 0 ? "accent" : "default"}
              icon={<Icon.Users />}
            />
            <Stat
              label="Documentos"
              value={blocks.pendingDecisions.pendingProjectDocuments}
              tone={blocks.pendingDecisions.pendingProjectDocuments > 0 ? "accent" : "default"}
              icon={<Icon.Doc />}
            />
            <Stat
              label="Solicitudes"
              value={blocks.pendingDecisions.pendingTeamRequests}
              tone={blocks.pendingDecisions.pendingTeamRequests > 0 ? "accent" : "default"}
              icon={<Icon.Inbox />}
            />
          </div>
        </section>
      ) : null}

      {/* ================ ACTIVIDAD ORGANIZACIONAL ================ */}
      {blocks.organizationActivity ? (
        <section className="space-y-3">
          <SectionTitle>Actividad organizacional</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Nuevos usuarios (7d)"
              value={blocks.organizationActivity.newUsersLast7Days}
              tone="success"
              icon={<Icon.Users />}
            />
            <Stat label="Onboarding" value={blocks.organizationActivity.onboardingInProgress} icon={<Icon.Bolt />} />
            <Stat
              label="Offboarding"
              value={blocks.organizationActivity.pendingOffboardings}
              tone={blocks.organizationActivity.pendingOffboardings > 0 ? "warning" : "default"}
              icon={<Icon.Bolt />}
            />
            <Stat
              label="Invitados por expirar"
              value={blocks.organizationActivity.expiringGuestsNext7Days}
              tone={blocks.organizationActivity.expiringGuestsNext7Days > 0 ? "warning" : "default"}
              icon={<Icon.Clock />}
            />
          </div>
        </section>
      ) : null}

      {/* ================ RESUMEN OPERATIVO ================ */}
      {blocks.operationalSummary ? (
        <section className="space-y-3">
          <SectionTitle>Resumen operativo</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Proyectos activos"
              value={blocks.operationalSummary.activeProjects}
              icon={<Icon.Folder />}
            />
            <Stat label="Tareas activas" value={blocks.operationalSummary.activeTasks} icon={<Icon.Bolt />} />
            <Stat
              label="Tareas vencidas"
              value={blocks.operationalSummary.overdueTasks}
              tone={blocks.operationalSummary.overdueTasks > 0 ? "danger" : "default"}
              icon={<Icon.Alert />}
            />
            <Stat
              label="Automatizaciones fallidas (24h)"
              value={blocks.operationalSummary.failedAutomationsLast24h}
              tone={blocks.operationalSummary.failedAutomationsLast24h > 0 ? "danger" : "default"}
              icon={<Icon.Bolt />}
            />
          </div>

          <Card className="space-y-3">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-400">
              <Icon.Alert />
              Equipos con más bloqueos
            </p>
            {blocks.operationalSummary.teamsWithMoreBlockedTasks.length === 0 ? (
              <EmptyState label="Sin bloqueos reportados." />
            ) : (
              <ul className="space-y-1.5">
                {blocks.operationalSummary.teamsWithMoreBlockedTasks.map((team) => (
                  <li
                    key={team.teamId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-white/60 px-3 py-2"
                  >
                    <p className="truncate text-sm font-medium text-slate-900">{team.teamName}</p>
                    <Pill tone="danger">
                      <Icon.Alert />
                      {team.blockedTasks} bloqueadas
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      ) : null}

      {/* ================ RECURSOS COMPARTIDOS ================ */}
      {blocks.sharedResources ? (
        <section className="space-y-3">
          <SectionTitle>Recursos compartidos</SectionTitle>
          {blocks.sharedResources.length === 0 ? (
            <EmptyState label="No tienes recursos compartidos activos." icon={<Icon.Doc />} />
          ) : (
            <Card>
              <ul className="divide-y divide-glass-border">
                {blocks.sharedResources.map((resource) => (
                  <li key={resource.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                      <Icon.Doc />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {resource.resourceScopeType}
                        <span className="ml-1 text-slate-400">· {resource.resourceScopeId.slice(0, 8)}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Expira {formatDateTime(resource.expiresAt)}
                        {resource.contactName ? (
                          <>
                            <span className="text-slate-300"> · </span>
                            Responsable: {resource.contactName}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}
    </div>
  );
};
