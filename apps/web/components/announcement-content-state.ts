export type AnnouncementResolvedUrlKind = "IMAGE" | "FILE";

const isSafeHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());
const isSafeAnnouncementAssetUrl = (value: string) =>
  /^\/(?:api\/v1\/)?announcements\/assets\/content\?/i.test(value.trim());

const normalizeRelativeAnnouncementAssetUrl = (value: string) => {
  const trimmed = value.trim();
  if (/^\/announcements\/assets\/content\?/i.test(trimmed)) {
    return `/api/v1${trimmed}`;
  }
  return trimmed;
};

const normalizeAbsoluteAnnouncementAssetUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (/^\/announcements\/assets\/content$/i.test(parsed.pathname)) {
      parsed.pathname = `/api/v1${parsed.pathname}`;
      return parsed;
    }

    if (/^\/api\/v1\/announcements\/assets\/content$/i.test(parsed.pathname)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
};

const forceInlineMode = (url: URL): void => {
  url.searchParams.set("mode", "inline");
};

const parseAnnouncementAssetToPath = (value: string): string | null => {
  if (isSafeHttpUrl(value)) {
    const normalizedAssetUrl = normalizeAbsoluteAnnouncementAssetUrl(value);
    if (!normalizedAssetUrl) {
      return null;
    }
    forceInlineMode(normalizedAssetUrl);
    return `${normalizedAssetUrl.pathname}${normalizedAssetUrl.search}`;
  }

  if (!isSafeAnnouncementAssetUrl(value)) {
    return null;
  }

  const normalizedPath = normalizeRelativeAnnouncementAssetUrl(value);
  const parsed = new URL(normalizedPath, "http://corelia.local");
  forceInlineMode(parsed);
  return `${parsed.pathname}${parsed.search}`;
};

const toAbsoluteFromApiBase = (pathWithQuery: string, apiBase: string): string => {
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const apiOrigin = apiBase.replace(/\/api\/v1\/?$/i, "");
    return `${apiOrigin}${pathWithQuery}`;
  }

  return pathWithQuery;
};

export const resolveAnnouncementUrl = (input: {
  value: string;
  apiBase: string;
  kind: AnnouncementResolvedUrlKind;
}): string | null => {
  const { value, apiBase, kind } = input;

  if (isSafeHttpUrl(value)) {
    const normalizedAssetUrl = normalizeAbsoluteAnnouncementAssetUrl(value);
    if (!normalizedAssetUrl) {
      return value;
    }

    if (kind === "IMAGE") {
      forceInlineMode(normalizedAssetUrl);
    }

    return normalizedAssetUrl.toString();
  }

  if (!isSafeAnnouncementAssetUrl(value)) {
    return null;
  }

  const normalizedPath = normalizeRelativeAnnouncementAssetUrl(value);
  const parsed = new URL(normalizedPath, "http://corelia.local");
  if (kind === "IMAGE") {
    forceInlineMode(parsed);
  }

  const pathWithQuery = `${parsed.pathname}${parsed.search}`;
  return toAbsoluteFromApiBase(pathWithQuery, apiBase);
};

export const resolveAnnouncementImageCandidates = (input: {
  value: string;
  apiBase: string;
}): string[] => {
  const primary = resolveAnnouncementUrl({
    value: input.value,
    apiBase: input.apiBase,
    kind: "IMAGE"
  });
  const fallbackPath = parseAnnouncementAssetToPath(input.value);
  const candidates = [primary, fallbackPath].filter((entry): entry is string => Boolean(entry));
  return [...new Set(candidates)];
};
