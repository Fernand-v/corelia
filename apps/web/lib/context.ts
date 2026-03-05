export type DashboardContext = {
  projectId?: string | null;
  projectName?: string | null;
  teamId?: string | null;
};

const DASHBOARD_CONTEXT_STORAGE_KEY = "corelia_dashboard_context";

const normalizeContext = (context: DashboardContext): Record<string, string> => {
  const normalized: Record<string, string> = {};

  if (context.projectId) {
    normalized.projectId = context.projectId;
  }

  if (context.projectName) {
    normalized.projectName = context.projectName;
  }

  if (context.teamId) {
    normalized.teamId = context.teamId;
  }

  return normalized;
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
    return {
      projectId: typeof parsed.projectId === "string" && parsed.projectId ? parsed.projectId : null,
      projectName: typeof parsed.projectName === "string" && parsed.projectName ? parsed.projectName : null,
      teamId: typeof parsed.teamId === "string" && parsed.teamId ? parsed.teamId : null
    };
  } catch {
    return {};
  }
};

export const saveStoredDashboardContext = (context: DashboardContext): void => {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeContext(context);
  if (Object.keys(normalized).length === 0) {
    window.localStorage.removeItem(DASHBOARD_CONTEXT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DASHBOARD_CONTEXT_STORAGE_KEY, JSON.stringify(normalized));
};

export const withDashboardContext = (href: string, context: DashboardContext): string => {
  const normalized = normalizeContext(context);
  const keys = Object.keys(normalized);

  if (keys.length === 0) {
    return href;
  }

  const [pathPart, currentQuery = ""] = href.split("?");
  const path = pathPart ?? href;
  const query = new URLSearchParams(currentQuery);

  for (const [key, value] of Object.entries(normalized)) {
    query.set(key, value);
  }

  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

export const getContextFromSearchParams = (params: URLSearchParams): DashboardContext => ({
  projectId: params.get("projectId"),
  projectName: params.get("projectName"),
  teamId: params.get("teamId")
});
