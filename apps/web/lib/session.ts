"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuthMembershipSummary, SystemRole } from "@corelia/types";
import { apiRequest, useAuthStore } from "@/lib/api";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  baseRole: SystemRole;
  isActive: boolean;
  activeRole: SystemRole;
}

export interface SessionMembershipSummary extends AuthMembershipSummary {}

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
    queryFn: () => apiRequest<SessionUser>("/auth/me"),
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
