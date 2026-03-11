"use client";

import { memo, useRef } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { DiagramKind } from "@corelia/types";
import type { DiagramOfflineMode } from "@/components/diagram/maxgraph/types";

import { MaxGraphEditorShell } from "@/components/diagram/maxgraph/maxgraph-editor-shell";

type DocumentsEditorDiagramProps = {
  documentId: string;
  value: string;
  readOnly: boolean;
  provider?: HocuspocusProvider | null;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  diagramEngine?: "EXCALIDRAW" | "REACT_FLOW" | null;
  diagramKind?: DiagramKind | null;
  offlineMode?: DiagramOfflineMode;
  connectionState?: "connected" | "reconnecting" | "offline";
  onLegacyMigration?: (input: {
    droppedPageIds: string[];
    activePageId: string;
    backupSnapshot: string;
  }) => void | Promise<void>;
  onChange: (value: string) => void;
};

// The diagram editor manages its own state internally via Y.js (yText).
// The `value` prop is only consumed on initial mount (bootstrap); subsequent
// changes are echoes of the editor's own onChange and would trigger expensive
// re-renders of the heavy MaxGraphEditorShell component for no benefit.
// React.memo with a custom comparator that ignores `value` prevents this.
export const DocumentsEditorDiagram = memo(({
  documentId,
  value,
  readOnly,
  provider,
  currentUser,
  diagramKind,
  offlineMode = "readonly",
  connectionState = "connected",
  onLegacyMigration,
  onChange
}: DocumentsEditorDiagramProps) => {
  // Capture the initial value on mount; the runtime reads latestValueRef
  // for any post-bootstrap fallback so prop updates are unnecessary.
  const initialValueRef = useRef(value);

  return (
    <div className="h-full min-h-0">
      <MaxGraphEditorShell
        documentId={documentId}
        value={initialValueRef.current}
        readOnly={readOnly}
        currentUser={currentUser}
        diagramKind={diagramKind ?? "FLUJO"}
        offlineMode={offlineMode}
        connectionState={connectionState}
        {...(onLegacyMigration ? { onLegacyMigration } : {})}
        onChange={onChange}
        {...(provider !== undefined ? { provider } : {})}
      />
    </div>
  );
}, (prev, next) => {
  // Re-render only when structurally meaningful props change.
  // `value` is intentionally excluded — the editor syncs via Y.js internally.
  // `onChange` is excluded because the parent's handleDraftChange is stable
  // (depends only on activeDocumentId, and document switches cause a remount
  // via key={activeDocument.id}).
  return (
    prev.documentId === next.documentId &&
    prev.readOnly === next.readOnly &&
    prev.provider === next.provider &&
    prev.currentUser === next.currentUser &&
    prev.diagramKind === next.diagramKind &&
    prev.offlineMode === next.offlineMode &&
    prev.connectionState === next.connectionState
  );
});
