export type DashboardContext = {
  projectId?: string | null;
  projectName?: string | null;
  teamId?: string | null;
};

const DASHBOARD_CONTEXT_STORAGE_KEY = "corelia_dashboard_context";
const DASHBOARD_CONTEXT_QUERY_KEY = "ctx";

type SearchParamsLike = {
  get(name: string): string | null;
};

type DashboardContextPayload = {
  v: 1;
  p: string | null;
  n: string | null;
  t: string | null;
};

const sanitizeContextValue = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const readBufferFromGlobal = () => {
  const maybeGlobal = globalThis as unknown as {
    Buffer?: {
      from: (value: string, encoding: string) => {
        toString: (encoding: string) => string;
      };
    };
  };

  return maybeGlobal.Buffer;
};

const maskText = (value: string) => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return window
      .btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  const BufferCtor = readBufferFromGlobal();
  if (!BufferCtor) {
    return "";
  }

  return BufferCtor.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const unmaskText = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    try {
      const binary = window.atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  const BufferCtor = readBufferFromGlobal();
  if (!BufferCtor) {
    return null;
  }

  try {
    return BufferCtor.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
};

const normalizeContext = (context: DashboardContext): DashboardContext => ({
  projectId: sanitizeContextValue(context.projectId),
  projectName: sanitizeContextValue(context.projectName),
  teamId: sanitizeContextValue(context.teamId)
});

const toStorageRecord = (context: DashboardContext): Record<string, string> => {
  const normalized = normalizeContext(context);
  const output: Record<string, string> = {};

  if (normalized.projectId) {
    output.projectId = normalized.projectId;
  }
  if (normalized.projectName) {
    output.projectName = normalized.projectName;
  }
  if (normalized.teamId) {
    output.teamId = normalized.teamId;
  }

  return output;
};

const decodeDashboardContextRef = (ref: string | null | undefined): DashboardContext => {
  const safeRef = sanitizeContextValue(ref);
  if (!safeRef) {
    return {};
  }

  const raw = unmaskText(safeRef);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardContextPayload>;
    if (parsed.v !== 1) {
      return {};
    }

    return normalizeContext({
      projectId: typeof parsed.p === "string" ? parsed.p : null,
      projectName: typeof parsed.n === "string" ? parsed.n : null,
      teamId: typeof parsed.t === "string" ? parsed.t : null
    });
  } catch {
    return {};
  }
};

const encodeDashboardContextRef = (context: DashboardContext) => {
  const normalized = normalizeContext(context);
  if (!normalized.projectId && !normalized.projectName && !normalized.teamId) {
    return null;
  }

  const payload: DashboardContextPayload = {
    v: 1,
    p: normalized.projectId ?? null,
    n: normalized.projectName ?? null,
    t: normalized.teamId ?? null
  };

  const encoded = maskText(JSON.stringify(payload));
  return encoded || null;
};

export const readStoredDashboardContext = (): DashboardContext => {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(DASHBOARD_CONTEXT_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as DashboardContext;
    return normalizeContext(parsed);
  } catch {
    return {};
  }
};

export const saveStoredDashboardContext = (context: DashboardContext): void => {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = toStorageRecord(context);
  if (Object.keys(normalized).length === 0) {
    window.localStorage.removeItem(DASHBOARD_CONTEXT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DASHBOARD_CONTEXT_STORAGE_KEY, JSON.stringify(normalized));
};

export const withDashboardContext = (href: string, context: DashboardContext): string => {
  const [pathPart, currentQuery = ""] = href.split("?");
  const path = pathPart ?? href;
  const query = new URLSearchParams(currentQuery);

  query.delete("projectId");
  query.delete("projectName");
  query.delete("teamId");
  query.delete(DASHBOARD_CONTEXT_QUERY_KEY);

  const encodedContext = encodeDashboardContextRef(context);
  if (encodedContext) {
    query.set(DASHBOARD_CONTEXT_QUERY_KEY, encodedContext);
  }

  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

export const getContextFromSearchParams = (params: SearchParamsLike): DashboardContext => {
  const fromRef = decodeDashboardContextRef(params.get(DASHBOARD_CONTEXT_QUERY_KEY));

  return normalizeContext({
    projectId: sanitizeContextValue(params.get("projectId")) ?? fromRef.projectId ?? null,
    projectName: sanitizeContextValue(params.get("projectName")) ?? fromRef.projectName ?? null,
    teamId: sanitizeContextValue(params.get("teamId")) ?? fromRef.teamId ?? null
  });
};

export const getContextFromSearchParamsRecord = (
  params: Record<string, string | string[] | undefined>
): DashboardContext => {
  const get = (name: string) => {
    const value = params[name];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  };

  return getContextFromSearchParams({ get });
};

export const hasDirectDashboardContextParams = (params: SearchParamsLike): boolean =>
  Boolean(
    sanitizeContextValue(params.get("projectId")) ||
      sanitizeContextValue(params.get("projectName")) ||
      sanitizeContextValue(params.get("teamId"))
  );
