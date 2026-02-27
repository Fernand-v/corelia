"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { HomeDashboard } from "@corelia/types";
import type { Route } from "next";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
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
    return "text-blue-700 bg-blue-50 border-blue-200";
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-slate-900" style={{ width: `${safe}%` }} />
    </div>
  );
};

export const HomeDashboardView = () => {
  const params = useSearchParams();
  const projectId = params.get("projectId");
  const teamId = params.get("teamId");
  const [entryAnnouncementId, setEntryAnnouncementId] = useState<string | null>(null);

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

  const announcementSource = query.data?.blocks.announcements;
  const announcements = useMemo(() => announcementSource ?? [], [announcementSource]);
  const entryAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === entryAnnouncementId) ?? null,
    [announcements, entryAnnouncementId]
  );

  useEffect(() => {
    if (announcements.length === 0 || typeof window === "undefined") {
      setEntryAnnouncementId(null);
      return;
    }

    const raw = window.localStorage.getItem("corelia_seen_announcements_v1");
    const seenIds = new Set(
      raw
        ? raw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : []
    );

    const candidate =
      announcements.find((announcement) => announcement.isNew && !seenIds.has(announcement.id)) ??
      announcements.find((announcement) => !seenIds.has(announcement.id)) ??
      null;

    setEntryAnnouncementId(candidate?.id ?? null);
  }, [announcements]);

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

  const dismissEntryAnnouncement = () => {
    if (!entryAnnouncement || typeof window === "undefined") {
      setEntryAnnouncementId(null);
      return;
    }

    const raw = window.localStorage.getItem("corelia_seen_announcements_v1");
    const seenIds = new Set(
      raw
        ? raw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : []
    );
    seenIds.add(entryAnnouncement.id);
    window.localStorage.setItem("corelia_seen_announcements_v1", [...seenIds].join(","));
    setEntryAnnouncementId(null);
  };

  return (
    <div className="space-y-6">
      {entryAnnouncement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <article className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Anuncio al ingresar</p>
                <h2 className="text-xl font-semibold text-slate-900">{entryAnnouncement.title}</h2>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={dismissEntryAnnouncement}
              >
                Cerrar
              </button>
            </div>
            <AnnouncementContent
              blocks={entryAnnouncement.content?.blocks}
              fallbackBody={entryAnnouncement.body}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Link
                href={"/announcements" as Route}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Ver todos los anuncios
              </Link>
              <Button type="button" className="h-9 px-3 text-xs" onClick={dismissEntryAnnouncement}>
                Entendido
              </Button>
            </div>
          </article>
        </div>
      ) : null}

      <Card className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Home</p>
        <h1 className="text-2xl font-semibold text-slate-900">{roleLabel[dashboard.role]}</h1>
        <p className="text-sm text-slate-600">
          {dashboard.organizationName} · {contextLabel(dashboard)}
        </p>
        <p className="text-xs text-slate-500">
          Actualizado: {formatDateTime(dashboard.generatedAt)} · Notificaciones sin leer:{" "}
          {dashboard.unreadNotificationCount}
        </p>
      </Card>

      {blocks.externalBanner ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">{blocks.externalBanner}</p>
        </Card>
      ) : null}

      {dashboard.quickActions.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-2">
            {dashboard.quickActions.map((action) => (
              <Link
                key={action.key}
                href={action.path as Route}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {blocks.myDay ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Mi día</h2>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tareas de hoy o vencidas</p>
            {blocks.myDay.dueOrOverdueTasks.length === 0 ? (
              <p className="text-sm text-slate-600">Sin tareas urgentes para hoy.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.myDay.dueOrOverdueTasks.slice(0, 8).map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-600">
                      {task.projectName} · {task.status} ·{" "}
                      {task.dueDate ? formatDateTime(task.dueDate) : "Sin fecha"}
                    </p>
                    {task.overdue ? (
                      <p className="mt-1 inline-flex rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        Vencida
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
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
                    className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline"
                  >
                    Unirme
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Sin reuniones pendientes.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
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
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Mis proyectos activos</h2>
          {blocks.myProjects.length === 0 ? (
            <p className="text-sm text-slate-600">No hay proyectos asociados.</p>
          ) : (
            <ul className="space-y-3">
              {blocks.myProjects.map((project) => (
                <li key={project.projectId} className="space-y-1 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-900">{project.name}</p>
                    <p className="text-xs text-slate-600">{project.completionPct}% completado</p>
                  </div>
                  <ProgressBar value={project.completionPct} />
                  <p className="text-xs text-slate-600">
                    Bloqueadas que me involucran: {project.involvedBlockedTasks}
                  </p>
                  <Link
                    href={`/projects?projectId=${project.projectId}` as Route}
                    className="inline-flex rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Abrir recursos del proyecto
                  </Link>
                  {project.risk ? (
                    <p className="inline-flex rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      Riesgo alto
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {blocks.recentActivity ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Actividad reciente</h2>

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
                      className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                      <p className="text-xs text-slate-600">{notification.body}</p>
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
                  <li key={`${change.taskId}-${change.changedAt}`} className="rounded-xl border border-slate-200 p-3">
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
          <h2 className="text-lg font-semibold text-slate-900">Anuncios activos</h2>
          {blocks.announcements.length === 0 ? (
            <p className="text-sm text-slate-600">No hay anuncios activos.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.announcements.map((announcement) => (
                <li key={announcement.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{announcement.title}</p>
                    {announcement.isNew ? (
                      <span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
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
          <h2 className="text-lg font-semibold text-slate-900">Mi equipo hoy</h2>
          {blocks.teamToday.length === 0 ? (
            <p className="text-sm text-slate-600">No hay equipos asignados.</p>
          ) : (
            <div className="space-y-4">
              {blocks.teamToday.map((team) => (
                <div key={team.teamId} className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{team.teamName}</p>
                  <ul className="space-y-2">
                    {team.members.map((member) => (
                      <li key={member.userId} className="rounded-xl border border-slate-200 p-3">
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
                          <p className="mt-1 inline-flex rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
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
          <h2 className="text-lg font-semibold text-slate-900">Tareas sin responsable</h2>
          {blocks.unassignedTasks.length === 0 ? (
            <p className="text-sm text-slate-600">No hay tareas sin responsable.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.unassignedTasks.slice(0, 10).map((task) => (
                <li key={task.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-600">
                    {task.projectName} · {task.status}
                  </p>
                  <Link
                    href={`/tasks?projectId=${task.projectId}` as Route}
                    className="text-xs font-medium text-blue-700 hover:underline"
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
          <h2 className="text-lg font-semibold text-slate-900">Estado de mis proyectos</h2>
          {blocks.projectStatus.length === 0 ? (
            <p className="text-sm text-slate-600">No lideras proyectos activos.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.projectStatus.map((project) => (
                <li key={project.projectId} className="space-y-1 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{project.name}</p>
                    {project.risk ? (
                      <span className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
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
                    href={`/projects?projectId=${project.projectId}` as Route}
                    className="inline-flex rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
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
          <h2 className="text-lg font-semibold text-slate-900">Decisiones pendientes</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reasignaciones</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.pendingDecisions.reassignmentApprovals}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Documentos</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.pendingDecisions.pendingProjectDocuments}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Solicitudes</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.pendingDecisions.pendingTeamRequests}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {blocks.systemState ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Estado del sistema</h2>
          <p className="text-xs text-slate-500">Actualizado: {formatDateTime(blocks.systemState.now)}</p>
          <ul className="space-y-2">
            {blocks.systemState.services.map((service) => (
              <li
                key={service.service}
                className={`flex items-center justify-between rounded-xl border p-3 ${toneForStatus(
                  service.status
                )}`}
              >
                <p className="text-sm font-medium">{serviceLabel[service.service] ?? service.service}</p>
                <p className="text-xs">{statusLabel[service.status] ?? service.status}</p>
              </li>
            ))}
          </ul>
          <a
            href={blocks.systemState.grafanaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Ir a Grafana
          </a>
        </Card>
      ) : null}

      {blocks.organizationActivity ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Actividad organizacional</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Nuevos usuarios</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.newUsersLast7Days}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Onboarding</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.onboardingInProgress}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Offboarding</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.organizationActivity.pendingOffboardings}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
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
          <h2 className="text-lg font-semibold text-slate-900">Resumen operativo</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Proyectos activos</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.activeProjects}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tareas activas</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.activeTasks}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tareas vencidas</p>
              <p className="text-2xl font-semibold text-slate-900">
                {blocks.operationalSummary.overdueTasks}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
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
                  <li key={team.teamId} className="rounded-xl border border-slate-200 p-3">
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
          <h2 className="text-lg font-semibold text-slate-900">Recursos compartidos</h2>
          {blocks.sharedResources.length === 0 ? (
            <p className="text-sm text-slate-600">No tienes recursos compartidos activos.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.sharedResources.map((resource) => (
                <li key={resource.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {resource.resourceType} · {resource.resourceId.slice(0, 8)}
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
