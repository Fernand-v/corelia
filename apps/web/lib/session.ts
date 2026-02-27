"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SystemRole } from "@corelia/types";
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
