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

const roleLabel: Record<HomeDashboard["role"], string> = {
  ADMINISTRADOR: "Administrador",
  LIDER_PROYECTO: "Líder de Proyecto",
  COORDINADOR_EQUIPO: "Coordinador de Equipo",
  COLABORADOR: "Colaborador",
  OBSERVADOR: "Observador",
  INVITADO_EXTERNO: "Invitado Externo"
};

const serviceLabel: Record<string, string> = {
  api: "API",
  postgres: "Base de datos",
  redis: "Redis",
  storage: "Almacenamiento",
  media: "VPN/Media"
};

const statusLabel: Record<string, string> = {
  up: "Operativo",
  degraded: "Degradado",
  down: "Caído"
};

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

const toneForStatus = (status: string) => {
  if (status === "down") {
    return "text-red-700 bg-red-50 border-red-200";
  }
  if (status === "degraded") {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

const toneForAvailability = (status: string) => {
  if (status === "AUSENTE") {
    return "text-red-700 bg-red-50 border-red-200";
  }
  if (status === "EN_REUNION") {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  if (status === "OCUPADO") {
    return "text-accent bg-accent-muted border-accent/20";
  }
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

const contextLabel = (dashboard: HomeDashboard) => {
  const context = dashboard.activeContext;

  if (context.type === "PROYECTO") {
    return context.projectName ? `Proyecto: ${context.projectName}` : "Proyecto";
  }

  if (context.type === "EQUIPO") {
    return context.teamName ? `Equipo: ${context.teamName}` : "Equipo";
  }

  if (context.type === "EXTERNO") {
    return "Acceso externo";
  }

  return "Organización global";
};

const ProgressBar = ({ value }: { value: number }) => {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-accent transition-all duration-500 ease-macos"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
};

export const HomeDashboardView = () => {
  const params = useSearchParams();
  const dashboardContext = getContextFromSearchParams(params);
  const projectId = dashboardContext.projectId;
  const teamId = dashboardContext.teamId;

  const query = useQuery<HomeDashboard, Error>({
    queryKey: ["home-dashboard", projectId, teamId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (projectId) {
        qs.set("projectId", projectId);
      }
      if (teamId) {
        qs.set("teamId", teamId);
      }

      const suffix = qs.toString();
      return apiRequest<HomeDashboard>(`/home${suffix ? `?${suffix}` : ""}`);
    }
  });

  if (query.isLoading) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Cargando home...</p>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card>
        <p className="text-sm text-red-600">{query.error.message}</p>
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

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <Card className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Home</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{roleLabel[dashboard.role]}</h1>
        <p className="text-sm text-slate-500">
          {dashboard.organizationName} · {contextLabel(dashboard)}
        </p>
        <p className="text-[11px] text-slate-400">
          Actualizado: {formatDateTime(dashboard.generatedAt)} · Notificaciones sin leer:{" "}
          <span className="font-semibold text-accent">{dashboard.unreadNotificationCount}</span>
        </p>
      </Card>

      {blocks.externalBanner ? (
        <Card className="border-amber-200/70 bg-amber-50/80">
          <p className="text-sm font-medium text-amber-700">{blocks.externalBanner}</p>
        </Card>
      ) : null}

      {dashboard.quickActions.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-2">
            {dashboard.quickActions.map((action) => (
              <Link
                key={action.key}
                href={action.path as Route}
                className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/60 px-3 py-1.5 text-sm text-slate-700 shadow-sm transition-colors duration-100 hover:bg-white/90"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {blocks.myDay ? (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Mi día</h2>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tareas de hoy o vencidas</p>
            {blocks.myDay.dueOrOverdueTasks.length === 0 ? (
              <p className="text-sm text-slate-600">Sin tareas urgentes para hoy.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.myDay.dueOrOverdueTasks.slice(0, 8).map((task) => (
                  <li key={task.id} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-600">
                      {task.projectName} · {task.status} ·{" "}
                      {task.dueDate ? formatDateTime(task.dueDate) : "Sin fecha"}
                    </p>
                    {task.overdue ? (
                      <p className="mt-1 inline-flex rounded-full border border-red-100 bg-red-50/80 px-2 py-0.5 text-[10px] font-medium text-red-500">
                        Vencida
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Próxima reunión</p>
              {blocks.myDay.nextMeeting ? (
                <>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {blocks.myDay.nextMeeting.title}
                  </p>
                  <p className="text-xs text-slate-600">
                    {formatDateTime(blocks.myDay.nextMeeting.startsAt)}
                  </p>
                  {blocks.myDay.nextMeeting.projectName ? (
                    <p className="text-xs text-slate-600">{blocks.myDay.nextMeeting.projectName}</p>
                  ) : null}
                  <Link
                    href={blocks.myDay.nextMeeting.joinPath as Route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                  >
                    Unirme
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Sin reuniones pendientes.</p>
              )}
            </div>

            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Solicitudes internas pendientes
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {blocks.myDay.pendingRequests.length}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {blocks.myProjects ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Mis proyectos activos</h2>
            <span className="text-xs text-slate-400">{blocks.myProjects.length} {blocks.myProjects.length === 1 ? "proyecto" : "proyectos"}</span>
          </div>
          {blocks.myProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-8 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-8 w-8 text-slate-300 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <p className="text-sm text-slate-500">No hay proyectos asociados.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {blocks.myProjects.map((project) => {
                const pct = project.completionPct;
                const pctColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-indigo-600";
                const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-indigo-500";

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
                    className="group relative rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-150 hover:shadow-md hover:border-indigo-200/60 hover:-translate-y-0.5"
                  >
                    {project.risk && (
                      <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                    )}

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors pr-4">
                          {project.name}
                        </p>
                      </div>

                      {/* Progress ring + percentage */}
                      <div className="flex items-center gap-3">
                        <svg width="40" height="40" className="shrink-0 -rotate-90">
                          <circle cx="20" cy="20" r="16" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                          <circle
                            cx="20"
                            cy="20"
                            r="16"
                            fill="none"
                            stroke={pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#6366f1"}
                            strokeWidth="4"
                            strokeDasharray={2 * Math.PI * 16}
                            strokeDashoffset={2 * Math.PI * 16 - (Math.min(pct, 100) / 100) * 2 * Math.PI * 16}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                          />
                        </svg>
                        <div>
                          <p className={`text-lg font-bold tabular-nums ${pctColor}`}>{pct}%</p>
                          <p className="text-[11px] text-slate-400">completado</p>
                        </div>
                      </div>

                      {/* Bottom bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-xs">
                        {project.involvedBlockedTasks > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-600 font-medium">
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                              <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-10.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zM8 12a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            {project.involvedBlockedTasks} bloqueadas
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin bloqueos</span>
                        )}
                        {project.risk && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-600 font-medium">
                            Riesgo
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {blocks.recentActivity ? (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Actividad reciente</h2>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Notificaciones no leídas</p>
            {blocks.recentActivity.unreadNotifications.length === 0 ? (
              <p className="text-sm text-slate-600">Sin notificaciones no leídas.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.recentActivity.unreadNotifications.slice(0, 5).map((notification) => (
                  <li key={notification.id}>
                    <Link
                      href={(notification.path.startsWith("/") ? notification.path : "/home") as Route}
                      className="block rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3 transition-colors duration-100 hover:bg-white/80"
                    >
                      <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                      <p className="text-xs text-slate-600">{summarizeNotification(notification.body)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cambios en tareas</p>
            {blocks.recentActivity.recentTaskChanges.length === 0 ? (
              <p className="text-sm text-slate-600">Sin cambios recientes.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.recentActivity.recentTaskChanges.slice(0, 6).map((change) => (
                  <li key={`${change.taskId}-${change.changedAt}`} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                    <p className="text-sm font-medium text-slate-900">{change.taskTitle}</p>
                    <p className="text-xs text-slate-600">
                      {change.changeType === "REASIGNACION" ? "Reasignación" : "Cambio de estado"} ·{" "}
                      {formatDateTime(change.changedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {blocks.announcements ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Anuncios activos</h2>
            <div className="flex items-center gap-2">
              <Link
                href={"/announcements" as Route}
                className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/60 px-3 py-1 text-xs text-slate-600 shadow-sm transition-colors duration-100 hover:bg-white/90"
              >
                Ver todos
              </Link>
              {canCreateAnnouncements ? (
                <Link
                  href={"/announcements/new" as Route}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors duration-100 hover:bg-accent-hover"
                >
                  Nuevo anuncio
                </Link>
              ) : null}
            </div>
          </div>
          {blocks.announcements.length === 0 ? (
            <p className="text-sm text-slate-600">No hay anuncios activos.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.announcements.map((announcement) => (
                <li key={announcement.id} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{announcement.title}</p>
                    {announcement.isNew ? (
                      <span className="rounded-full border border-accent/20 bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
                        Nuevo
                      </span>
                    ) : null}
                  </div>
                  <AnnouncementContent
                    blocks={announcement.content?.blocks}
                    fallbackBody={announcement.body}
                    compact
                  />
                  <p className="text-xs text-slate-500">Expira: {formatDate(announcement.expiresAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {blocks.teamToday ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Mi equipo hoy</h2>
          {blocks.teamToday.length === 0 ? (
            <p className="text-sm text-slate-600">No hay equipos asignados.</p>
          ) : (
            <div className="space-y-4">
              {blocks.teamToday.map((team) => (
                <div key={team.teamId} className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{team.teamName}</p>
                  <ul className="space-y-2">
                    {team.members.map((member) => (
                      <li key={member.userId} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{member.fullName}</p>
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-xs ${toneForAvailability(
                              member.availability
                            )}`}
                          >
                            {availabilityLabel[member.availability]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Vencidas: {member.overdueTasks} · Capacidad: {member.capacityPct}%
                        </p>
                        {member.overloaded ? (
                          <p className="mt-1 inline-flex rounded-full border border-red-100 bg-red-50/80 px-2 py-0.5 text-[10px] font-medium text-red-500">
                            Capacidad sobre 80%
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {blocks.unassignedTasks ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Tareas sin responsable</h2>
          {blocks.unassignedTasks.length === 0 ? (
            <p className="text-sm text-slate-600">No hay tareas sin responsable.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.unassignedTasks.slice(0, 10).map((task) => (
                <li key={task.id} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-600">
                    {task.projectName} · {task.status}
                  </p>
                  <Link
                    href={
                      withDashboardContext("/tasks", {
                        projectId: task.projectId,
                        projectName: task.projectName,
                        teamId: teamId ?? null
                      }) as Route
                    }
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Asignación rápida
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {blocks.projectStatus ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Estado de mis proyectos</h2>
          {blocks.projectStatus.length === 0 ? (
            <p className="text-sm text-slate-600">No lideras proyectos activos.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.projectStatus.map((project) => (
                <li key={project.projectId} className="space-y-1 rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{project.name}</p>
                    {project.risk ? (
                      <span className="rounded-full border border-red-100 bg-red-50/80 px-2 py-0.5 text-[10px] font-medium text-red-500">
                        Riesgo
                      </span>
                    ) : null}
                  </div>
                  <ProgressBar value={project.completionPct} />
                  <p className="text-xs text-slate-600">
                    Avance: {project.completionPct}% · Bloqueadas: {project.blockedPct}%
                  </p>
                  {project.nextMilestone ? (
                    <p className="text-xs text-slate-600">
                      Próximo hito: {project.nextMilestone.title} ({project.nextMilestone.daysRemaining} días)
                    </p>
                  ) : null}
                  <Link
                    href={
                      withDashboardContext("/projects", {
                        projectId: project.projectId,
                        projectName: project.name,
                        teamId: teamId ?? null
                      }) as Route
                    }
                    className="inline-flex rounded-xl border border-[rgba(0,0,0,0.08)] bg-white/60 px-2.5 py-1 text-xs text-slate-600 shadow-sm transition-colors duration-100 hover:bg-white/90"
                  >
                    Ver detalles del proyecto
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {blocks.pendingDecisions ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Decisiones pendientes</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reasignaciones</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.pendingDecisions.reassignmentApprovals}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Documentos</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.pendingDecisions.pendingProjectDocuments}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Solicitudes</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.pendingDecisions.pendingTeamRequests}
              </p>
            </div>
          </div>
        </Card>
      ) : null}


      {blocks.organizationActivity ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Actividad organizacional</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Nuevos usuarios</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.newUsersLast7Days}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Onboarding</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.onboardingInProgress}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Offboarding</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.pendingOffboardings}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Invitados por expirar</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.expiringGuestsNext7Days}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {blocks.operationalSummary ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Resumen operativo</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Proyectos activos</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.activeProjects}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tareas activas</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.activeTasks}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tareas vencidas</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.overdueTasks}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Automatizaciones fallidas</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.failedAutomationsLast24h}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Equipos con más bloqueos</p>
            {blocks.operationalSummary.teamsWithMoreBlockedTasks.length === 0 ? (
              <p className="text-sm text-slate-600">Sin bloqueos reportados.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.operationalSummary.teamsWithMoreBlockedTasks.map((team) => (
                  <li key={team.teamId} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                    <p className="text-sm font-medium text-slate-900">{team.teamName}</p>
                    <p className="text-xs text-slate-600">{team.blockedTasks} tareas bloqueadas</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {blocks.sharedResources ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Recursos compartidos</h2>
          {blocks.sharedResources.length === 0 ? (
            <p className="text-sm text-slate-600">No tienes recursos compartidos activos.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.sharedResources.map((resource) => (
                <li key={resource.id} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {resource.resourceScopeType} · {resource.resourceScopeId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-slate-600">Expira: {formatDateTime(resource.expiresAt)}</p>
                  {resource.contactName ? (
                    <p className="text-xs text-slate-600">Responsable: {resource.contactName}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
};
