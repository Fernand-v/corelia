"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DiagramKind,
  DocumentPresenceItem,
  DocumentType,
  DocumentsExplorerResponse
} from "@corelia/types";
import { apiRequest, getApiBaseUrl, getAuthToken, getPublicApiKey } from "@/lib/api";
import { resolveHocuspocusUrl } from "@/lib/hocuspocus";
import { useSession } from "@/lib/session";
import {
  CollaborativeDocumentsModule,
  type DocumentEditorSyncState,
  type DocumentSavePayload
} from "@/components/collaborative-documents-module";

const EMPTY_DOCUMENTS: Record<DocumentType, CollaborativeDocument[]> = {
  TEXTO: [],
  DIAGRAMA: [],
  TABLA: [],
  WHITEBOARD: [],
  PRESENTACION: []
};

const OFFLINE_GRACE_MS = 4_000;

const docsDebugEnabled = (process.env.NEXT_PUBLIC_DOCS_DEBUG ?? "false").toLowerCase() === "true";

const docsDebugLog = (...args: unknown[]) => {
  if (!docsDebugEnabled) {
    return;
  }
  console.debug("[docs-collab]", ...args);
};

const resolveUserColor = (userId: string) => {
  const palette = ["#4f6ef7", "#10b981", "#f97316", "#ec4899", "#8b5cf6", "#0ea5e9"];
  let seed = 0;
  for (const char of userId) {
    seed += char.charCodeAt(0);
  }
  return palette[seed % palette.length] ?? "#4f6ef7";
};

type VersionsResponse = {
  items: CollaborativeDocumentVersion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ProjectMemberAvailability = {
  userId: string;
  fullName: string;
};

type DocumentAssetUploadResponse = {
  id: string;
  url: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export const DocumentsBoard = ({
  projectId,
  projectName,
  initialDocumentId
}: {
  projectId: string;
  projectName?: string | null;
  initialDocumentId?: string | null;
}) => {
  const queryClient = useQueryClient();
  const session = useSession();

  const [activeDocument, setActiveDocument] = useState<CollaborativeDocument | null>(null);
  const initialOpenedRef = useRef(false);
  const [syncState, setSyncState] = useState<DocumentEditorSyncState>("synced");
  const [connectionState, setConnectionState] = useState<"connected" | "reconnecting" | "offline">("connected");
  const [providerOffline, setProviderOffline] = useState(false);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  const yDocRef = useRef<Y.Doc | null>(null);
  const websocketProviderRef = useRef<HocuspocusProviderWebsocket | null>(null);
  const offlineTimerRef = useRef<number | null>(null);
  const heartbeatInFlightRef = useRef(false);

  const currentUser = useMemo(() => {
    const user = session.data;
    if (!user) {
      return {
        id: "",
        name: "",
        color: "#4f6ef7"
      };
    }

    const fullName = `${user.firstName} ${user.lastName}`.trim();

    return {
      id: user.id,
      name: fullName,
      color: resolveUserColor(user.id)
    };
  }, [session.data]);

  const initFoldersQuery = useQuery({
    queryKey: ["documents", "init", projectId],
    queryFn: () =>
      apiRequest(`/documents/init-folders`, {
        method: "POST",
        body: JSON.stringify({ projectId })
      })
  });

  const documentsQuery = useQuery({
    queryKey: ["documents", "explorer", projectId],
    queryFn: () =>
      apiRequest<DocumentsExplorerResponse>(
        `/documents?projectId=${encodeURIComponent(projectId)}`
      ),
    enabled: initFoldersQuery.isSuccess
  });

  useEffect(() => {
    if (!initialDocumentId || initialOpenedRef.current || !documentsQuery.data) {
      return;
    }

    const allDocs = Object.values(documentsQuery.data.documentsByType).flat();
    const target = allDocs.find((doc) => doc.id === initialDocumentId);
    if (target) {
      initialOpenedRef.current = true;
      setActiveDocument(target);
    }
  }, [initialDocumentId, documentsQuery.data]);

  const presenceQuery = useQuery({
    queryKey: ["documents", "presence", projectId],
    queryFn: () =>
      apiRequest<{ items: DocumentPresenceItem[] }>(
        `/documents/presence?projectId=${encodeURIComponent(projectId)}`
      ),
    enabled: initFoldersQuery.isSuccess,
    refetchInterval: 20_000
  });

  const versionsQuery = useQuery({
    queryKey: ["documents", "versions", activeDocument?.id],
    queryFn: () =>
      apiRequest<VersionsResponse>(
        `/documents/${encodeURIComponent(activeDocument?.id ?? "")}/versions?page=1&pageSize=30`
      ),
    enabled: Boolean(activeDocument)
  });

  const membersQuery = useQuery({
    queryKey: ["documents", "project-members", projectId],
    queryFn: () =>
      apiRequest<ProjectMemberAvailability[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(projectId)}`
      ),
    enabled: Boolean(projectId)
  });

  const createDocumentMutation = useMutation({
    mutationFn: (input: {
      projectId: string;
      type: DocumentType;
      name: string;
      diagramKind?: DiagramKind;
    }) =>
      apiRequest<CollaborativeDocument>("/documents", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] });
      setActiveDocument(created);
    }
  });

  const renameDocumentMutation = useMutation({
    mutationFn: (input: { document: CollaborativeDocument; name: string }) =>
      apiRequest<CollaborativeDocument>(`/documents/${encodeURIComponent(input.document.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: input.name })
      }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["documents", "versions", updated.id] })
      ]);
      setActiveDocument((current) => (current?.id === updated.id ? updated : current));
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(`/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE"
      }),
    onSuccess: async (_, documentId) => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] });
      if (activeDocument?.id === documentId) {
        setActiveDocument(null);
      }
    }
  });

  const saveVersionMutation = useMutation({
    mutationFn: async (input: {
      document: CollaborativeDocument;
      payload: DocumentSavePayload;
    }) => {
      const fileName = input.payload.fileName ?? `${input.document.id}.json`;
      const mimeType = input.payload.mimeType ?? "application/json";
      const file = new File([input.payload.content], fileName, {
        type: mimeType
      });
      const formData = new FormData();
      formData.append("kind", input.payload.kind);
      if (input.payload.format) {
        formData.append("format", input.payload.format);
      }
      formData.append("file", file);

      return apiRequest(`/documents/${encodeURIComponent(input.document.id)}/versions`, {
        method: "POST",
        body: formData
      });
    },
    onMutate: () => {
      setSyncState("saving");
    },
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({
        queryKey: ["documents", "versions", input.document.id]
      });
      await queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] });
      setSyncState((current) => {
        if (connectionState === "offline") {
          return "offline";
        }
        if (connectionState === "reconnecting") {
          return "reconnecting";
        }
        return current === "saving" ? "synced" : current;
      });
    },
    onError: () => {
      setSyncState(connectionState === "offline" ? "offline" : connectionState === "reconnecting" ? "reconnecting" : "synced");
    }
  });

  const uploadAssetMutation = useMutation({
    mutationFn: async (input: { documentId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", input.file);

      return apiRequest<DocumentAssetUploadResponse>(
        `/documents/${encodeURIComponent(input.documentId)}/assets`,
        {
          method: "POST",
          body: formData
        }
      );
    }
  });

  const restoreVersionMutation = useMutation({
    mutationFn: (input: { documentId: string; versionId: string }) =>
      apiRequest(`/documents/${encodeURIComponent(input.documentId)}/versions/${encodeURIComponent(input.versionId)}/restore`, {
        method: "POST"
      }),
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "versions", input.documentId] }),
        queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] })
      ]);
    }
  });

  const sendPresenceHeartbeat = useCallback(
    async (documentId: string) => {
      await apiRequest(`/documents/${encodeURIComponent(documentId)}/presence`, {
        method: "POST",
        body: JSON.stringify({
          color: currentUser.color,
          cursorLabel: currentUser.name || undefined
        })
      });
    },
    [currentUser.color, currentUser.name]
  );

  useEffect(() => {
    const clearOfflineTimer = () => {
      if (offlineTimerRef.current !== null) {
        window.clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };

    const scheduleOffline = () => {
      if (offlineTimerRef.current !== null) {
        return;
      }
      offlineTimerRef.current = window.setTimeout(() => {
        offlineTimerRef.current = null;
        setConnectionState("offline");
        setProviderOffline(true);
        setSyncState((current) => (current === "saving" ? current : "offline"));
        docsDebugLog("connection state -> offline (grace timeout reached)");
      }, OFFLINE_GRACE_MS);
    };

    if (!activeDocument) {
      provider?.destroy();
      websocketProviderRef.current?.destroy();
      yDocRef.current?.destroy();
      yDocRef.current = null;
      websocketProviderRef.current = null;
      clearOfflineTimer();
      setProvider(null);
      setProviderOffline(false);
      setConnectionState("connected");
      setSyncState("synced");
      return;
    }

    const hocusConfig = resolveHocuspocusUrl();
    if (!hocusConfig.url) {
      setProvider(null);
      setProviderOffline(true);
      setConnectionState("offline");
      setSyncState("offline");
      docsDebugLog("provider disabled: no hocuspocus URL");
      return;
    }

    provider?.destroy();
    websocketProviderRef.current?.destroy();
    yDocRef.current?.destroy();
    clearOfflineTimer();

    const yDoc = new Y.Doc();
    yDocRef.current = yDoc;
    setConnectionState("reconnecting");
    setProviderOffline(false);
    setSyncState("reconnecting");
    let websocketProvider: HocuspocusProviderWebsocket;
    let nextProvider: HocuspocusProvider;
    try {
      websocketProvider = new HocuspocusProviderWebsocket({
        url: hocusConfig.url,
        delay: 1_000,
        initialDelay: 1_000,
        factor: 1.8,
        maxDelay: 10_000,
        maxAttempts: 0,
        jitter: true,
        timeout: 0
      });
      websocketProviderRef.current = websocketProvider;

      nextProvider = new HocuspocusProvider({
        websocketProvider,
        name: activeDocument.yDocName,
        document: yDoc
      });
    } catch (error) {
      docsDebugLog("provider init error", {
        documentId: activeDocument.id,
        error
      });
      setProvider(null);
      setConnectionState("offline");
      setProviderOffline(true);
      setSyncState("offline");
      return;
    }

    docsDebugLog("provider created", {
      documentId: activeDocument.id,
      yDocName: activeDocument.yDocName,
      url: hocusConfig.url,
      source: hocusConfig.source,
      configured: hocusConfig.configured
    });

    nextProvider.on("status", ({ status }: { status: "connecting" | "connected" | "disconnected" }) => {
      docsDebugLog("provider status", {
        status,
        documentId: activeDocument.id
      });

      if (status === "connected") {
        clearOfflineTimer();
        setProviderOffline(false);
        setConnectionState("connected");
        setSyncState("synced");
        return;
      }

      setProviderOffline(false);
      setConnectionState("reconnecting");
      setSyncState((current) => (current === "saving" ? current : "reconnecting"));
      scheduleOffline();
    });

    nextProvider.on("synced", () => {
      clearOfflineTimer();
      setProviderOffline(false);
      setConnectionState("connected");
      setSyncState("synced");
      docsDebugLog("provider synced", {
        documentId: activeDocument.id
      });
    });

    nextProvider.on("disconnect", () => {
      setConnectionState("reconnecting");
      setSyncState((current) => (current === "saving" ? current : "reconnecting"));
      scheduleOffline();
      docsDebugLog("provider disconnect event", {
        documentId: activeDocument.id
      });
    });

    setProvider(nextProvider);

    return () => {
      clearOfflineTimer();
      nextProvider.destroy();
      websocketProvider.destroy();
      yDoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocument?.id, activeDocument?.yDocName]);

  useEffect(() => {
    if (
      !activeDocument?.id ||
      !currentUser.id ||
      providerOffline ||
      connectionState !== "connected"
    ) {
      return;
    }

    const sendHeartbeat = async () => {
      if (heartbeatInFlightRef.current) {
        return;
      }

      heartbeatInFlightRef.current = true;
      try {
        await sendPresenceHeartbeat(activeDocument.id);
      } catch {
        // noop
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };

    void sendHeartbeat();

    const timer = window.setInterval(() => {
      void sendHeartbeat();
    }, 20_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeDocument?.id,
    connectionState,
    currentUser.id,
    providerOffline,
    sendPresenceHeartbeat
  ]);

  const activeCollaborators = presenceQuery.data?.items ?? documentsQuery.data?.activeCollaborators ?? [];
  const members = useMemo(() => {
    const rows = membersQuery.data ?? [];
    return rows.map((member) => ({
      id: member.userId,
      name: member.fullName,
      color: resolveUserColor(member.userId)
    }));
  }, [membersQuery.data]);

  const fetchVersionPreview = async (
    document: CollaborativeDocument,
    version: CollaborativeDocumentVersion
  ) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Sesión no válida");
    }

    const response = await fetch(
      `${getApiBaseUrl()}/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(version.id)}/content?mode=inline`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": getPublicApiKey()
        }
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "No se pudo cargar la versión" }));
      throw new Error(body.message ?? "No se pudo cargar la versión");
    }

    return response.text();
  };

  const combinedError =
    createDocumentMutation.error?.message ??
    renameDocumentMutation.error?.message ??
    deleteDocumentMutation.error?.message ??
    saveVersionMutation.error?.message ??
    uploadAssetMutation.error?.message ??
    restoreVersionMutation.error?.message ??
    documentsQuery.error?.message ??
    initFoldersQuery.error?.message ??
    null;

  return (
    <CollaborativeDocumentsModule
      project={{
        id: projectId,
        name: projectName ?? "Proyecto"
      }}
      documents={documentsQuery.data?.documentsByType ?? EMPTY_DOCUMENTS}
      currentUser={currentUser}
      activeCollaborators={activeCollaborators}
      activeDocument={activeDocument}
      versions={versionsQuery.data?.items ?? []}
      loading={initFoldersQuery.isLoading || documentsQuery.isLoading}
      errorMessage={combinedError}
      isProviderOffline={providerOffline}
      syncState={syncState}
      connectionState={connectionState}
      yjsProvider={provider}
      members={members}
      onRetry={() => {
        void initFoldersQuery.refetch();
        void documentsQuery.refetch();
        void presenceQuery.refetch();
      }}
      onCreateDocument={async (input) => {
        const created = await createDocumentMutation.mutateAsync(input);
        return created;
      }}
      onOpenDocument={(document) => {
        setActiveDocument(document);
      }}
      onCloseDocument={() => {
        setActiveDocument(null);
      }}
      onDeleteDocument={async (document) => {
        await deleteDocumentMutation.mutateAsync(document.id);
      }}
      onRenameDocument={async (document, newName) => {
        await renameDocumentMutation.mutateAsync({
          document,
          name: newName
        });
      }}
      onSaveVersion={async (document, payload) => {
        await saveVersionMutation.mutateAsync({
          document,
          payload
        });
      }}
      onUploadDocumentAsset={async (document, file) => {
        const uploaded = await uploadAssetMutation.mutateAsync({
          documentId: document.id,
          file
        });
        return { url: uploaded.url };
      }}
      onRestoreVersion={async (document, version) => {
        await restoreVersionMutation.mutateAsync({
          documentId: document.id,
          versionId: version.id
        });
      }}
      onLoadVersions={(document) => {
        if (activeDocument?.id !== document.id) {
          setActiveDocument(document);
          return;
        }
        void versionsQuery.refetch();
      }}
      onPreviewVersion={fetchVersionPreview}
    />
  );
};
