type DocumentsEditorRoutePayload = {
  v: 1;
  d: string;
  p: string;
  n: string | null;
};

type ResolvedDocumentsEditorRoute = {
  documentId: string;
  projectId: string;
  projectName: string | null;
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

export const buildMaskedDocumentsEditorRoute = (input: {
  documentId: string;
  projectId: string;
  projectName?: string | null;
}) => {
  const documentId = sanitizeParam(input.documentId);
  const projectId = sanitizeParam(input.projectId);
  const projectName = sanitizeParam(input.projectName ?? null);

  if (!documentId || !projectId) {
    return "/documents-editor";
  }

  const payload: DocumentsEditorRoutePayload = {
    v: 1,
    d: documentId,
    p: projectId,
    n: projectName
  };

  const ref = maskText(JSON.stringify(payload));
  if (!ref) {
    const fallbackQuery = new URLSearchParams({
      id: documentId,
      projectId,
      ...(projectName ? { projectName } : {})
    });
    return `/documents-editor?${fallbackQuery.toString()}`;
  }

  return `/documents-editor?ref=${encodeURIComponent(ref)}`;
};

export const decodeMaskedDocumentsEditorRef = (
  ref: string
): ResolvedDocumentsEditorRoute | null => {
  const rawPayload = unmaskText(ref);
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<DocumentsEditorRoutePayload>;
    const documentId = sanitizeParam(typeof parsed.d === "string" ? parsed.d : null);
    const projectId = sanitizeParam(typeof parsed.p === "string" ? parsed.p : null);
    const projectName = sanitizeParam(typeof parsed.n === "string" ? parsed.n : null);
    const version = parsed.v;

    if (!documentId || !projectId || version !== 1) {
      return null;
    }

    return {
      documentId,
      projectId,
      projectName
    };
  } catch {
    return null;
  }
};
