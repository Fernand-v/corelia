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
const REFRESH_TOKEN_KEY = "corelia_refresh_token";

const safeGetItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Silently fail — quota exceeded or private browsing
  }
};

const safeRemoveItem = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
};

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setTokens: (access: string, refresh: string) => void;
  setAccessToken: (token: string | null) => void;
  clearAccessToken: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }

    const saved = safeGetItem(AUTH_STORAGE_KEY);
    const refresh = safeGetItem(REFRESH_TOKEN_KEY);
    set({
      accessToken: saved,
      refreshToken: refresh,
      hydrated: true
    });
  },
  setTokens: (access, refresh) => {
    if (typeof window !== "undefined") {
      safeSetItem(AUTH_STORAGE_KEY, access);
      safeSetItem(REFRESH_TOKEN_KEY, refresh);
    }
    set({ accessToken: access, refreshToken: refresh, hydrated: true });
  },
  setAccessToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) {
        safeSetItem(AUTH_STORAGE_KEY, token);
      } else {
        safeRemoveItem(AUTH_STORAGE_KEY);
      }
    }
    set({ accessToken: token, hydrated: true });
  },
  clearAccessToken: () => {
    if (typeof window !== "undefined") {
      safeRemoveItem(AUTH_STORAGE_KEY);
      safeRemoveItem(REFRESH_TOKEN_KEY);
    }
    set({ accessToken: null, refreshToken: null, hydrated: true });
  }
}));

export const getApiBaseUrl = () => API_BASE_URL;
export const getAuthToken = () => useAuthStore.getState().accessToken;

let refreshPromise: Promise<boolean> | null = null;

const tryRefreshToken = async (): Promise<boolean> => {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    return false;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        useAuthStore.getState().clearAccessToken();
        return false;
      }

      const data = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = useAuthStore.getState().accessToken;
  const hasBody = init?.body !== undefined && init?.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers ?? {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (response.status === 401 && token && !path.startsWith("/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      const retryHeaders = new Headers(init?.headers ?? {});
      if (newToken) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      }
      if (hasBody && !isFormData && !retryHeaders.has("Content-Type")) {
        retryHeaders.set("Content-Type", "application/json");
      }

      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: retryHeaders
      });

      if (!retryResponse.ok) {
        const body = await retryResponse.json().catch(() => ({ message: "Request failed" }));
        throw new Error(body.message ?? "Request failed");
      }

      if (retryResponse.status === 204) {
        return {} as T;
      }

      return retryResponse.json() as Promise<T>;
    }

    useAuthStore.getState().clearAccessToken();
    throw new Error("Sesión expirada");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message ?? "Request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
};
