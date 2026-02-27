export type DashboardContext = {
  projectId?: string | null;
  teamId?: string | null;
};

const normalizeContext = (context: DashboardContext): Record<string, string> => {
  const normalized: Record<string, string> = {};

  if (context.projectId) {
    normalized.projectId = context.projectId;
  }

  if (context.teamId) {
    normalized.teamId = context.teamId;
  }

  return normalized;
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
  teamId: params.get("teamId")
});
