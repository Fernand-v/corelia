"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { DiagramKind } from "@corelia/types";

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
  onChange: (value: string) => void;
};

export const DocumentsEditorDiagram = ({
  documentId,
  value,
  readOnly,
  provider,
  currentUser,
  diagramKind,
  onChange
}: DocumentsEditorDiagramProps) => {
  return (
    <div className="h-full min-h-[640px]">
      <MaxGraphEditorShell
        documentId={documentId}
        value={value}
        readOnly={readOnly}
        currentUser={currentUser}
        diagramKind={diagramKind ?? "FLUJO"}
        onChange={onChange}
        {...(provider !== undefined ? { provider } : {})}
      />
    </div>
  );
};
