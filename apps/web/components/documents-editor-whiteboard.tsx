"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

interface ExcalidrawData {
  elements: unknown[];
  appState?: Record<string, unknown>;
}

const isExcalidrawData = (value: unknown): value is ExcalidrawData => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "elements" in value && Array.isArray((value as ExcalidrawData).elements);
};

const parseData = (value: string): ExcalidrawData | null => {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    // Support legacy tldraw snapshots gracefully — treat them as empty canvas
    if (parsed && typeof parsed === "object" && "store" in parsed && "schema" in parsed) {
      return null;
    }

    return isExcalidrawData(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const DocumentsEditorWhiteboard = ({
  documentId,
  value,
  readOnly,
  provider,
  onChange
}: {
  documentId: string;
  value: string;
  readOnly: boolean;
  provider?: HocuspocusProvider | null;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  onChange: (value: string) => void;
}) => {
  const fallbackDocRef = useRef<Y.Doc | null>(null);
  if (!fallbackDocRef.current) {
    fallbackDocRef.current = new Y.Doc();
  }

  const yDoc = provider?.document ?? fallbackDocRef.current;
  const yText = useMemo(() => yDoc.getText(`doc:${documentId}:whiteboard`), [documentId, yDoc]);
  const applyingRemoteRef = useRef(false);
  const readOnlyRef = useRef(readOnly);
  const apiRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const initialData = useMemo(() => {
    const raw = value || yText.toString();
    const parsed = parseData(raw);
    return parsed ?? { elements: [] as unknown[] };
  }, []);

  useEffect(() => {
    if (!yText.toString() && value.trim()) {
      yText.insert(0, value);
    }
  }, [value, yText]);

  useEffect(() => {
    const syncFromYjs = () => {
      if (applyingRemoteRef.current) {
        return;
      }

      const nextValue = yText.toString();
      const parsed = parseData(nextValue);

      if (parsed && apiRef.current) {
        applyingRemoteRef.current = true;
        apiRef.current.updateScene({ elements: parsed.elements });
        applyingRemoteRef.current = false;
      }
    };

    yText.observe(syncFromYjs);
    return () => {
      yText.unobserve(syncFromYjs);
    };
  }, [yText]);

  const handleChange = useCallback((elements: readonly any[]) => {
    if (applyingRemoteRef.current) {
      return;
    }

    const payload = JSON.stringify({ elements });

    onChangeRef.current(payload);

    if (!readOnlyRef.current) {
      applyingRemoteRef.current = true;
      yText.delete(0, yText.length);
      yText.insert(0, payload);
      applyingRemoteRef.current = false;
    }
  }, [yText]);

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Excalidraw
        excalidrawAPI={(api: unknown) => {
          apiRef.current = api;
        }}
        initialData={{
          elements: initialData.elements as any,
          appState: {
            viewBackgroundColor: "#ffffff",
            ...initialData.appState
          }
        }}
        viewModeEnabled={readOnly}
        onChange={handleChange}
      />
    </div>
  );
};
