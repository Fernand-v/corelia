"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentType } from "@corelia/types";
import { apiRequest, useAuthStore } from "@/lib/api";

type OnlyOfficeEditorProps = {
  documentId: string;
  documentType: Extract<DocumentType, "TEXTO" | "TABLA" | "PRESENTACION">;
  documentName: string;
};

type OnlyOfficeConfigResponse = {
  documentServerUrl: string;
  config: Record<string, unknown>;
};

type OnlyOfficeDocEditorInstance = {
  destroyEditor?: () => void;
};

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (
        placeholderId: string,
        config: Record<string, unknown>
      ) => OnlyOfficeDocEditorInstance;
    };
  }
}

const scriptPromiseByUrl = new Map<string, Promise<void>>();

const ensureOnlyOfficeScript = (documentServerUrl: string) => {
  const normalizedBase = documentServerUrl.replace(/\/+$/g, "");
  const scriptUrl = `${normalizedBase}/web-apps/apps/api/documents/api.js`;

  const existing = scriptPromiseByUrl.get(scriptUrl);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const currentScript = window.document.querySelector<HTMLScriptElement>(
      `script[data-onlyoffice-src="${scriptUrl}"]`
    );
    if (currentScript) {
      if (window.DocsAPI?.DocEditor) {
        resolve();
        return;
      }

      currentScript.addEventListener("load", () => resolve(), { once: true });
      currentScript.addEventListener("error", () => reject(new Error("No se pudo cargar ONLYOFFICE")), {
        once: true
      });
      return;
    }

    const script = window.document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.onlyofficeSrc = scriptUrl;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar ONLYOFFICE"));
    window.document.head.appendChild(script);
  });

  scriptPromiseByUrl.set(scriptUrl, promise);
  return promise;
};

export const OnlyOfficeEditor = ({
  documentId,
  documentType,
  documentName
}: OnlyOfficeEditorProps) => {
  const containerIdRef = useRef(
    `onlyoffice-${documentId}-${Math.random().toString(36).slice(2, 10)}`
  );
  const editorInstanceRef = useRef<OnlyOfficeDocEditorInstance | null>(null);
  const [configResponse, setConfigResponse] = useState<OnlyOfficeConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const token = useAuthStore((s) => s.accessToken);

  const titleLabel = useMemo(() => {
    if (documentType === "TEXTO") {
      return "documento";
    }
    if (documentType === "TABLA") {
      return "hoja de cálculo";
    }
    return "presentación";
  }, [documentType]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setErrorMessage(null);
    setConfigResponse(null);

    void apiRequest<OnlyOfficeConfigResponse>(
      `/documents/${encodeURIComponent(documentId)}/onlyoffice/config`
    )
      .then((response) => {
        if (cancelled) {
          return;
        }
        setConfigResponse(response);
      })
      .catch((error: Error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(error.message || "No se pudo abrir ONLYOFFICE");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!configResponse || !token) return;

    const handleBeforeUnload = () => {
      fetch(`/api/v1/documents/${encodeURIComponent(documentId)}/onlyoffice/forcesave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [configResponse, documentId, token]);

  useEffect(() => {
    if (!configResponse) {
      return;
    }

    let cancelled = false;

    void ensureOnlyOfficeScript(configResponse.documentServerUrl)
      .then(() => {
        if (cancelled) {
          return;
        }

        if (!window.DocsAPI?.DocEditor) {
          setErrorMessage("ONLYOFFICE no expuso la API del editor");
          return;
        }

        editorInstanceRef.current?.destroyEditor?.();
        editorInstanceRef.current = new window.DocsAPI.DocEditor(
          containerIdRef.current,
          {
            ...configResponse.config,
            width: "100%",
            height: "100%"
          }
        );
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setErrorMessage(error.message || "No se pudo cargar ONLYOFFICE");
        }
      });

    return () => {
      cancelled = true;
      editorInstanceRef.current?.destroyEditor?.();
      editorInstanceRef.current = null;
    };
  }, [configResponse]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
        Cargando ONLYOFFICE para este {titleLabel}...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 text-center text-sm text-red-700 shadow-sm">
        <div>
          <p className="font-semibold">No se pudo abrir {documentName || titleLabel}</p>
          <p className="mt-2">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div id={containerIdRef.current} className="h-full w-full" />
    </div>
  );
};
