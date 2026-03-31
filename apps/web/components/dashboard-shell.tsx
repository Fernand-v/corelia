"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Permission } from "@corelia/types";
import type { Route } from "next";
import { apiRequest, useAuthStore } from "@/lib/api";
import { useSession, useSessionMembershipSummary } from "@/lib/session";
import { useFrontendSettings } from "@/lib/frontend-settings";
import { EntryAnnouncementModal } from "@/components/entry-announcement-modal";
import { NotificationsBadge } from "@/components/notifications-badge";
import { NotificationToastContainer, useNotificationToast } from "@/components/notification-toast";
import {
  getContextFromSearchParams,
  hasDirectDashboardContextParams,
  readStoredDashboardContext,
  saveStoredDashboardContext,
  withDashboardContext
} from "@/lib/context";

type NavItem = {
  label: string;
  href: string;
  requiredAnyPermissions?: Permission[];
  disabled?: boolean;
  phase?: string;
  contextual?: boolean;
  requiresProjectContext?: boolean;
};

type DashboardContext = {
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home", contextual: true },
  { label: "Mensajes", href: "/messaging", requiredAnyPermissions: ["MENSAJE_ESCRIBIR"] },
  { label: "Mis Proyectos", href: "/projects", requiredAnyPermissions: ["PROYECTO_LEER"], contextual: true },
  { label: "Anuncios", href: "/announcements" },
  { label: "Mis Tareas", href: "/tasks", requiredAnyPermissions: ["TAREA_LEER"], contextual: true },
  { label: "Reportes", href: "/reports", requiredAnyPermissions: ["PROYECTO_LEER"] },
  {
    label: "Presupuesto",
    href: "/projects/:projectId/budget",
    requiresProjectContext: true,
    requiredAnyPermissions: ["PRESUPUESTO_LEER", "PRESUPUESTO_GESTIONAR"]
  },
  { label: "Calendario", href: "/calendar", requiredAnyPermissions: ["CALENDARIO_LEER"], contextual: true, requiresProjectContext: true },
  { label: "Reuniones", href: "/meetings", requiredAnyPermissions: ["REUNION_LEER"], contextual: true, requiresProjectContext: true },
  { label: "Archivos", href: "/files", requiredAnyPermissions: ["ARCHIVO_SUBIR"], contextual: true, requiresProjectContext: true },
  {
    label: "Documentos",
    href: "/documents",
    requiredAnyPermissions: ["PROYECTO_LEER"],
    contextual: true,
    requiresProjectContext: true
  },
  { label: "Formularios", href: "/forms", requiredAnyPermissions: ["PROYECTO_LEER"], contextual: true },
  { label: "Mis Métricas", href: "/metrics", requiredAnyPermissions: ["TAREA_LEER"] },
  { label: "Solicitudes", href: "/requests", requiredAnyPermissions: ["PROYECTO_LEER"] },
  { label: "Notificaciones", href: "/notifications" },
  { label: "Buscar", href: "/search", requiredAnyPermissions: ["USUARIO_LEER"] }
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Panel de Admin", href: "/admin/panel", requiredAnyPermissions: ["USUARIO_GESTIONAR"] },
  { label: "Resumen", href: "/admin/overview", requiredAnyPermissions: ["USUARIO_GESTIONAR"] },
  { label: "Equipos", href: "/admin/teams", requiredAnyPermissions: ["USUARIO_GESTIONAR"] },
  { label: "Estado del Sistema", href: "/admin/system", requiredAnyPermissions: ["USUARIO_GESTIONAR"] },
  { label: "Monitoreo", href: "/admin/monitoring", requiredAnyPermissions: ["USUARIO_GESTIONAR"] }
];

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

const hasRequiredPermission = (item: NavItem, permissions: Permission[]) => {
  if (!item.requiredAnyPermissions || item.requiredAnyPermissions.length === 0) {
    return true;
  }

  return item.requiredAnyPermissions.some((permission) => permissions.includes(permission));
};

const resolveNavHref = (item: NavItem, dashboardContext: DashboardContext) => {
  if (item.href.includes(":projectId")) {
    if (!dashboardContext.projectId) {
      return null;
    }

    return item.href.replace(":projectId", dashboardContext.projectId);
  }

  if (item.contextual) {
    return withDashboardContext(item.href, dashboardContext);
  }

  return item.href;
};

const isNavItemActive = (item: NavItem, pathname: string, resolvedHref: string) => {
  if (item.href.includes(":projectId")) {
    return pathname === resolvedHref.split("?")[0];
  }

  return pathname === item.href;
};

export const DashboardShell = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearAccessToken = useAuthStore((state) => state.clearAccessToken);

  const session = useSession();
  const memberships = useSessionMembershipSummary();
  const { settings: frontendSettings } = useFrontendSettings();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [storedDashboardContext, setStoredDashboardContext] = useState(() =>
    typeof window === "undefined" ? {} : readStoredDashboardContext()
  );
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const { toasts, showToast, dismissToast } = useNotificationToast();

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

  useEffect(() => {
    if (!hasDirectDashboardContextParams(params)) {
      return;
    }

    const nextParams = new URLSearchParams(params.toString());
    nextParams.delete("projectId");
    nextParams.delete("projectName");
    nextParams.delete("teamId");
    nextParams.delete("ctx");

    const baseHref = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    const maskedHref = withDashboardContext(baseHref, queryContext);
    const currentHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;

    if (maskedHref !== currentHref) {
      router.replace(maskedHref as Route);
    }
  }, [params, pathname, queryContext.projectId, queryContext.projectName, queryContext.teamId, router]);

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

    const activePermissions = session.data?.permissions ?? [];
    const hasProjectContext = Boolean(dashboardContext.projectId);

    return NAV_ITEMS.filter((item) => {
      if (!hasRequiredPermission(item, activePermissions)) {
        return false;
      }

      if (
        !hasProjectContext &&
        item.href !== "/home" &&
        item.href !== "/projects" &&
        item.href !== "/messaging" &&
        item.href !== "/announcements" &&
        item.href !== "/tasks" &&
        item.href !== "/reports"
      ) {
        return false;
      }

      if (item.requiresProjectContext && !dashboardContext.projectId) {
        return false;
      }

      return true;
    });
  }, [activeRole, dashboardContext.projectId, session.data?.permissions]);

  const adminItems = useMemo(() => {
    const activePermissions = session.data?.permissions ?? [];
    return ADMIN_ITEMS.filter((item) => hasRequiredPermission(item, activePermissions));
  }, [session.data?.permissions]);

  if (!hydrated || (accessToken && session.isLoading)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
        <p className="text-sm text-slate-500 tracking-wide">Cargando sesión…</p>
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
  const organizationName = frontendSettings.organizationName;
  const projectCount = memberships.data?.projects.length ?? 0;
  const teamCount = memberships.data?.teams.length ?? 0;
  const topProjects = memberships.data?.projects.slice(0, 2).map((item) => item.name) ?? [];
  const topTeams = memberships.data?.teams.slice(0, 2).map((item) => item.name) ?? [];

  const handleSignOut = () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      void apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      }).catch(() => {});
    }
    clearAccessToken();
    setUserMenuOpen(false);
    router.replace("/login" as Route);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <EntryAnnouncementModal enabled={hydrated && Boolean(accessToken) && Boolean(session.data)} />

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col border-r border-[rgba(0,0,0,0.07)] bg-sidebar px-3 py-5 backdrop-blur-sidebar">
        <div className="mb-5 px-2 space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Organización</p>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{organizationName}</h1>
          <p className="text-xs text-slate-500">{session.data?.roleDisplayName ?? activeRole}</p>
        </div>

        <nav className="space-y-0.5">
          {visibleItems.map((item) => {
            const href = resolveNavHref(item, dashboardContext);
            if (!href) {
              return null;
            }

            const isActive = isNavItemActive(item, pathname, href);

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-400">{item.phase}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={href as Route}
                className={`flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-100 ${
                  isActive
                    ? "bg-nav-active-bg text-nav-active-text"
                    : "text-slate-600 hover:bg-black/5 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {!dashboardContext.projectId ? (
          <p className="mt-3 rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 px-3 py-2 text-xs text-slate-500 leading-relaxed">
            Selecciona un proyecto en Mis Proyectos para habilitar tareas, reuniones, calendario y archivos del proyecto.
          </p>
        ) : null}

        {adminItems.length > 0 ? (
          <div className="mt-6">
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">Administración</p>
            <nav className="space-y-0.5">
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className={`flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-100 ${
                      isActive
                        ? "bg-admin-active-bg text-admin-active-text"
                        : "text-slate-600 hover:bg-red-50/60 hover:text-red-700"
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

      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-[rgba(0,0,0,0.07)] bg-glass-heavy px-4 py-3 backdrop-blur-header shadow-header md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide">Contexto activo</p>
              <p className="text-sm font-semibold text-slate-800 tracking-tight">
                {organizationName} · {contextLabel} · {session.data?.roleDisplayName ?? activeRole}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <NotificationsBadge onToast={showToast} />
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Menú de usuario"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((current) => !current)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[rgba(0,0,0,0.09)] bg-white/80 px-2.5 text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white/95 transition-colors duration-100"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
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
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* Dropdown usuario */}
                <div
                  className={`absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1rem))] origin-top-right rounded-2xl border border-[rgba(0,0,0,0.08)] bg-glass-heavy p-3 shadow-dropdown backdrop-blur-dropdown transition duration-150 ease-macos sm:w-72 ${
                    userMenuOpen
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-2 scale-95 opacity-0"
                  }`}
                  role="menu"
                >
                  <div className="space-y-0.5 border-b border-[rgba(0,0,0,0.07)] pb-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{fullName || "Usuario"}</p>
                    <p className="truncate text-xs text-slate-500">{session.data?.email}</p>
                    <p className="text-[11px] text-slate-400">{session.data?.roleDisplayName ?? activeRole}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/60 px-2.5 py-2">
                      <p className="text-base font-semibold text-slate-900">{projectCount}</p>
                      <p className="text-slate-500">Proyectos</p>
                    </div>
                    <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/60 px-2.5 py-2">
                      <p className="text-base font-semibold text-slate-900">{teamCount}</p>
                      <p className="text-slate-500">Equipos</p>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    <p className="sm:hidden">
                      {projectCount} proyectos · {teamCount} equipos
                    </p>
                    <div className="hidden space-y-1 sm:block">
                      <p>Proyectos: {topProjects.length > 0 ? topProjects.join(", ") : "Sin proyectos asignados"}</p>
                      <p>Equipos: {topTeams.length > 0 ? topTeams.join(", ") : "Sin equipos asignados"}</p>
                    </div>
                  </div>

                  <nav className="mt-3 space-y-1" aria-label="Opciones de usuario">
                    <Link
                      href={"/profile" as Route}
                      className="block rounded-xl border border-[rgba(0,0,0,0.07)] bg-white/50 px-3 py-2 text-sm text-slate-700 hover:bg-white/80 transition-colors duration-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Perfil
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-100 transition-colors duration-100"
                    >
                      Cerrar sesión
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>

          {/* Nav móvil */}
          <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 lg:hidden">
            {visibleItems.filter((item) => !item.disabled).map((item) => {
              const href = resolveNavHref(item, dashboardContext);
              if (!href) {
                return null;
              }

              const isActive = isNavItemActive(item, pathname, href);

              return (
                <Link
                  key={item.href}
                  href={href as Route}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
                    isActive
                      ? "bg-nav-active-bg text-nav-active-text"
                      : "bg-black/5 text-slate-600 hover:bg-black/8 hover:text-slate-900"
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
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
                    isActive
                      ? "bg-admin-active-bg text-admin-active-text"
                      : "bg-red-50/70 text-red-500 hover:bg-red-100/80"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="dashboard-content mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>

      <NotificationToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
