type CallRoutePayload = {
  v: 1;
  m: string;
  p: string | null;
};

type SearchParamsLike = {
  get(name: string): string | null;
};

type ResolvedCallRoute = {
  meetingId: string;
  projectId: string | null;
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

const sanitizeParam = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const buildMaskedCallRoute = (input: { meetingId: string; projectId?: string | null }) => {
  const meetingId = sanitizeParam(input.meetingId);
  const projectId = sanitizeParam(input.projectId ?? null);

  if (!meetingId) {
    return "/call";
  }

  const payload: CallRoutePayload = {
    v: 1,
    m: meetingId,
    p: projectId
  };

  const ref = maskText(JSON.stringify(payload));
  if (!ref) {
    const fallbackQuery = new URLSearchParams({
      meetingId,
      ...(projectId ? { projectId } : {})
    });
    return `/call?${fallbackQuery.toString()}`;
  }

  return `/call?ref=${encodeURIComponent(ref)}`;
};

export const resolveMaskedCallRoute = (params: SearchParamsLike | null): ResolvedCallRoute | null => {
  if (!params) {
    return null;
  }

  const directMeetingId = sanitizeParam(params.get("meetingId"));
  if (directMeetingId) {
    return {
      meetingId: directMeetingId,
      projectId: sanitizeParam(params.get("projectId"))
    };
  }

  const ref = sanitizeParam(params.get("ref"));
  if (!ref) {
    return null;
  }

  return decodeMaskedCallRef(ref);
};

export const decodeMaskedCallRef = (ref: string): ResolvedCallRoute | null => {
  const rawPayload = unmaskText(ref);
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<CallRoutePayload>;
    const meetingId = sanitizeParam(typeof parsed.m === "string" ? parsed.m : null);
    const projectId = sanitizeParam(typeof parsed.p === "string" ? parsed.p : null);
    const version = parsed.v;

    if (!meetingId || version !== 1) {
      return null;
    }

    return {
      meetingId,
      projectId
    };
  } catch {
    return null;
  }
};
