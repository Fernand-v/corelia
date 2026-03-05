"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Tldraw, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";

const parseSnapshot = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
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
  const editorRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [snapshotPayload, setSnapshotPayload] = useState<string>(() => value || yText.toString());

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
      setSnapshotPayload(nextValue);
      const parsed = parseSnapshot(nextValue);

      if (parsed && editorRef.current?.store) {
        loadSnapshot(editorRef.current.store, parsed as any);
      }
    };

    yText.observe(syncFromYjs);
    return () => {
      yText.unobserve(syncFromYjs);
    };
  }, [yText]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Tldraw
        {...({
          onMount: (editor: any) => {
            editorRef.current = editor;

            const parsed = parseSnapshot(snapshotPayload);
            if (parsed && editor.store) {
              loadSnapshot(editor.store, parsed as any);
            }

            unsubscribeRef.current?.();
            unsubscribeRef.current = editor.store.listen(() => {
              if (readOnly || applyingRemoteRef.current) {
                return;
              }

              const snapshot = getSnapshot(editor.store);
              const payload = JSON.stringify(snapshot);

              setSnapshotPayload(payload);
              onChange(payload);

              applyingRemoteRef.current = true;
              yText.delete(0, yText.length);
              yText.insert(0, payload);
              applyingRemoteRef.current = false;
            });
          },
          isReadonly: readOnly
        } as Record<string, unknown>)}
      />
    </div>
  );
};
