const DOCUMENT_ASSET_PATH_PATTERN = /^\/(?:api\/v1\/)?documents\/assets\/content\?/i;

export const normalizeDocumentAssetPath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\/documents\/assets\/content\?/i.test(trimmed)) {
    return `/api/v1${trimmed}`;
  }

  if (/^documents\/assets\/content\?/i.test(trimmed)) {
    return `/api/v1/${trimmed}`;
  }

  if (/^api\/v1\/documents\/assets\/content\?/i.test(trimmed)) {
    return `/${trimmed}`;
  }

  return trimmed;
};

export const resolveDocumentAssetUrl = (value: string, apiBase: string) => {
  const normalizedValue = normalizeDocumentAssetPath(value);
  if (!normalizedValue) {
    return "";
  }

  if (/^blob:/i.test(normalizedValue) || /^data:/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    try {
      const parsed = new URL(normalizedValue);
      if (/^\/documents\/assets\/content$/i.test(parsed.pathname)) {
        parsed.pathname = `/api/v1${parsed.pathname}`;
      }
      return parsed.toString();
    } catch {
      return normalizedValue;
    }
  }

  if (!normalizedValue.startsWith("/")) {
    return normalizedValue;
  }

  if (!DOCUMENT_ASSET_PATH_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const apiOrigin = apiBase.replace(/\/api\/v1\/?$/i, "");
    return `${apiOrigin}${normalizedValue}`;
  }

  return normalizedValue;
};

export const normalizeLinkInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    /^tel:/i.test(trimmed) ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const parseContent = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  try {
    return JSON.parse(value) as object;
  } catch {
    return value;
  }
};

export const normalizeMentionQuery = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export const initialsFromName = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "??";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
};

export const formatSeenTime = (value?: string) => {
  if (!value) {
    return "activo";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "activo";
  }
  return `activo ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
};
