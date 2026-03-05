"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SystemRole } from "@corelia/types";
import type { Route } from "next";
import { useAuthStore } from "@/lib/api";
import { useSession, useSessionMembershipSummary } from "@/lib/session";
import { EntryAnnouncementModal } from "@/components/entry-announcement-modal";
import { NotificationsBadge } from "@/components/notifications-badge";
import {
  getContextFromSearchParams,
  readStoredDashboardContext,
  saveStoredDashboardContext,
  withDashboardContext
} from "@/lib/context";

type NavItem = {
  label: string;
  href: string;
  roles: SystemRole[];
  disabled?: boolean;
  phase?: string;
  contextual?: boolean;
  requiresProjectContext?: boolean;
};

const ALL_ROLES: SystemRole[] = [
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR",
  "INVITADO_EXTERNO"
];

const INTERNAL_ROLES: SystemRole[] = [
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR"
];

const WORK_ROLES: SystemRole[] = [
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR"
];

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home", roles: ALL_ROLES, contextual: true },
  { label: "Mensajes", href: "/messaging", roles: WORK_ROLES },
  { label: "Mis Proyectos", href: "/projects", roles: WORK_ROLES, contextual: true },
  { label: "Anuncios", href: "/announcements", roles: ALL_ROLES },
  { label: "Mis Tareas", href: "/tasks", roles: WORK_ROLES, contextual: true },
  { label: "Calendario", href: "/calendar", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  { label: "Reuniones", href: "/meetings", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  { label: "Archivos", href: "/files", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  {
    label: "Documentos",
    href: "/documents",
    roles: WORK_ROLES,
    contextual: true,
    requiresProjectContext: true
  },
  {
    label: "Wiki",
    href: "/wiki",
    roles: INTERNAL_ROLES,
    disabled: true,
    phase: "Fase 2B"
  },
  { label: "Solicitudes", href: "/requests", roles: WORK_ROLES },
  { label: "Buscar", href: "/search", roles: INTERNAL_ROLES }
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Panel de Admin", href: "/admin/panel", roles: ["ADMINISTRADOR"] },
  { label: "Equipos", href: "/admin/teams", roles: ["ADMINISTRADOR"] },
  { label: "Estado del Sistema", href: "/admin/system", roles: ["ADMINISTRADOR"] }
];

const roleLabel: Record<SystemRole, string> = {
  ADMINISTRADOR: "Administrador",
  LIDER_PROYECTO: "Líder de Proyecto",
  COORDINADOR_EQUIPO: "Coordinador de Equipo",
  COLABORADOR: "Colaborador",
  OBSERVADOR: "Observador",
  INVITADO_EXTERNO: "Invitado Externo"
};

const formatContextLabel = (
  projectId: string | null,
  projectName: string | null,
  teamId: string | null
): string => {
  if (projectId) {
    if (projectName) {
      return `Proyecto ${projectName}`;
    }
    return `Proyecto ${projectId.slice(0, 8)}`;
  }

  if (teamId) {
    return `Equipo ${teamId.slice(0, 8)}`;
  }

  return "Global";
};

const includesRole = (item: NavItem, role: SystemRole) => item.roles.includes(role);

export const DashboardShell = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearAccessToken = useAuthStore((state) => state.clearAccessToken);

  const session = useSession();
  const memberships = useSessionMembershipSummary();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [storedDashboardContext, setStoredDashboardContext] = useState(() =>
    typeof window === "undefined" ? {} : readStoredDashboardContext()
  );
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login" as Route);
      return;
    }

    if (session.error) {
      clearAccessToken();
      router.replace("/login" as Route);
    }
  }, [accessToken, clearAccessToken, hydrated, router, session.error]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (userMenuRef.current?.contains(target)) {
        return;
      }

      setUserMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  const activeRole = session.data?.activeRole;
  const queryContext = getContextFromSearchParams(params);
  const dashboardContext = useMemo(
    () => ({
      projectId: queryContext.projectId ?? storedDashboardContext.projectId ?? null,
      projectName: queryContext.projectName ?? storedDashboardContext.projectName ?? null,
      teamId: queryContext.teamId ?? storedDashboardContext.teamId ?? null
    }),
    [
      queryContext.projectId,
      queryContext.projectName,
      queryContext.teamId,
      storedDashboardContext.projectId,
      storedDashboardContext.projectName,
      storedDashboardContext.teamId
    ]
  );

  useEffect(() => {
    if (!queryContext.projectId && !queryContext.projectName && !queryContext.teamId) {
      return;
    }

    const mergedContext = {
      projectId: queryContext.projectId ?? storedDashboardContext.projectId ?? null,
      projectName: queryContext.projectName ?? storedDashboardContext.projectName ?? null,
      teamId: queryContext.teamId ?? storedDashboardContext.teamId ?? null
    };

    saveStoredDashboardContext(mergedContext);
    setStoredDashboardContext(mergedContext);
  }, [
    queryContext.projectId,
    queryContext.projectName,
    queryContext.teamId,
    storedDashboardContext.projectId,
    storedDashboardContext.projectName,
    storedDashboardContext.teamId
  ]);

  const visibleItems = useMemo(() => {
    if (!activeRole) {
      return [];
    }

    const hasProjectContext = Boolean(dashboardContext.projectId);

    return NAV_ITEMS.filter((item) => {
      if (!includesRole(item, activeRole)) {
        return false;
      }

      if (
        !hasProjectContext &&
        item.href !== "/home" &&
        item.href !== "/projects" &&
        item.href !== "/messaging" &&
        item.href !== "/announcements" &&
        item.href !== "/tasks"
      ) {
        return false;
      }

      if (item.requiresProjectContext && !dashboardContext.projectId) {
        return false;
      }

      return true;
    });
  }, [activeRole, dashboardContext.projectId]);

  const adminItems = useMemo(() => {
    if (!activeRole) {
      return [];
    }

    return ADMIN_ITEMS.filter((item) => includesRole(item, activeRole));
  }, [activeRole]);

  if (!hydrated || (accessToken && session.isLoading)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
        <p className="text-sm text-slate-600">Cargando sesión...</p>
      </main>
    );
  }

  if (!accessToken || !activeRole) {
    return null;
  }

  const contextLabel = formatContextLabel(
    dashboardContext.projectId ?? null,
    dashboardContext.projectName ?? null,
    dashboardContext.teamId ?? null
  );
  const fullName = `${session.data?.firstName ?? ""} ${session.data?.lastName ?? ""}`.trim();
  const projectCount = memberships.data?.projects.length ?? 0;
  const teamCount = memberships.data?.teams.length ?? 0;
  const topProjects = memberships.data?.projects.slice(0, 2).map((item) => item.name) ?? [];
  const topTeams = memberships.data?.teams.slice(0, 2).map((item) => item.name) ?? [];

  const handleSignOut = () => {
    clearAccessToken();
    setUserMenuOpen(false);
    router.replace("/login" as Route);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <EntryAnnouncementModal enabled={hydrated && Boolean(accessToken) && Boolean(session.data)} />
      <aside className="hidden border-r border-slate-200/80 bg-white/80 px-4 py-6 backdrop-blur lg:block">
        <div className="mb-6 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organización</p>
          <h1 className="text-xl font-semibold text-slate-900">Corelia</h1>
          <p className="text-xs text-slate-600">Rol activo: {roleLabel[activeRole]}</p>
        </div>

        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                >
                  <span>{item.label}</span>
                  <span className="text-xs">{item.phase}</span>
                </div>
              );
            }

            const href = item.contextual ? withDashboardContext(item.href, dashboardContext) : item.href;

            return (
              <Link
                key={item.href}
                href={href as Route}
                className={`block rounded-xl px-3 py-2 text-sm ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {!dashboardContext.projectId ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Selecciona un proyecto en Mis Proyectos para habilitar tareas, reuniones, calendario y archivos del proyecto.
          </p>
        ) : null}

        {adminItems.length > 0 ? (
          <div className="mt-8">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Administración</p>
            <nav className="space-y-1">
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className={`block rounded-xl px-3 py-2 text-sm ${
                      isActive ? "bg-red-700 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </aside>

      <div>
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Contexto activo</p>
              <p className="text-sm font-medium text-slate-900">
                Corelia · {contextLabel} · {roleLabel[activeRole]}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <NotificationsBadge />
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Menú de usuario"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((current) => !current)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-slate-700 hover:bg-slate-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M20 21a8 8 0 1 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                <div
                  className={`absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1rem))] origin-top-right rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl transition duration-150 ease-out sm:w-80 ${
                    userMenuOpen
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                  }`}
                  role="menu"
                >
                  <div className="space-y-0.5 border-b border-slate-200 pb-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{fullName || "Usuario"}</p>
                    <p className="truncate text-xs text-slate-500">{session.data?.email}</p>
                    <p className="text-[11px] text-slate-500">{roleLabel[activeRole]}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="font-semibold text-slate-900">{projectCount}</p>
                      <p className="text-slate-600">Proyectos</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="font-semibold text-slate-900">{teamCount}</p>
                      <p className="text-slate-600">Equipos</p>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    <p className="sm:hidden">
                      {projectCount} proyectos · {teamCount} equipos
                    </p>
                    <div className="hidden space-y-1 sm:block">
                      <p>
                        Proyectos: {topProjects.length > 0 ? topProjects.join(", ") : "Sin proyectos asignados"}
                      </p>
                      <p>Equipos: {topTeams.length > 0 ? topTeams.join(", ") : "Sin equipos asignados"}</p>
                    </div>
                  </div>

                  <nav className="mt-3 grid gap-1 sm:space-y-1" aria-label="Opciones de usuario">
                    <Link
                      href={"/profile" as Route}
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Perfil
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-100"
                    >
                      Cerrar sesión
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {visibleItems.filter((item) => !item.disabled).map((item) => {
              const isActive = pathname === item.href;
              const href = item.contextual ? withDashboardContext(item.href, dashboardContext) : item.href;

              return (
                <Link
                  key={item.href}
                  href={href as Route}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs ${
                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs ${
                    isActive ? "bg-red-700 text-white" : "bg-red-50 text-red-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="dashboard-content mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};
