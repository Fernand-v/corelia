"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLStoreSnapshot } from "tldraw";
import "tldraw/tldraw.css";

const isTLStoreSnapshot = (value: unknown): value is TLStoreSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "store" in value && "schema" in value;
};

const parseSnapshot = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isTLStoreSnapshot(parsed) ? parsed : null;
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
  const editorRef = useRef<Editor | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        loadSnapshot(editorRef.current.store, parsed);
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
          onMount: (editor: Editor) => {
            editorRef.current = editor;

            const parsed = parseSnapshot(snapshotPayload);
            if (parsed && editor.store) {
              loadSnapshot(editor.store, parsed);
            }

            // Populate initial draft so manual save works without drawing
            const initialSnapshot = getSnapshot(editor.store);
            const initialPayload = JSON.stringify(initialSnapshot);
            onChangeRef.current(initialPayload);

            unsubscribeRef.current?.();
            unsubscribeRef.current = editor.store.listen(() => {
              if (applyingRemoteRef.current) {
                return;
              }

              const snapshot = getSnapshot(editor.store);
              const payload = JSON.stringify(snapshot);

              setSnapshotPayload(payload);
              onChangeRef.current(payload);

              // Only sync to Y.js when not in readOnly (offline) mode
              if (!readOnlyRef.current) {
                applyingRemoteRef.current = true;
                yText.delete(0, yText.length);
                yText.insert(0, payload);
                applyingRemoteRef.current = false;
              }
            });
          },
          isReadonly: readOnly
        } as Record<string, unknown>)}
      />
    </div>
  );
};
