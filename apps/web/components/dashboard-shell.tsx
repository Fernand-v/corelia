"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Permission, ProgramCode } from "@corelia/types";
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
  requiredProgram?: ProgramCode;
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
  {
    label: "Mensajes",
    href: "/messaging",
    requiredProgram: "MENSAJERIA",
    requiredAnyPermissions: ["MENSAJE_ESCRIBIR"]
  },
  {
    label: "Mis Proyectos",
    href: "/projects",
    requiredProgram: "PROYECTOS",
    requiredAnyPermissions: ["PROYECTO_LEER"],
    contextual: true
  },
  {
    label: "Anuncios",
    href: "/announcements",
    requiredProgram: "ANUNCIOS",
    requiredAnyPermissions: ["USUARIO_LEER"]
  },
  {
    label: "Mis Tareas",
    href: "/tasks",
    requiredProgram: "TAREAS",
    requiredAnyPermissions: ["TAREA_LEER"],
    contextual: true
  },
  {
    label: "Reportes",
    href: "/reports",
    requiredProgram: "REPORTES",
    requiredAnyPermissions: ["PROYECTO_LEER"]
  },
  {
    label: "Presupuesto",
    href: "/projects/:projectId/budget",
    requiredProgram: "PRESUPUESTO",
    requiresProjectContext: true,
    requiredAnyPermissions: ["PRESUPUESTO_LEER", "PRESUPUESTO_GESTIONAR"]
  },
  {
    label: "Calendario",
    href: "/calendar",
    requiredProgram: "CALENDARIO",
    requiredAnyPermissions: ["CALENDARIO_LEER"],
    contextual: true,
    requiresProjectContext: true
  },
  {
    label: "Reuniones",
    href: "/meetings",
    requiredProgram: "REUNIONES",
    requiredAnyPermissions: ["REUNION_LEER"],
    contextual: true,
    requiresProjectContext: true
  },
  {
    label: "Archivos",
    href: "/files",
    requiredProgram: "ARCHIVOS",
    requiredAnyPermissions: ["ARCHIVO_SUBIR"],
    contextual: true,
    requiresProjectContext: true
  },
  {
    label: "Documentos",
    href: "/documents",
    requiredProgram: "DOCUMENTOS",
    requiredAnyPermissions: ["PROYECTO_LEER"],
    contextual: true,
    requiresProjectContext: true
  },
  {
    label: "Formularios",
    href: "/forms",
    requiredProgram: "FORMULARIOS",
    requiredAnyPermissions: ["USUARIO_LEER"],
    contextual: true
  },
  { label: "Mis Métricas", href: "/metrics", requiredAnyPermissions: ["TAREA_LEER"] },
  {
    label: "Solicitudes",
    href: "/requests",
    requiredProgram: "FORMULARIOS",
    requiredAnyPermissions: ["USUARIO_LEER"]
  },
  {
    label: "Notificaciones",
    href: "/notifications",
    requiredProgram: "NOTIFICACIONES",
    requiredAnyPermissions: ["NOTIFICACION_LEER"]
  },
  {
    label: "Buscar",
    href: "/search",
    requiredProgram: "BUSQUEDA",
    requiredAnyPermissions: ["PROYECTO_LEER"]
  },
  {
    label: "Tickets IT",
    href: "/tickets",
    requiredProgram: "TICKETS",
    requiredAnyPermissions: ["TICKET_LEER"]
  },
  {
    label: "Registros",
    href: "/registros",
    requiredProgram: "PERSONAS",
    requiredAnyPermissions: ["PERSONA_LEER", "CATALOGO_LEER"]
  }
];

const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Panel de Admin",
    href: "/admin/panel",
    requiredProgram: "ADMINISTRACION",
    requiredAnyPermissions: ["USUARIO_GESTIONAR"]
  },
  {
    label: "Accesos",
    href: "/admin/access",
    requiredProgram: "ADMINISTRACION",
    requiredAnyPermissions: ["USUARIO_GESTIONAR"]
  },
  {
    label: "Resumen",
    href: "/admin/overview",
    requiredProgram: "ADMINISTRACION",
    requiredAnyPermissions: ["USUARIO_GESTIONAR"]
  },
  {
    label: "Equipos",
    href: "/admin/teams",
    requiredProgram: "ADMINISTRACION",
    requiredAnyPermissions: ["USUARIO_GESTIONAR"]
  },
  {
    label: "Estado del Sistema",
    href: "/admin/system",
    requiredProgram: "ADMINISTRACION",
    requiredAnyPermissions: ["USUARIO_GESTIONAR"]
  },
  {
    label: "Monitoreo",
    href: "/admin/monitoring",
    requiredProgram: "ADMINISTRACION",
    requiredAnyPermissions: ["USUARIO_GESTIONAR"]
  }
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

const hasRequiredProgram = (item: NavItem, programs: ProgramCode[]) => {
  if (!item.requiredProgram) {
    return true;
  }
  return programs.includes(item.requiredProgram);
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
  const queryContext = useMemo(() => getContextFromSearchParams(params), [params]);

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
  }, [params, pathname, queryContext, router]);

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
    const activePrograms = session.data?.programs ?? [];
    const hasProjectContext = Boolean(dashboardContext.projectId);

    return NAV_ITEMS.filter((item) => {
      if (!hasRequiredProgram(item, activePrograms)) {
        return false;
      }

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
  }, [activeRole, dashboardContext.projectId, session.data?.permissions, session.data?.programs]);

  const adminItems = useMemo(() => {
    const activePermissions = session.data?.permissions ?? [];
    const activePrograms = session.data?.programs ?? [];
    return ADMIN_ITEMS.filter(
      (item) => hasRequiredProgram(item, activePrograms) && hasRequiredPermission(item, activePermissions)
    );
  }, [session.data?.permissions, session.data?.programs]);

  if (!hydrated || (accessToken && session.isLoading)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
        <p className="text-sm text-mid tracking-wide">Cargando sesión…</p>
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
    // El refresh token está en la cookie httpOnly; la API lo lee y la limpia.
    void apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
    clearAccessToken();
    setUserMenuOpen(false);
    router.replace("/login" as Route);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <EntryAnnouncementModal enabled={hydrated && Boolean(accessToken) && Boolean(session.data)} />

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col border-r border-line bg-paper px-3 py-5">
        <div className="mb-5 px-2 space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-faint">Organización</p>
          <h1 className="text-lg font-semibold text-ink tracking-tight">{organizationName}</h1>
          <p className="text-xs text-mid">{session.data?.roleDisplayName ?? activeRole}</p>
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
                  className="flex items-center justify-between px-3 py-2 text-sm text-faint cursor-not-allowed"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] border border-line px-2 py-0.5 text-faint uppercase tracking-wide">{item.phase}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={href as Route}
                className={`flex items-center border-l-2 px-3 py-2 text-sm transition-colors duration-100 ${
                  isActive
                    ? "border-ink font-semibold text-ink"
                    : "border-transparent font-medium text-mid hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {!dashboardContext.projectId ? (
          <p className="mt-3 border border-line bg-paper px-3 py-2 text-xs text-mid leading-relaxed">
            Selecciona un proyecto en Mis Proyectos para habilitar tareas, reuniones, calendario y archivos del proyecto.
          </p>
        ) : null}

        {adminItems.length > 0 ? (
          <div className="mt-6">
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-faint">Administración</p>
            <nav className="space-y-0.5">
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className={`flex items-center border-l-2 px-3 py-2 text-sm transition-colors duration-100 ${
                      isActive
                        ? "border-urgent font-semibold text-urgent"
                        : "border-transparent font-medium text-mid hover:text-urgent"
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
        <header className="sticky top-0 z-20 border-b border-line bg-paper px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-faint font-medium uppercase tracking-widest">Contexto activo</p>
              <p className="text-sm font-semibold text-ink tracking-tight">
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
                  className="inline-flex h-9 items-center gap-2 border border-line bg-paper px-2.5 text-ink hover:bg-accent-muted transition-colors duration-100"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-line text-ink">
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
                    className={`h-3.5 w-3.5 text-faint transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* Dropdown usuario */}
                <div
                  className={`absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1rem))] origin-top-right border border-line bg-paper p-3 shadow-dropdown transition duration-150 ease-macos sm:w-72 ${
                    userMenuOpen
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-2 scale-95 opacity-0"
                  }`}
                  role="menu"
                >
                  <div className="space-y-0.5 border-b border-line pb-3">
                    <p className="truncate text-sm font-semibold text-ink">{fullName || "Usuario"}</p>
                    <p className="truncate text-xs text-mid">{session.data?.email}</p>
                    <p className="text-[11px] text-faint">{session.data?.roleDisplayName ?? activeRole}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="border border-line bg-paper px-2.5 py-2">
                      <p className="font-condensed text-2xl font-bold tabular-nums text-ink">{projectCount}</p>
                      <p className="text-mid">Proyectos</p>
                    </div>
                    <div className="border border-line bg-paper px-2.5 py-2">
                      <p className="font-condensed text-2xl font-bold tabular-nums text-ink">{teamCount}</p>
                      <p className="text-mid">Equipos</p>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-mid">
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
                      className="block border border-line bg-paper px-3 py-2 text-sm text-ink hover:bg-accent-muted transition-colors duration-100"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Perfil
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full border border-urgent/30 bg-urgent-muted px-3 py-2 text-left text-sm text-urgent hover:bg-urgent hover:text-white transition-colors duration-100"
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
                  className={`whitespace-nowrap border px-3.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
                    isActive
                      ? "border-ink bg-ink text-white"
                      : "border-line text-mid hover:text-ink"
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
                  className={`whitespace-nowrap border px-3.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
                    isActive
                      ? "border-urgent bg-urgent text-white"
                      : "border-line text-urgent hover:bg-urgent-muted"
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
