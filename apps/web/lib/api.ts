import { create } from "zustand";

const resolveApiBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

  if (typeof window === "undefined") {
    return configured;
  }

  if (!configured.startsWith("/")) {
    return configured;
  }

  // If frontend is accessed directly on :3000 (without nginx), route API calls to :4000.
  if (window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:4000${configured}`;
  }

  return configured;
};

const API_BASE_URL = resolveApiBaseUrl();
const AUTH_STORAGE_KEY = "corelia_access_token";

interface AuthState {
  accessToken: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setAccessToken: (token: string | null) => void;
  clearAccessToken: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }

    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    set({
      accessToken: saved,
      hydrated: true
    });
  },
  setAccessToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    set({ accessToken: token, hydrated: true });
  },
  clearAccessToken: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    set({ accessToken: null, hydrated: true });
  }
}));

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = useAuthStore.getState().accessToken;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message ?? "Request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
};
