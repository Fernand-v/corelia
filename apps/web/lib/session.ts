"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuthMembershipSummary, Permission, ProgramCode, RoleCode } from "@corelia/types";
import { apiRequest, useAuthStore } from "@/lib/api";

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

      return {
        ...payload,
        baseRole,
        activeRole,
        programs
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
