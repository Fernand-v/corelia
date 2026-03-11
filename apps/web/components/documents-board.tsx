"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CollaborativeDocument,
  DocumentCollabTokenResponse,
  CollaborativeDocumentVersion,
  DiagramKind,
  DocumentPresenceItem,
  DocumentTemplate,
  DocumentType,
  DocumentsExplorerResponse
} from "@corelia/types";
import { apiRequest, getApiBaseUrl, getAuthToken } from "@/lib/api";
import { exportDiagramV3ToDrawioDocument } from "@/lib/diagram/maxgraph/diagram-collab-v3";
import { serializeMxfile } from "@/lib/diagram/maxgraph/xml-format";
import { getActivePage } from "@/lib/diagram/maxgraph/xml-pages";
import { parseDiagramSource } from "@/lib/diagram/maxgraph/xml-serializer";
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
const DEFAULT_DIAGRAM_SESSION_HEARTBEAT_MS = 20_000;
const DEFAULT_DIAGRAM_SESSION_SNAPSHOT_MS = 30_000;
const DIAGRAM_USER_CELL_REGEX = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/i;

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

type DiagramSessionSnapshotReason =
  | "interval"
  | "leave"
  | "before_unload"
  | "manual_save"
  | "migration";

type DocumentDiagramSessionParticipant = {
  userId: string;
  clientId: string;
  name: string;
  status: "ONLINE" | "OFFLINE";
  joinedAt: string;
  leftAt: string | null;
  lastHeartbeatAt: string | null;
};

type DocumentDiagramSessionJoinResponse = {
  sessionId: string;
  roomName: string;
  status: "ACTIVE" | "CLOSED";
  heartbeatMs: number;
  snapshotIntervalMs: number;
  startedAt: string;
  lastActivityAt: string;
  revision: number;
  lastSnapshotAt: string | null;
  lastSnapshotHash: string | null;
  participants: DocumentDiagramSessionParticipant[];
};

type DocumentDiagramSessionHeartbeatResponse = {
  ok: true;
  sessionId: string;
  lastHeartbeatAt: string;
  participantsOnline: number;
  revision: number;
  lastEvent: string | null;
};

type DocumentDiagramSessionSnapshotResponse = {
  ok: true;
  sessionId: string;
  deduped: boolean;
  revision: number;
  snapshotHash: string;
  snapshotAt: string;
  eventType: string;
};

type DiagramSessionClientState = {
  documentId: string;
  sessionId: string;
  clientId: string;
  roomName: string;
  heartbeatMs: number;
  snapshotIntervalMs: number;
  lastHeartbeatAt: string | null;
  lastSnapshotAt: string | null;
  lastSnapshotHash: string | null;
  lastSnapshotFingerprint: string | null;
  revision: number;
  pendingChanges: boolean;
  lastEvent: string | null;
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
  const saveVersionInFlightRef = useRef<Set<string>>(new Set());
  const diagramSessionRef = useRef<DiagramSessionClientState | null>(null);
  const sessionHeartbeatInFlightRef = useRef(false);
  const sessionSnapshotInFlightRef = useRef(false);
  const [diagramSessionState, setDiagramSessionState] = useState<DiagramSessionClientState | null>(null);

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

  const resolveDocumentCollabToken = useCallback(
    async (documentId: string) => {
      const response = await apiRequest<DocumentCollabTokenResponse>(
        `/documents/${encodeURIComponent(documentId)}/collab-token`,
        {
          method: "POST",
        },
      );

      return response.token;
    },
    [],
  );

  const buildContentFingerprint = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "0";
    }
    const head = trimmed.slice(0, 96);
    const tail = trimmed.slice(-96);
    return `${trimmed.length}:${head}:${tail}`;
  }, []);

  const isDiagramPayloadEffectivelyEmpty = useCallback(
    (raw: string, fallbackKind: DiagramKind) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        return true;
      }

      try {
        const parsed = parseDiagramSource(trimmed, fallbackKind);
        const activePage = getActivePage(parsed.document);
        const activeXml = activePage?.xml?.trim() ?? "";
        if (!activeXml) {
          return true;
        }

        const customCellRegex = /<mxCell\b[^>]*\bid=(['"])(?!0\1|1\1)[^'"]+\1/gi;
        return !customCellRegex.test(activeXml);
      } catch {
        return false;
      }
    },
    []
  );

  const createDiagramClientId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `diagram-client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const requestLiveDiagramSnapshot = useCallback((documentId: string): string => {
    if (typeof window === "undefined") {
      return "";
    }
    let snapshot = "";
    window.dispatchEvent(
      new CustomEvent("corelia:diagram-request-snapshot", {
        detail: {
          documentId,
          capture: (payload: string) => {
            snapshot = payload.trim();
          }
        }
      })
    );
    return snapshot;
  }, []);

  const joinDiagramSession = useCallback(
    async (documentId: string, clientId: string) => {
      return apiRequest<DocumentDiagramSessionJoinResponse>(
        `/documents/${encodeURIComponent(documentId)}/diagram-session/join`,
        {
          method: "POST",
          body: JSON.stringify({ clientId })
        }
      );
    },
    []
  );

  const heartbeatDiagramSession = useCallback(
    async (documentId: string, sessionId: string, clientId: string) => {
      return apiRequest<DocumentDiagramSessionHeartbeatResponse>(
        `/documents/${encodeURIComponent(documentId)}/diagram-session/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({ sessionId, clientId })
        }
      );
    },
    []
  );

  const leaveDiagramSession = useCallback(
    async (documentId: string, sessionId: string, clientId: string) => {
      return apiRequest<{ ok: true; sessionId: string; leftAt: string }>(
        `/documents/${encodeURIComponent(documentId)}/diagram-session/leave`,
        {
          method: "POST",
          body: JSON.stringify({ sessionId, clientId })
        }
      );
    },
    []
  );

  const persistDiagramSessionSnapshot = useCallback(
    async (input: {
      documentId: string;
      sessionId: string;
      clientId: string;
      content: string;
      reason: DiagramSessionSnapshotReason;
      metadata?: Record<string, unknown>;
    }) => {
      return apiRequest<DocumentDiagramSessionSnapshotResponse>(
        `/documents/${encodeURIComponent(input.documentId)}/diagram-session/snapshot`,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: input.sessionId,
            clientId: input.clientId,
            content: input.content,
            reason: input.reason,
            ...(input.metadata ? { metadata: input.metadata } : {})
          })
        }
      );
    },
    []
  );

  const flushDiagramSessionSnapshot = useCallback(
    async (input: {
      documentId: string;
      reason: DiagramSessionSnapshotReason;
      metadata?: Record<string, unknown>;
      contentOverride?: string;
    }) => {
      const session = diagramSessionRef.current;
      if (!session || session.documentId !== input.documentId) {
        return null;
      }

      const liveSnapshot = input.contentOverride
        ? ""
        : requestLiveDiagramSnapshot(input.documentId);
      const rawContent =
        input.contentOverride ??
        (liveSnapshot ||
          yDocRef.current?.getText(`doc:${input.documentId}:diagram`).toString() ||
          "");
      const content = rawContent.trim();
      if (!content) {
        return null;
      }

      const fingerprint = buildContentFingerprint(content);
      const shouldSkipSameFingerprint = input.reason !== "migration";
      if (shouldSkipSameFingerprint && session.lastSnapshotFingerprint === fingerprint) {
        return null;
      }
      if (sessionSnapshotInFlightRef.current) {
        return null;
      }

      sessionSnapshotInFlightRef.current = true;
      try {
        const response = await persistDiagramSessionSnapshot({
          documentId: input.documentId,
          sessionId: session.sessionId,
          clientId: session.clientId,
          content,
          reason: input.reason,
          ...(input.metadata ? { metadata: input.metadata } : {})
        });

        const nextState: DiagramSessionClientState = {
          ...session,
          revision: response.revision,
          lastSnapshotAt: response.snapshotAt,
          lastSnapshotHash: response.snapshotHash,
          lastSnapshotFingerprint: fingerprint,
          pendingChanges: false,
          lastEvent: response.eventType
        };
        diagramSessionRef.current = nextState;
        setDiagramSessionState(nextState);
        return response;
      } catch (error) {
        docsDebugLog("diagram session snapshot error", {
          documentId: input.documentId,
          reason: input.reason,
          error
        });
        return null;
      } finally {
        sessionSnapshotInFlightRef.current = false;
      }
    },
    [buildContentFingerprint, persistDiagramSessionSnapshot, requestLiveDiagramSnapshot]
  );

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

  const buildSaveVersionFingerprint = useCallback((payload: DocumentSavePayload) => {
    const normalizedContent = payload.content.trim();
    const head = normalizedContent.slice(0, 96);
    const tail = normalizedContent.slice(-96);
    return `${payload.kind}:${payload.format ?? ""}:${normalizedContent.length}:${head}:${tail}`;
  }, []);

  const resolveDiagramVersionPayload = useCallback(
    (document: CollaborativeDocument, fallbackContent: string) => {
      const liveSnapshot = requestLiveDiagramSnapshot(document.id);
      if (liveSnapshot && DIAGRAM_USER_CELL_REGEX.test(liveSnapshot)) {
        return liveSnapshot;
      }

      const yDoc = yDocRef.current;
      if (!yDoc) {
        return liveSnapshot || fallbackContent.trim();
      }

      const fallbackKind: DiagramKind = document.diagramKind ?? "ARQUITECTURA";
      try {
        const yDiagramMap = yDoc.getMap(`doc:${document.id}:diagram:v3`);
        const v3Payload = serializeMxfile(
          exportDiagramV3ToDrawioDocument(yDiagramMap, fallbackKind)
        ).trim();
        if (v3Payload && DIAGRAM_USER_CELL_REGEX.test(v3Payload)) {
          return v3Payload;
        }

        const yTextPayload = yDoc.getText(`doc:${document.id}:diagram`).toString().trim();
        if (yTextPayload && DIAGRAM_USER_CELL_REGEX.test(yTextPayload)) {
          return yTextPayload;
        }

        // Only return a payload that contains user cells; falling back to an
        // empty mxfile would overwrite a valid version on close.
        const bestEffort = liveSnapshot || v3Payload || yTextPayload || fallbackContent.trim();
        if (bestEffort && DIAGRAM_USER_CELL_REGEX.test(bestEffort)) {
          return bestEffort;
        }
        return "";
      } catch (error) {
        docsDebugLog("diagram version payload resolve fallback", {
          documentId: document.id,
          error
        });
        const fallback = liveSnapshot || fallbackContent.trim();
        if (fallback && DIAGRAM_USER_CELL_REGEX.test(fallback)) {
          return fallback;
        }
        return "";
      }
    },
    [requestLiveDiagramSnapshot]
  );

  const handleSaveVersion = useCallback(
    async (document: CollaborativeDocument, payload: DocumentSavePayload) => {
      const normalizedContent =
        document.type === "DIAGRAMA"
          ? resolveDiagramVersionPayload(document, payload.content)
          : payload.content.trim();
      if (!normalizedContent) {
        return;
      }

      const normalizedPayload: DocumentSavePayload = {
        ...payload,
        content: normalizedContent
      };
      const dedupeKey = `${document.id}:${buildSaveVersionFingerprint(normalizedPayload)}`;
      if (saveVersionInFlightRef.current.has(dedupeKey)) {
        docsDebugLog("save_version_deduped", {
          documentId: document.id,
          kind: payload.kind
        });
        return;
      }

      saveVersionInFlightRef.current.add(dedupeKey);
      try {
        await saveVersionMutation.mutateAsync({
          document,
          payload: normalizedPayload
        });

        if (document.type === "DIAGRAMA" && normalizedPayload.kind === "MANUAL") {
          await flushDiagramSessionSnapshot({
            documentId: document.id,
            reason: "manual_save",
            contentOverride: normalizedPayload.content
          });
        }
      } finally {
        saveVersionInFlightRef.current.delete(dedupeKey);
      }
    },
    [
      buildSaveVersionFingerprint,
      flushDiagramSessionSnapshot,
      resolveDiagramVersionPayload,
      saveVersionMutation
    ]
  );

  const handleDiagramLegacyMigration = useCallback(
    async (
      document: CollaborativeDocument,
      migration: {
        droppedPageIds: string[];
        activePageId: string;
        backupSnapshot: string;
      }
    ) => {
      if (document.type !== "DIAGRAMA") {
        return;
      }

      await flushDiagramSessionSnapshot({
        documentId: document.id,
        reason: "migration",
        contentOverride: migration.backupSnapshot,
        metadata: {
          droppedPageIds: migration.droppedPageIds,
          activePageId: migration.activePageId
        }
      });
    },
    [flushDiagramSessionSnapshot]
  );

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

  const fetchVersionContentById = useCallback(
    async (documentId: string, versionId: string) => {
      const token = getAuthToken();
      if (!token) {
        throw new Error("Sesión no válida");
      }

      const response = await fetch(
        `${getApiBaseUrl()}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/content?mode=inline`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "No se pudo cargar la versión" }));
        throw new Error(body.message ?? "No se pudo cargar la versión");
      }

      return response.text();
    },
    []
  );

  const fetchLatestPersistedContent = useCallback(
    async (documentId: string): Promise<string | null> => {
      const versions = await apiRequest<VersionsResponse>(
        `/documents/${encodeURIComponent(documentId)}/versions?page=1&pageSize=1`
      );
      const latest = versions.items[0];
      if (!latest) {
        return null;
      }
      return fetchVersionContentById(documentId, latest.id);
    },
    [fetchVersionContentById]
  );

  // ── Trash ──────────────────────────────────────────────

  const trashQuery = useQuery({
    queryKey: ["documents", "trash", projectId],
    queryFn: () =>
      apiRequest<{ items: CollaborativeDocument[] }>(
        `/documents/trash?projectId=${encodeURIComponent(projectId)}`
      ),
    enabled: false // only fetch when user opens trash view
  });

  const restoreDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(`/documents/${encodeURIComponent(documentId)}/restore`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["documents", "trash", projectId] })
      ]);
    }
  });

  // ── Duplicate ──────────────────────────────────────────

  const duplicateDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiRequest<CollaborativeDocument>(`/documents/${encodeURIComponent(documentId)}/duplicate`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] });
    }
  });

  // ── Favorites ──────────────────────────────────────────

  const toggleFavoriteMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiRequest<{ isFavorite: boolean }>(`/documents/${encodeURIComponent(documentId)}/favorite`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] });
    }
  });

  // ── Templates ──────────────────────────────────────────

  const templatesQuery = useQuery({
    queryKey: ["documents", "templates", projectId],
    queryFn: () =>
      apiRequest<{ items: DocumentTemplate[] }>(
        `/documents/templates?projectId=${encodeURIComponent(projectId)}`
      ),
    enabled: false // fetch on demand
  });

  const createTemplateMutation = useMutation({
    mutationFn: (input: { documentId: string; name: string; description?: string }) =>
      apiRequest<DocumentTemplate>("/documents/templates", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "templates", projectId] });
    }
  });

  // ── Batch operations ───────────────────────────────────

  const batchDeleteMutation = useMutation({
    mutationFn: (documentIds: string[]) =>
      apiRequest("/documents/batch-delete", {
        method: "POST",
        body: JSON.stringify({ documentIds })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] });
    }
  });

  const batchRestoreMutation = useMutation({
    mutationFn: (documentIds: string[]) =>
      apiRequest("/documents/batch-restore", {
        method: "POST",
        body: JSON.stringify({ documentIds })
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "explorer", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["documents", "trash", projectId] })
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

    const destroyCurrentCollab = () => {
      provider?.destroy();
      websocketProviderRef.current?.destroy();
      yDocRef.current?.destroy();
      yDocRef.current = null;
      websocketProviderRef.current = null;
      setProvider(null);
    };

    if (!activeDocument) {
      destroyCurrentCollab();
      clearOfflineTimer();
      diagramSessionRef.current = null;
      setDiagramSessionState(null);
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
      diagramSessionRef.current = null;
      setDiagramSessionState(null);
      docsDebugLog("provider disabled: no hocuspocus URL");
      return;
    }

    destroyCurrentCollab();
    clearOfflineTimer();

    let disposed = false;
    let localYDoc: Y.Doc | null = null;
    let localWebsocketProvider: HocuspocusProviderWebsocket | null = null;
    let localProvider: HocuspocusProvider | null = null;
    let cleanupSession: { documentId: string; sessionId: string; clientId: string } | null = null;

    setConnectionState("reconnecting");
    setProviderOffline(false);
    setSyncState("reconnecting");
    void (async () => {
      localYDoc = new Y.Doc();
      yDocRef.current = localYDoc;

      let roomName = activeDocument.yDocName;
      if (activeDocument.type === "DIAGRAMA") {
        const fallbackKind: DiagramKind = activeDocument.diagramKind ?? "ARQUITECTURA";
        const clientId = createDiagramClientId();
        try {
          const joined = await joinDiagramSession(activeDocument.id, clientId);
          if (disposed) {
            return;
          }

          const sessionState: DiagramSessionClientState = {
            documentId: activeDocument.id,
            sessionId: joined.sessionId,
            clientId,
            roomName: joined.roomName,
            heartbeatMs: joined.heartbeatMs || DEFAULT_DIAGRAM_SESSION_HEARTBEAT_MS,
            snapshotIntervalMs: joined.snapshotIntervalMs || DEFAULT_DIAGRAM_SESSION_SNAPSHOT_MS,
            lastHeartbeatAt: null,
            lastSnapshotAt: joined.lastSnapshotAt,
            lastSnapshotHash: joined.lastSnapshotHash,
            lastSnapshotFingerprint: null,
            revision: joined.revision,
            pendingChanges: false,
            lastEvent: null
          };
          diagramSessionRef.current = sessionState;
          setDiagramSessionState(sessionState);
          cleanupSession = {
            documentId: activeDocument.id,
            sessionId: joined.sessionId,
            clientId
          };
          roomName = joined.roomName;

          const isFreshSession =
            joined.revision === 0 &&
            !joined.lastSnapshotHash &&
            Array.isArray(joined.participants) &&
            joined.participants.length <= 1;

          if (isFreshSession && localYDoc) {
            try {
              const latestSnapshot = await fetchLatestPersistedContent(activeDocument.id);
              const normalized = latestSnapshot?.trim() ?? "";
              if (normalized && !isDiagramPayloadEffectivelyEmpty(normalized, fallbackKind)) {
                const yText = localYDoc.getText(`doc:${activeDocument.id}:diagram`);
                if (isDiagramPayloadEffectivelyEmpty(yText.toString(), fallbackKind)) {
                  if (yText.length > 0) {
                    yText.delete(0, yText.length);
                  }
                  yText.insert(0, normalized);
                  docsDebugLog("diagram bootstrap seeded from latest persisted version", {
                    documentId: activeDocument.id,
                    sessionId: joined.sessionId,
                    bytes: normalized.length
                  });
                }
              }
            } catch (error) {
              docsDebugLog("diagram bootstrap seed failed", {
                documentId: activeDocument.id,
                sessionId: joined.sessionId,
                error
              });
            }
          }

          docsDebugLog("diagram session joined", {
            documentId: activeDocument.id,
            sessionId: joined.sessionId,
            roomName: joined.roomName,
            revision: joined.revision
          });
        } catch (error) {
          docsDebugLog("diagram session join error", {
            documentId: activeDocument.id,
            error
          });
          if (!disposed) {
            setProvider(null);
            setConnectionState("offline");
            setProviderOffline(true);
            setSyncState("offline");
          }
          return;
        }
      } else {
        diagramSessionRef.current = null;
        setDiagramSessionState(null);
      }

      try {
        localWebsocketProvider = new HocuspocusProviderWebsocket({
          url: hocusConfig.url,
          delay: 1_000,
          initialDelay: 1_000,
          factor: 1.8,
          maxDelay: 10_000,
          maxAttempts: 0,
          jitter: true,
          timeout: 0
        });
        websocketProviderRef.current = localWebsocketProvider;

        localProvider = new HocuspocusProvider({
          websocketProvider: localWebsocketProvider,
          name: roomName,
          document: localYDoc,
          token: () => resolveDocumentCollabToken(activeDocument.id),
        });
      } catch (error) {
        docsDebugLog("provider init error", {
          documentId: activeDocument.id,
          error
        });
        if (!disposed) {
          setProvider(null);
          setConnectionState("offline");
          setProviderOffline(true);
          setSyncState("offline");
        }
        return;
      }

      docsDebugLog("provider created", {
        documentId: activeDocument.id,
        yDocName: roomName,
        url: hocusConfig.url,
        source: hocusConfig.source,
        configured: hocusConfig.configured
      });

      let didHydrateFromPersistedVersion = false;
      let hydrateFromPersistedInFlight = false;
      const hydrateFromLatestVersionIfNeeded = async (trigger: "status_connected" | "synced") => {
        if (disposed || activeDocument.type !== "DIAGRAMA" || !localYDoc) {
          return;
        }
        if (didHydrateFromPersistedVersion || hydrateFromPersistedInFlight) {
          return;
        }

        const fallbackKind: DiagramKind = activeDocument.diagramKind ?? "ARQUITECTURA";
        const yText = localYDoc.getText(`doc:${activeDocument.id}:diagram`);
        if (!isDiagramPayloadEffectivelyEmpty(yText.toString(), fallbackKind)) {
          return;
        }

        hydrateFromPersistedInFlight = true;
        try {
          const latestSnapshot = await fetchLatestPersistedContent(activeDocument.id);
          const normalized = latestSnapshot?.trim() ?? "";
          if (!normalized || isDiagramPayloadEffectivelyEmpty(normalized, fallbackKind)) {
            return;
          }

          const latestYText = localYDoc.getText(`doc:${activeDocument.id}:diagram`);
          if (!isDiagramPayloadEffectivelyEmpty(latestYText.toString(), fallbackKind)) {
            return;
          }

          if (latestYText.length > 0) {
            latestYText.delete(0, latestYText.length);
          }
          latestYText.insert(0, normalized);
          didHydrateFromPersistedVersion = true;

          const session = diagramSessionRef.current;
          if (session && session.documentId === activeDocument.id) {
            const nextState: DiagramSessionClientState = {
              ...session,
              pendingChanges: false,
              lastSnapshotFingerprint: buildContentFingerprint(normalized)
            };
            diagramSessionRef.current = nextState;
            setDiagramSessionState(nextState);
          }

          docsDebugLog("diagram post-sync hydration from latest persisted version", {
            documentId: activeDocument.id,
            sessionId: diagramSessionRef.current?.sessionId,
            trigger,
            bytes: normalized.length
          });
        } catch (error) {
          docsDebugLog("diagram post-sync hydration failed", {
            documentId: activeDocument.id,
            trigger,
            error
          });
        } finally {
          hydrateFromPersistedInFlight = false;
        }
      };

      localProvider.on("status", ({ status }: { status: "connecting" | "connected" | "disconnected" }) => {
        docsDebugLog("provider status", {
          status,
          documentId: activeDocument.id
        });

        if (status === "connected") {
          clearOfflineTimer();
          setProviderOffline(false);
          setConnectionState("connected");
          setSyncState("synced");
          void hydrateFromLatestVersionIfNeeded("status_connected");
          return;
        }

        setProviderOffline(false);
        setConnectionState("reconnecting");
        setSyncState((current) => (current === "saving" ? current : "reconnecting"));
        scheduleOffline();
      });

      localProvider.on("synced", () => {
        clearOfflineTimer();
        setProviderOffline(false);
        setConnectionState("connected");
        setSyncState("synced");
        docsDebugLog("provider synced", {
          documentId: activeDocument.id
        });
        void hydrateFromLatestVersionIfNeeded("synced");
      });

      localProvider.on("disconnect", () => {
        setConnectionState("reconnecting");
        setSyncState((current) => (current === "saving" ? current : "reconnecting"));
        scheduleOffline();
        docsDebugLog("provider disconnect event", {
          documentId: activeDocument.id
        });
      });

      if (!disposed) {
        setProvider(localProvider);
      }
    })();

    return () => {
      disposed = true;
      clearOfflineTimer();
      const session = cleanupSession;
      if (session) {
        const leaveSnapshotRaw = localYDoc
          ?.getText(`doc:${session.documentId}:diagram`)
          .toString()
          .trim();
        // Only send the leave snapshot if it contains user cells; a stale or
        // empty yText would overwrite valid session data.
        const leaveSnapshotContent =
          leaveSnapshotRaw && DIAGRAM_USER_CELL_REGEX.test(leaveSnapshotRaw)
            ? leaveSnapshotRaw
            : null;
        void (async () => {
          if (leaveSnapshotContent) {
            try {
              await persistDiagramSessionSnapshot({
                documentId: session.documentId,
                sessionId: session.sessionId,
                clientId: session.clientId,
                content: leaveSnapshotContent,
                reason: "leave"
              });
            } catch (error) {
              docsDebugLog("diagram session leave snapshot error", {
                documentId: session.documentId,
                sessionId: session.sessionId,
                error
              });
            }
          }
          try {
            await leaveDiagramSession(session.documentId, session.sessionId, session.clientId);
          } catch (error) {
            docsDebugLog("diagram session leave error", {
              documentId: session.documentId,
              sessionId: session.sessionId,
              error
            });
          }
        })();
      }
      diagramSessionRef.current = null;
      setDiagramSessionState(null);
      localProvider?.destroy();
      localWebsocketProvider?.destroy();
      localYDoc?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocument?.id,
    activeDocument?.yDocName,
    activeDocument?.type,
    buildContentFingerprint,
    createDiagramClientId,
    fetchLatestPersistedContent,
    isDiagramPayloadEffectivelyEmpty,
    joinDiagramSession,
    leaveDiagramSession,
    persistDiagramSessionSnapshot,
    resolveDocumentCollabToken
  ]);

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

  useEffect(() => {
    if (!activeDocument || activeDocument.type !== "DIAGRAMA" || !provider) {
      return;
    }

    const yDoc = yDocRef.current;
    if (!yDoc) {
      return;
    }
    const yText = yDoc.getText(`doc:${activeDocument.id}:diagram`);
    const onTextChange = () => {
      const session = diagramSessionRef.current;
      if (!session || session.documentId !== activeDocument.id) {
        return;
      }
      const nextState: DiagramSessionClientState = {
        ...session,
        pendingChanges: true
      };
      diagramSessionRef.current = nextState;
      setDiagramSessionState(nextState);
    };

    yText.observe(onTextChange);
    return () => {
      yText.unobserve(onTextChange);
    };
  }, [activeDocument?.id, activeDocument?.type, provider]);

  useEffect(() => {
    if (
      !activeDocument ||
      activeDocument.type !== "DIAGRAMA" ||
      providerOffline ||
      connectionState !== "connected"
    ) {
      return;
    }

    const sendSessionHeartbeat = async () => {
      const session = diagramSessionRef.current;
      if (!session || session.documentId !== activeDocument.id) {
        return;
      }
      if (sessionHeartbeatInFlightRef.current) {
        return;
      }

      sessionHeartbeatInFlightRef.current = true;
      try {
        const result = await heartbeatDiagramSession(
          session.documentId,
          session.sessionId,
          session.clientId
        );
        const nextState: DiagramSessionClientState = {
          ...session,
          lastHeartbeatAt: result.lastHeartbeatAt,
          revision: result.revision,
          lastEvent: result.lastEvent
        };
        diagramSessionRef.current = nextState;
        setDiagramSessionState(nextState);
      } catch (error) {
        docsDebugLog("diagram session heartbeat error", {
          documentId: activeDocument.id,
          sessionId: diagramSessionRef.current?.sessionId,
          error
        });
      } finally {
        sessionHeartbeatInFlightRef.current = false;
      }
    };

    void sendSessionHeartbeat();

    const heartbeatMs =
      diagramSessionRef.current?.heartbeatMs ?? DEFAULT_DIAGRAM_SESSION_HEARTBEAT_MS;
    const timer = window.setInterval(() => {
      void sendSessionHeartbeat();
    }, heartbeatMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeDocument?.id,
    activeDocument?.type,
    connectionState,
    heartbeatDiagramSession,
    providerOffline
  ]);

  useEffect(() => {
    if (
      !activeDocument ||
      activeDocument.type !== "DIAGRAMA" ||
      providerOffline ||
      connectionState !== "connected"
    ) {
      return;
    }

    const runIntervalSnapshot = () => {
      void flushDiagramSessionSnapshot({
        documentId: activeDocument.id,
        reason: "interval"
      });
    };

    runIntervalSnapshot();

    const snapshotIntervalMs =
      diagramSessionRef.current?.snapshotIntervalMs ?? DEFAULT_DIAGRAM_SESSION_SNAPSHOT_MS;
    const timer = window.setInterval(runIntervalSnapshot, snapshotIntervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushDiagramSessionSnapshot({
          documentId: activeDocument.id,
          reason: "before_unload"
        });
      }
    };

    const onBeforeUnload = () => {
      void flushDiagramSessionSnapshot({
        documentId: activeDocument.id,
        reason: "before_unload"
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [
    activeDocument?.id,
    activeDocument?.type,
    connectionState,
    flushDiagramSessionSnapshot,
    providerOffline
  ]);

  useEffect(() => {
    if (!docsDebugEnabled || !diagramSessionState) {
      return;
    }

    docsDebugLog("diagram session state", {
      documentId: diagramSessionState.documentId,
      sessionId: diagramSessionState.sessionId,
      revision: diagramSessionState.revision,
      lastEvent: diagramSessionState.lastEvent,
      lastHeartbeatAt: diagramSessionState.lastHeartbeatAt,
      lastSnapshotAt: diagramSessionState.lastSnapshotAt,
      pendingChanges: diagramSessionState.pendingChanges,
      snapshotHash: diagramSessionState.lastSnapshotHash
    });
  }, [diagramSessionState]);

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
    return fetchVersionContentById(document.id, version.id);
  };

  const combinedError =
    createDocumentMutation.error?.message ??
    renameDocumentMutation.error?.message ??
    deleteDocumentMutation.error?.message ??
    saveVersionMutation.error?.message ??
    uploadAssetMutation.error?.message ??
    restoreVersionMutation.error?.message ??
    duplicateDocumentMutation.error?.message ??
    toggleFavoriteMutation.error?.message ??
    restoreDocumentMutation.error?.message ??
    batchDeleteMutation.error?.message ??
    batchRestoreMutation.error?.message ??
    createTemplateMutation.error?.message ??
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
      onSaveVersion={handleSaveVersion}
      onDiagramLegacyMigration={handleDiagramLegacyMigration}
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
      onDuplicateDocument={async (document) => {
        await duplicateDocumentMutation.mutateAsync(document.id);
      }}
      onToggleFavorite={async (document) => {
        await toggleFavoriteMutation.mutateAsync(document.id);
      }}
      onRestoreFromTrash={async (documentId) => {
        await restoreDocumentMutation.mutateAsync(documentId);
      }}
      onFetchTrash={() => {
        void trashQuery.refetch();
      }}
      trashItems={trashQuery.data?.items ?? []}
      trashLoading={trashQuery.isLoading || trashQuery.isFetching}
      onBatchDelete={async (documentIds) => {
        await batchDeleteMutation.mutateAsync(documentIds);
      }}
      onBatchRestore={async (documentIds) => {
        await batchRestoreMutation.mutateAsync(documentIds);
      }}
      onCreateTemplate={async (input) => {
        await createTemplateMutation.mutateAsync(input);
      }}
      onFetchTemplates={() => {
        void templatesQuery.refetch();
      }}
      templates={templatesQuery.data?.items ?? []}
    />
  );
};
