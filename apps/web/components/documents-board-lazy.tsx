"use client";

import dynamic from "next/dynamic";

const DocumentsBoard = dynamic(
  () => import("@/components/documents-board").then((mod) => mod.DocumentsBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-mid">
        Cargando documentos...
      </div>
    )
  }
);

export const DocumentsBoardLazy = (props: {
  projectId: string;
  projectName?: string | null;
  initialDocumentId?: string | null;
}) => <DocumentsBoard {...props} />;
