"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SystemRole } from "@corelia/types";
import type { Route } from "next";
import { apiRequest, useAuthStore } from "@/lib/api";
import { useSession } from "@/lib/session";
import { EntryAnnouncementModal } from "@/components/entry-announcement-modal";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";

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
  { label: "Mis Proyectos", href: "/projects", roles: WORK_ROLES, contextual: true },
  { label: "Mis Tareas", href: "/tasks", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  { label: "Calendario", href: "/calendar", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  { label: "Mensajería", href: "/messaging", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  { label: "Reuniones", href: "/meetings", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  { label: "Directorio", href: "/directory", roles: INTERNAL_ROLES },
  { label: "Archivos", href: "/files", roles: WORK_ROLES, contextual: true, requiresProjectContext: true },
  {
    label: "Documentos",
    href: "/documents",
    roles: WORK_ROLES,
    disabled: true,
    phase: "Fase 2B"
  },
  {
    label: "Wiki",
    href: "/wiki",
    roles: INTERNAL_ROLES,
    disabled: true,
    phase: "Fase 2B"
  },
  { label: "Anuncios", href: "/announcements", roles: INTERNAL_ROLES },
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

const formatContextLabel = (projectId: string | null, teamId: string | null): string => {
  if (projectId) {
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

  const unread = useQuery({
    queryKey: ["unread-count", accessToken],
    queryFn: () => apiRequest<{ unread: number }>("/notifications/unread-count"),
    enabled: hydrated && Boolean(accessToken) && Boolean(session.data),
    retry: false
  });

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

  const activeRole = session.data?.activeRole;
  const dashboardContext = getContextFromSearchParams(params);

  const visibleItems = useMemo(() => {
    if (!activeRole) {
      return [];
    }

    return NAV_ITEMS.filter((item) => {
      if (!includesRole(item, activeRole)) {
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

  const contextLabel = formatContextLabel(params.get("projectId"), params.get("teamId"));
  const unreadCount = unread.data?.unread ?? 0;
  const fullName = `${session.data?.firstName ?? ""} ${session.data?.lastName ?? ""}`.trim();

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
            Selecciona un proyecto en Mis Proyectos para habilitar mensajería, reuniones, calendario y archivos.
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
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                Notificaciones: {unreadCount}
              </span>
              <Link
                href={"/profile" as Route}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {fullName || "Mi perfil"}
              </Link>
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

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
};
