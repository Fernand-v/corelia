"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuthMembershipSummary, Permission, ProgramCode, RoleCode } from "@corelia/types";
import { apiRequest, useAuthStore } from "@/lib/api";

export interface SessionNavItem {
  program: ProgramCode;
  label: string;
  href: string;
  icon: string | null;
  navOrder: number;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  baseRole: RoleCode;
  isActive: boolean;
  activeRole: RoleCode;
  roleDisplayName?: string;
  activeRoleRank?: number;
  programs: ProgramCode[];
  permissions: Permission[];
  navItems: SessionNavItem[];
}

export interface SessionMembershipSummary extends AuthMembershipSummary {}

const coerceRoleCode = (value: unknown): RoleCode | null => {
  if (typeof value === "string" && value.length > 0) {
    return value as RoleCode;
  }

  if (value && typeof value === "object") {
    const key = (value as { key?: unknown }).key;
    if (typeof key === "string" && key.length > 0) {
      return key as RoleCode;
    }
  }

  return null;
};

const coerceProgramCodes = (value: unknown): ProgramCode[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ProgramCode => typeof item === "string");
};

const coerceNavItems = (value: unknown): SessionNavItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.program !== "string" || typeof candidate.label !== "string" || typeof candidate.href !== "string") {
      return [];
    }
    return [
      {
        program: candidate.program as ProgramCode,
        label: candidate.label,
        href: candidate.href,
        icon: typeof candidate.icon === "string" ? candidate.icon : null,
        navOrder: typeof candidate.navOrder === "number" ? candidate.navOrder : 0
      }
    ];
  });
};

export const useAuthBootstrap = () => {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  return hydrated;
};

export const useSession = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthBootstrap();

  return useQuery({
    queryKey: ["session", accessToken],
    queryFn: async () => {
      const payload = await apiRequest<
        Omit<SessionUser, "baseRole" | "activeRole" | "programs"> & {
          baseRole: unknown;
          activeRole: unknown;
          programs?: unknown;
        }
      >("/auth/me");

      const baseRole = coerceRoleCode(payload.baseRole) ?? "INVITADO_EXTERNO";
      const activeRole = coerceRoleCode(payload.activeRole) ?? baseRole;
      const programs = coerceProgramCodes(payload.programs);
      const navItems = coerceNavItems((payload as { navItems?: unknown }).navItems);

      return {
        ...payload,
        baseRole,
        activeRole,
        programs,
        navItems
      };
    },
    enabled: hydrated && Boolean(accessToken),
    retry: false
  });
};

export const useSessionMembershipSummary = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthBootstrap();

  return useQuery({
    queryKey: ["session-memberships", accessToken],
    queryFn: () => apiRequest<SessionMembershipSummary>("/auth/memberships"),
    enabled: hydrated && Boolean(accessToken),
    retry: false,
    staleTime: 60 * 1000
  });
};
