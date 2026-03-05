const normalizeCollabPathname = (pathname: string) => {
  if (pathname === "/collab") {
    return "/collab/";
  }
  return pathname;
};

const normalizeRelativeCollabPath = (rawPath: string) => {
  try {
    const parsed = new URL(rawPath, "http://corelia.local");
    parsed.pathname = normalizeCollabPathname(parsed.pathname);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawPath === "/collab" ? "/collab/" : rawPath;
  }
};

const isLocalHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const normalizeWsLikeUrl = (rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl);
    parsed.pathname = normalizeCollabPathname(parsed.pathname);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

export type ResolvedHocuspocus = {
  url: string;
  source: "explicit" | "relative" | "docker-dev-fallback";
  configured: string;
};

export const resolveHocuspocusUrl = (): ResolvedHocuspocus => {
  const configured = (process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? "").trim();
  const raw = configured || "/collab";

  if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
    return {
      url: normalizeWsLikeUrl(raw),
      source: "explicit",
      configured
    };
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const wsLike = raw.replace(/^http/i, "ws");
    return {
      url: normalizeWsLikeUrl(wsLike),
      source: "explicit",
      configured
    };
  }

  if (typeof window === "undefined") {
    return {
      url: "",
      source: "relative",
      configured
    };
  }

  if (raw.startsWith("/")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const path = normalizeRelativeCollabPath(raw);
    const shouldUseLocalFallback =
      isLocalHost(window.location.hostname) &&
      window.location.port !== "1234" &&
      (configured.length === 0 || configured === "/collab" || configured === "/collab/");

    if (shouldUseLocalFallback) {
      return {
        url: `${protocol}//${window.location.hostname}:1234${path}`,
        source: "docker-dev-fallback",
        configured
      };
    }

    return {
      url: `${protocol}//${window.location.host}${path}`,
      source: "relative",
      configured
    };
  }

  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  const normalizedRaw = raw.replace(/^\/+/, "");
  return {
    url: normalizeWsLikeUrl(`${protocol}${normalizedRaw}`),
    source: "explicit",
    configured
  };
};
