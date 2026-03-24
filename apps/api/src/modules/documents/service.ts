import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DiagramKind,
  DocumentTemplate,
  DocumentType,
  DocumentVersionKind,
  DocumentsExplorerResponse
} from "@corelia/types";
import type { Prisma } from "@prisma/client";
import {
  buildOnlyOfficeDocumentKey,
  createBlankOnlyOfficeFile,
  getOnlyOfficeFileInfo,
  getOnlyOfficeFileName,
  inferOnlyOfficeFileNameFromPath,
  inferOnlyOfficeMimeType,
  isOnlyOfficeDocumentType
} from "./onlyoffice.js";
import { sanitizeFileName, stripControlChars } from "../../lib/sanitize.js";

const DOCUMENTS_ROOT_FOLDER = "documentos";

const DOCUMENT_TYPE_CONFIG: Record<
  DocumentType,
  { folderName: string; key: DocumentType }
> = {
  TEXTO: { folderName: "texto", key: "TEXTO" },
  DIAGRAMA: { folderName: "diagramas", key: "DIAGRAMA" },
  TABLA: { folderName: "tablas", key: "TABLA" },
  WHITEBOARD: { folderName: "whiteboard", key: "WHITEBOARD" },
  PRESENTACION: { folderName: "presentaciones", key: "PRESENTACION" }
};

const DOCUMENT_DELETE_RETENTION_DAYS = 7;
const DOCUMENT_VERSION_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_VERSION_MIME = "application/json";
const DEFAULT_ASSET_MIME = "application/octet-stream";
const DOCUMENT_ASSET_TOKEN_TYPE = "document_asset";
const DOCUMENT_COLLAB_TOKEN_SCOPE = "collab:document";
const DOCUMENT_COLLAB_TOKEN_TTL_SECONDS = 5 * 60;
const ONLYOFFICE_FILE_TOKEN_TYPE = "onlyoffice_file";
const ONLYOFFICE_CALLBACK_TOKEN_TYPE = "onlyoffice_callback";
const ONLYOFFICE_LINK_TOKEN_TTL = "7d";
const DOCUMENT_DIAGRAM_SESSION_SNAPSHOT_MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_DIAGRAM_SNAPSHOT_MIME = "application/xml";
const DOCUMENT_DIAGRAM_SESSION_STALE_MS = 70_000;

const PRESENCE_SET_KEY_PREFIX = "presence:documents:set:";
const PRESENCE_VALUE_KEY_PREFIX = "presence:documents:user:";
const DEFAULT_PRESENCE_TTL_SECONDS = 70;

type SpaceFolders = {
  projectId: string;
  rootFolderId: string;
  textoFolderId: string;
  diagramasFolderId: string;
  tablasFolderId: string;
  whiteboardFolderId: string;
  presentacionesFolderId: string;
};

type PresencePayload = {
  userId: string;
  color: string;
  cursorLabel: string | null;
  lastSeenAt: string;
};

type PresenceCollaborator = PresencePayload & {
  name: string;
};

type SessionEventType =
  | "JOIN"
  | "LEAVE"
  | "DISCONNECT"
  | "RECONNECT"
  | "SNAPSHOT_SAVED"
  | "SAVE_VERSION"
  | "ERROR"
  | "MIGRATION";


const streamToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export class DocumentsService {
  constructor(private readonly app: FastifyInstance) {}

  private getPresenceTtlSeconds() {
    return env.DOCUMENTS_PRESENCE_TTL_SECONDS || DEFAULT_PRESENCE_TTL_SECONDS;
  }

  private presenceSetKey(documentId: string) {
    return `${PRESENCE_SET_KEY_PREFIX}${documentId}`;
  }

  private presenceValueKey(documentId: string, userId: string) {
    return `${PRESENCE_VALUE_KEY_PREFIX}${documentId}:${userId}`;
  }

  private async assertProjectAccess(projectId: string, userId: string) {
    const [project, admin] = await Promise.all([
      this.app.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          ownerId: true,
          members: {
            where: { userId },
            select: { id: true }
          }
        }
      }),
      this.app.prisma.user.findFirst({
        where: {
          id: userId,
          baseRole: {
            is: {
              key: "ADMINISTRADOR"
            }
          }
        },
        select: { id: true }
      })
    ]);

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    const hasAccess = Boolean(admin) || project.ownerId === userId || project.members.length > 0;
    if (!hasAccess) {
      const error = new Error("No tienes acceso a los documentos de este proyecto");
      error.name = "Forbidden";
      throw error;
    }

    return project;
  }

  private async ensureFolder(
    tx: Prisma.TransactionClient,
    input: {
      projectId: string;
      name: string;
      parentId: string | null;
      createdById: string;
    }
  ) {
    const existing = await tx.folder.findFirst({
      where: {
        scope: "PROYECTO",
        projectId: input.projectId,
        parentId: input.parentId,
        name: input.name
      },
      select: {
        id: true
      }
    });

    if (existing) {
      return existing.id;
    }

    const created = await tx.folder.create({
      data: {
        name: input.name,
        scope: "PROYECTO",
        projectId: input.projectId,
        parentId: input.parentId,
        createdById: input.createdById
      },
      select: {
        id: true
      }
    });

    return created.id;
  }

  private async ensureDocumentSpace(projectId: string, createdById: string): Promise<SpaceFolders> {
    const existing = await this.app.prisma.projectDocumentSpace.findUnique({
      where: {
        projectId
      }
    });

    if (existing) {
      const folderIds = [
        existing.rootFolderId,
        existing.textoFolderId,
        existing.diagramasFolderId,
        existing.tablasFolderId,
        existing.whiteboardFolderId,
        existing.presentacionesFolderId
      ];

      const folderCount = await this.app.prisma.folder.count({
        where: {
          id: { in: folderIds },
          projectId,
          scope: "PROYECTO"
        }
      });

      if (folderCount === folderIds.length) {
        return {
          projectId: existing.projectId,
          rootFolderId: existing.rootFolderId,
          textoFolderId: existing.textoFolderId,
          diagramasFolderId: existing.diagramasFolderId,
          tablasFolderId: existing.tablasFolderId,
          whiteboardFolderId: existing.whiteboardFolderId,
          presentacionesFolderId: existing.presentacionesFolderId
        };
      }
    }

    return this.app.prisma.$transaction(async (tx) => {
      const rootFolderId = await this.ensureFolder(tx, {
        projectId,
        name: DOCUMENTS_ROOT_FOLDER,
        parentId: null,
        createdById
      });

      const textoFolderId = await this.ensureFolder(tx, {
        projectId,
        name: DOCUMENT_TYPE_CONFIG.TEXTO.folderName,
        parentId: rootFolderId,
        createdById
      });
      const diagramasFolderId = await this.ensureFolder(tx, {
        projectId,
        name: DOCUMENT_TYPE_CONFIG.DIAGRAMA.folderName,
        parentId: rootFolderId,
        createdById
      });
      const tablasFolderId = await this.ensureFolder(tx, {
        projectId,
        name: DOCUMENT_TYPE_CONFIG.TABLA.folderName,
        parentId: rootFolderId,
        createdById
      });
      const whiteboardFolderId = await this.ensureFolder(tx, {
        projectId,
        name: DOCUMENT_TYPE_CONFIG.WHITEBOARD.folderName,
        parentId: rootFolderId,
        createdById
      });
      const presentacionesFolderId = await this.ensureFolder(tx, {
        projectId,
        name: DOCUMENT_TYPE_CONFIG.PRESENTACION.folderName,
        parentId: rootFolderId,
        createdById
      });

      const upserted = await tx.projectDocumentSpace.upsert({
        where: {
          projectId
        },
        update: {
          rootFolderId,
          textoFolderId,
          diagramasFolderId,
          tablasFolderId,
          whiteboardFolderId,
          presentacionesFolderId
        },
        create: {
          projectId,
          rootFolderId,
          textoFolderId,
          diagramasFolderId,
          tablasFolderId,
          whiteboardFolderId,
          presentacionesFolderId
        }
      });

      return {
        projectId: upserted.projectId,
        rootFolderId: upserted.rootFolderId,
        textoFolderId: upserted.textoFolderId,
        diagramasFolderId: upserted.diagramasFolderId,
        tablasFolderId: upserted.tablasFolderId,
        whiteboardFolderId: upserted.whiteboardFolderId,
        presentacionesFolderId: upserted.presentacionesFolderId
      };
    });
  }

  private getOnlyOfficeDocumentServerUrl() {
    const value = env.ONLYOFFICE_DOCUMENT_SERVER_URL.trim();
    if (value) {
      return value.replace(/\/+$/g, "");
    }
    return "/onlyoffice";
  }

  /** URL interna (Docker) usada para llamadas server-side a la Command API de OnlyOffice */
  private getOnlyOfficeInternalUrl() {
    const configured = env.ONLYOFFICE_INTERNAL_URL.trim();
    if (configured) {
      return configured.replace(/\/+$/g, "");
    }
    // Fallback: si hay URL pública configurada, usarla también para comandos internos
    const pub = env.ONLYOFFICE_DOCUMENT_SERVER_URL.trim();
    if (pub) {
      return pub.replace(/\/+$/g, "");
    }
    return "http://onlyoffice";
  }

  private getOnlyOfficeApiBaseUrl() {
    const configured = env.ONLYOFFICE_CALLBACK_BASE_URL.trim();
    const base = (configured || env.CORELIA_APP_URL).replace(/\/+$/g, "");
    return `${base}/api/v1`;
  }

  private async signOnlyOfficeFileToken(input: {
    documentId: string;
    userId: string;
    fileName: string;
    mimeType: string;
    snapshotPath: string;
  }) {
    return this.app.jwt.sign(
      {
        typ: ONLYOFFICE_FILE_TOKEN_TYPE,
        documentId: input.documentId,
        userId: input.userId,
        snapshotPath: input.snapshotPath,
        fileName: input.fileName,
        mimeType: input.mimeType
      },
      {
        expiresIn: ONLYOFFICE_LINK_TOKEN_TTL
      }
    );
  }

  private async signOnlyOfficeCallbackToken(input: {
    documentId: string;
    userId: string;
  }) {
    return this.app.jwt.sign(
      {
        typ: ONLYOFFICE_CALLBACK_TOKEN_TYPE,
        documentId: input.documentId,
        userId: input.userId
      },
      {
        expiresIn: ONLYOFFICE_LINK_TOKEN_TTL
      }
    );
  }

  private mapDocument(
    document: {
      id: string;
      projectId: string;
      folderId: string;
      type: DocumentType;
      name: string;
      yDocName: string;
      diagramEngine?: "EXCALIDRAW" | "REACT_FLOW" | null;
      diagramKind?:
        | "FLUJO"
        | "SECUENCIA"
        | "UML_CLASES"
        | "ENTIDAD_RELACION"
        | "ESTADO"
        | "ARQUITECTURA"
        | "BPMN"
        | null;
      currentVersion: number;
      createdById: string;
      deletedAt: Date | null;
      purgeAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy?: {
        firstName: string;
        lastName: string;
      };
    }
  ): CollaborativeDocument {
    return {
      id: document.id,
      projectId: document.projectId,
      folderId: document.folderId,
      type: document.type,
      name: document.name,
      yDocName: document.yDocName,
      diagramEngine: document.diagramEngine ?? null,
      diagramKind: document.diagramKind ?? null,
      currentVersion: document.currentVersion,
      createdById: document.createdById,
      ...(document.createdBy
        ? {
            createdByName: `${document.createdBy.firstName} ${document.createdBy.lastName}`.trim()
          }
        : {}),
      deletedAt: document.deletedAt ? document.deletedAt.toISOString() : null,
      purgeAt: document.purgeAt ? document.purgeAt.toISOString() : null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString()
    };
  }

  private mapVersion(
    version: {
      id: string;
      documentId: string;
      versionNumber: number;
      kind: DocumentVersionKind;
      snapshotPath: string;
      snapshotSizeBytes: number;
      createdById: string;
      createdAt: Date;
      createdBy?: {
        firstName: string;
        lastName: string;
      };
    }
  ): CollaborativeDocumentVersion {
    return {
      id: version.id,
      documentId: version.documentId,
      versionNumber: version.versionNumber,
      kind: version.kind,
      snapshotPath: version.snapshotPath,
      snapshotSizeBytes: version.snapshotSizeBytes,
      createdById: version.createdById,
      ...(version.createdBy
        ? {
            createdByName: `${version.createdBy.firstName} ${version.createdBy.lastName}`.trim()
          }
        : {}),
      createdAt: version.createdAt.toISOString()
    };
  }

  private resolveFolderIdByType(space: SpaceFolders, type: DocumentType): string {
    if (type === "TEXTO") {
      return space.textoFolderId;
    }
    if (type === "DIAGRAMA") {
      return space.diagramasFolderId;
    }
    if (type === "TABLA") {
      return space.tablasFolderId;
    }
    if (type === "WHITEBOARD") {
      return space.whiteboardFolderId;
    }
    return space.presentacionesFolderId;
  }

  private async getPresenceForDocuments(documentIds: string[]) {
    const result = new Map<string, PresenceCollaborator[]>();

    if (!this.app.redis || documentIds.length === 0) {
      return result;
    }

    const setPipeline = this.app.redis.pipeline();
    for (const documentId of documentIds) {
      setPipeline.smembers(this.presenceSetKey(documentId));
    }

    const setResults = await setPipeline.exec();
    if (!setResults) {
      return result;
    }

    const perDocumentUserIds = new Map<string, string[]>();

    for (const [index, [error, value]] of setResults.entries()) {
      if (error) {
        continue;
      }
      const documentId = documentIds[index];
      if (!documentId) {
        continue;
      }
      const userIds = Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        : [];
      perDocumentUserIds.set(documentId, userIds);
    }

    const valuePipeline = this.app.redis.pipeline();
    const lookupOrder: Array<{ documentId: string; userId: string }> = [];

    for (const [documentId, userIds] of perDocumentUserIds.entries()) {
      for (const userId of userIds) {
        lookupOrder.push({ documentId, userId });
        valuePipeline.get(this.presenceValueKey(documentId, userId));
      }
    }

    const valueResults = await valuePipeline.exec();
    if (!valueResults) {
      return result;
    }

    const validPayloads: Array<{ documentId: string; payload: PresencePayload }> = [];
    const staleEntries: Array<{ documentId: string; userId: string }> = [];

    for (const [index, [error, value]] of valueResults.entries()) {
      const lookup = lookupOrder[index];
      if (!lookup) {
        continue;
      }

      if (error || typeof value !== "string" || value.length === 0) {
        staleEntries.push(lookup);
        continue;
      }

      try {
        const parsed = JSON.parse(value) as PresencePayload;
        if (
          parsed.userId !== lookup.userId ||
          typeof parsed.color !== "string" ||
          typeof parsed.lastSeenAt !== "string"
        ) {
          staleEntries.push(lookup);
          continue;
        }

        validPayloads.push({
          documentId: lookup.documentId,
          payload: {
            userId: parsed.userId,
            color: parsed.color,
            cursorLabel: parsed.cursorLabel ?? null,
            lastSeenAt: parsed.lastSeenAt
          }
        });
      } catch {
        staleEntries.push(lookup);
      }
    }

    if (staleEntries.length > 0) {
      const cleanupPipeline = this.app.redis.pipeline();
      for (const stale of staleEntries) {
        cleanupPipeline.srem(this.presenceSetKey(stale.documentId), stale.userId);
      }
      await cleanupPipeline.exec();
    }

    const uniqueUserIds = [...new Set(validPayloads.map((entry) => entry.payload.userId))];
    const users = uniqueUserIds.length
      ? await this.app.prisma.user.findMany({
          where: {
            id: {
              in: uniqueUserIds
            }
          },
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        })
      : [];

    const userNameById = new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim() || "Usuario"])
    );

    for (const entry of validPayloads) {
      const list = result.get(entry.documentId) ?? [];
      list.push({
        ...entry.payload,
        name: userNameById.get(entry.payload.userId) ?? "Usuario"
      });
      result.set(entry.documentId, list);
    }

    return result;
  }

  async initFolders(input: { projectId: string; userId: string }) {
    await this.assertProjectAccess(input.projectId, input.userId);
    return this.ensureDocumentSpace(input.projectId, input.userId);
  }

  async listDocuments(input: {
    projectId: string;
    userId: string;
    q?: string;
    type?: DocumentType;
  }): Promise<DocumentsExplorerResponse> {
    await this.assertProjectAccess(input.projectId, input.userId);
    const space = await this.ensureDocumentSpace(input.projectId, input.userId);

    const documents = await this.app.prisma.collaborativeDocument.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        ...(input.type ? { type: input.type } : {}),
        ...(input.q
          ? {
              name: {
                contains: input.q,
                mode: "insensitive"
              }
            }
          : {})
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        favorites: {
          where: { userId: input.userId },
          select: { id: true }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    const grouped: DocumentsExplorerResponse["documentsByType"] = {
      TEXTO: [],
      DIAGRAMA: [],
      TABLA: [],
      WHITEBOARD: [],
      PRESENTACION: []
    };

    for (const document of documents) {
      const mapped = this.mapDocument(document);
      (mapped as CollaborativeDocument & { isFavorite?: boolean }).isFavorite = document.favorites.length > 0;
      grouped[document.type].push(mapped);
    }

    const presenceMap = await this.getPresenceForDocuments(documents.map((item) => item.id));
    const activeCollaborators = documents.map((document) => ({
      documentId: document.id,
      collaborators: presenceMap.get(document.id) ?? []
    }));

    return {
      projectId: input.projectId,
      space,
      documentsByType: grouped,
      activeCollaborators
    };
  }

  async createDocument(input: {
    projectId: string;
    userId: string;
    type: DocumentType;
    name: string;
    diagramKind?: DiagramKind;
  }) {
    await this.assertProjectAccess(input.projectId, input.userId);
    const space = await this.ensureDocumentSpace(input.projectId, input.userId);

    const folderId = this.resolveFolderIdByType(space, input.type);
    const now = Date.now();
    const document = await this.app.prisma.collaborativeDocument.create({
      data: {
        projectId: input.projectId,
        folderId,
        type: input.type,
        name: input.name.trim(),
        yDocName: `doc-${input.projectId}-${now}-${randomUUID()}`,
        ...(input.type === "DIAGRAMA"
          ? {
              diagramEngine: "REACT_FLOW" as const,
              diagramKind: input.diagramKind ?? "FLUJO"
            }
          : {}),
        createdById: input.userId
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (isOnlyOfficeDocumentType(document.type) && this.app.storage) {
      try {
        const fileInfo = getOnlyOfficeFileInfo(document.type);
        const initialBuffer = createBlankOnlyOfficeFile(document.type);
        const initialFileName = getOnlyOfficeFileName(document.name, document.type);
        await this.createVersionFromBuffer({
          documentId: document.id,
          userId: input.userId,
          kind: "MANUAL",
          fileName: initialFileName,
          mimeType: fileInfo.mimeType,
          data: initialBuffer
        });

        return this.getDocument({
          documentId: document.id,
          userId: input.userId
        });
      } catch {
        // If the initial office file cannot be created, the document still exists
        // and the frontend can report the integration issue.
      }
    }

    return this.mapDocument(document);
  }

  private async getDocumentForUser(input: { documentId: string; userId: string }) {
    const document = await this.app.prisma.collaborativeDocument.findUnique({
      where: {
        id: input.documentId
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!document || document.deletedAt) {
      throw new Error("Documento no encontrado");
    }

    await this.assertProjectAccess(document.projectId, input.userId);

    return document;
  }

  async getDocument(input: { documentId: string; userId: string }) {
    const document = await this.getDocumentForUser(input);
    return this.mapDocument(document);
  }

  async createCollabToken(input: { documentId: string; userId: string }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const token = await this.app.jwt.sign(
      {
        sub: input.userId,
        docId: document.id,
        yDocName: document.yDocName,
        scope: DOCUMENT_COLLAB_TOKEN_SCOPE
      },
      {
        expiresIn: `${DOCUMENT_COLLAB_TOKEN_TTL_SECONDS}s`,
        key: env.COLLAB_AUTH_SECRET
      }
    );

    return {
      token,
      expiresInSeconds: DOCUMENT_COLLAB_TOKEN_TTL_SECONDS
    };
  }

  private async resolveOnlyOfficeLatestVersion(documentId: string) {
    return this.app.prisma.collaborativeDocumentVersion.findFirst({
      where: {
        documentId
      },
      orderBy: {
        versionNumber: "desc"
      },
      select: {
        id: true,
        versionNumber: true,
        snapshotPath: true
      }
    });
  }

  async getOnlyOfficeConfig(input: {
    documentId: string;
    userId: string;
    canEdit: boolean;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!isOnlyOfficeDocumentType(document.type)) {
      throw new Error("ONLYOFFICE está disponible solo para texto, tabla y presentación");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const documentServerUrl = this.getOnlyOfficeDocumentServerUrl();
    if (!documentServerUrl) {
      throw new Error("ONLYOFFICE no está configurado");
    }

    const latestVersion = await this.resolveOnlyOfficeLatestVersion(document.id);
    if (!latestVersion) {
      throw new Error("El documento no tiene archivo base para abrir en ONLYOFFICE");
    }

    const user = await this.app.prisma.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        firstName: true,
        lastName: true,
        email: true
      }
    });

    const userName =
      user ? `${user.firstName} ${user.lastName}`.trim() || user.email : `Usuario ${input.userId}`;
    const fileInfo = getOnlyOfficeFileInfo(document.type);
    const fileName = inferOnlyOfficeFileNameFromPath(
      latestVersion.snapshotPath,
      getOnlyOfficeFileName(document.name, document.type),
      document.type
    );
    const mimeType = inferOnlyOfficeMimeType(latestVersion.snapshotPath, document.type);
    const apiBaseUrl = this.getOnlyOfficeApiBaseUrl();
    const fileToken = await this.signOnlyOfficeFileToken({
      documentId: document.id,
      userId: input.userId,
      fileName,
      mimeType,
      snapshotPath: latestVersion.snapshotPath
    });
    const callbackToken = await this.signOnlyOfficeCallbackToken({
      documentId: document.id,
      userId: input.userId
    });

    const config = {
      documentType: fileInfo.documentType,
      type: "desktop",
      document: {
        fileType: fileInfo.fileType,
        key: buildOnlyOfficeDocumentKey({
          documentId: document.id,
          currentVersion: latestVersion.versionNumber,
          updatedAt: document.updatedAt.toISOString()
        }),
        title: fileName,
        url: `${apiBaseUrl}/documents/${encodeURIComponent(document.id)}/onlyoffice/file?token=${encodeURIComponent(fileToken)}`,
        permissions: {
          edit: input.canEdit,
          download: true,
          print: true,
          copy: true,
          review: input.canEdit
        }
      },
      editorConfig: {
        mode: input.canEdit ? "edit" : "view",
        lang: "es",
        callbackUrl: `${apiBaseUrl}/documents/${encodeURIComponent(document.id)}/onlyoffice/callback?token=${encodeURIComponent(callbackToken)}`,
        user: {
          id: input.userId,
          name: userName
        },
        region: "es",
        customization: {
          autosave: true,
          forcesave: true,
          spellcheck: true,
          compactHeader: false,
          toolbarNoTabs: false
        }
      }
    } as Record<string, unknown>;

    if (env.ONLYOFFICE_JWT_SECRET) {
      return {
        documentServerUrl,
        config: {
          ...config,
          token: await this.app.jwt.sign(config, {
            key: env.ONLYOFFICE_JWT_SECRET
          })
        }
      };
    }

    return {
      documentServerUrl,
      config
    };
  }

  async getOnlyOfficeFileContent(input: { documentId: string; token: string }) {
    const payload = (await this.app.jwt.verify(input.token)) as Partial<{
      typ: string;
      documentId: string;
      snapshotPath: string;
      fileName: string;
      mimeType: string;
    }>;

    if (
      payload.typ !== ONLYOFFICE_FILE_TOKEN_TYPE ||
      payload.documentId !== input.documentId ||
      !payload.documentId ||
      !payload.snapshotPath ||
      !payload.fileName ||
      !payload.mimeType
    ) {
      throw new Error("Token de ONLYOFFICE inválido");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const stream = await this.app.storage.getObjectStream(payload.snapshotPath);
    return {
      stream,
      fileName: payload.fileName,
      mimeType: payload.mimeType
    };
  }

  async handleOnlyOfficeCallback(input: {
    documentId: string;
    token: string;
    body: {
      status: number;
      url?: string;
    };
  }) {
    const tokenPayload = (await this.app.jwt.verify(input.token)) as Partial<{
      typ: string;
      documentId: string;
      userId: string;
    }>;

    if (
      tokenPayload.typ !== ONLYOFFICE_CALLBACK_TOKEN_TYPE ||
      tokenPayload.documentId !== input.documentId ||
      !tokenPayload.userId
    ) {
      throw new Error("Callback de ONLYOFFICE inválido");
    }

    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: tokenPayload.userId
    });

    if (!isOnlyOfficeDocumentType(document.type)) {
      throw new Error("Tipo de documento no soportado por ONLYOFFICE");
    }

    const status = Number(input.body.status);
    if (![2, 3, 6, 7].includes(status)) {
      return { error: 0 as const };
    }

    if (status === 3 || status === 7) {
      return { error: 0 as const };
    }

    if (!input.body.url) {
      throw new Error("ONLYOFFICE no envió la URL del archivo");
    }

    const response = await fetch(input.body.url);
    if (!response.ok) {
      throw new Error("No se pudo descargar el archivo guardado por ONLYOFFICE");
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileInfo = getOnlyOfficeFileInfo(document.type);
    await this.saveVersion({
      documentId: document.id,
      userId: tokenPayload.userId,
      kind: status === 6 ? "AUTO" : "MANUAL",
      fileName: getOnlyOfficeFileName(document.name, document.type),
      mimeType: fileInfo.mimeType,
      data: Buffer.from(arrayBuffer)
    });

    return { error: 0 as const };
  }

  async forceSaveOnlyOffice(input: {
    documentId: string;
    userId: string;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!isOnlyOfficeDocumentType(document.type)) {
      throw new Error("Forcesave solo está disponible para documentos de ONLYOFFICE");
    }

    const internalUrl = this.getOnlyOfficeInternalUrl();

    const latestVersion = await this.resolveOnlyOfficeLatestVersion(document.id);
    if (!latestVersion) {
      throw new Error("El documento no tiene archivo base");
    }

    const documentKey = buildOnlyOfficeDocumentKey({
      documentId: document.id,
      currentVersion: latestVersion.versionNumber,
      updatedAt: document.updatedAt.toISOString()
    });

    const commandPayload: Record<string, unknown> = {
      c: "forcesave",
      key: documentKey
    };

    if (env.ONLYOFFICE_JWT_SECRET) {
      commandPayload.token = await this.app.jwt.sign(commandPayload, {
        key: env.ONLYOFFICE_JWT_SECRET
      });
    }

    const commandUrls = [
      `${internalUrl}/command`,
      `${internalUrl}/coauthoring/CommandService.ashx`
    ];
    let response: Response | null = null;

    for (const commandUrl of commandUrls) {
      const currentResponse = await fetch(commandUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandPayload)
      });

      if (currentResponse.ok) {
        response = currentResponse;
        break;
      }

      if (currentResponse.status !== 404 && currentResponse.status !== 405) {
        throw new Error(`ONLYOFFICE Command Service respondió con ${currentResponse.status}`);
      }
    }

    if (!response) {
      throw new Error("ONLYOFFICE Command Service no está disponible en /command ni en /coauthoring/CommandService.ashx");
    }

    const result = (await response.json()) as { error?: number };

    // error 0 = OK, error 4 = no changes (documento sin modificar)
    if (result.error !== 0 && result.error !== 4) {
      throw new Error(`ONLYOFFICE forcesave falló con código ${result.error}`);
    }

    return {
      saved: result.error === 0,
      noChanges: result.error === 4
    };
  }

  private getDiagramSessionHeartbeatMs() {
    return env.DOCUMENTS_DIAGRAM_SESSION_HEARTBEAT_MS;
  }

  private getCollabPrisma() {
    return this.app.prisma;
  }

  private getDiagramSessionSnapshotIntervalMs() {
    return env.DOCUMENTS_DIAGRAM_SESSION_SNAPSHOT_MS;
  }

  private getDiagramSessionIdleMs() {
    return env.DOCUMENTS_DIAGRAM_SESSION_IDLE_SECONDS * 1000;
  }

  private normalizeClientId(input?: string) {
    const candidate = stripControlChars((input ?? "").trim())
      .replace(/\s+/g, "-")
      .slice(0, 120);

    return candidate.length > 0 ? candidate : randomUUID();
  }

  private participantDisplayName(input: { firstName: string; lastName: string }) {
    return `${input.firstName} ${input.lastName}`.trim() || "Usuario";
  }

  private mapDiagramSessionParticipant(row: {
    userId: string;
    clientId: string;
    status: "ONLINE" | "OFFLINE";
    joinedAt: Date;
    leftAt: Date | null;
    lastHeartbeatAt: Date | null;
    user: {
      firstName: string;
      lastName: string;
    };
  }) {
    return {
      userId: row.userId,
      clientId: row.clientId,
      name: this.participantDisplayName(row.user),
      status: row.status,
      joinedAt: row.joinedAt.toISOString(),
      leftAt: row.leftAt ? row.leftAt.toISOString() : null,
      lastHeartbeatAt: row.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null
    };
  }

  private async getDiagramDocumentForUser(input: { documentId: string; userId: string }) {
    const document = await this.getDocumentForUser(input);
    if (document.type !== "DIAGRAMA") {
      throw new Error("La sesión colaborativa avanzada está disponible solo para diagramas");
    }
    return document;
  }

  private async closeIdleDiagramSessionIfNeeded(documentId: string, now: Date) {
    const activeSession = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        documentId,
        status: "ACTIVE"
      },
      orderBy: [{ startedAt: "desc" }]
    });

    if (!activeSession) {
      return null;
    }

    const idleCutoff = new Date(now.getTime() - this.getDiagramSessionIdleMs());
    if (activeSession.lastActivityAt >= idleCutoff) {
      return activeSession;
    }

    const staleCutoff = new Date(now.getTime() - DOCUMENT_DIAGRAM_SESSION_STALE_MS);
    const onlineCount = await this.getCollabPrisma().documentCollabParticipant.count({
      where: {
        sessionId: activeSession.id,
        status: "ONLINE",
        OR: [
          {
            lastHeartbeatAt: {
              gte: staleCutoff
            }
          },
          {
            lastHeartbeatAt: null,
            joinedAt: {
              gte: staleCutoff
            }
          }
        ]
      }
    });

    if (onlineCount > 0) {
      return activeSession;
    }

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabSession.update({
        where: {
          id: activeSession.id
        },
        data: {
          status: "CLOSED",
          endedAt: now,
          lastActivityAt: now
        }
      });

      await tx.documentCollabParticipant.updateMany({
        where: {
          sessionId: activeSession.id,
          status: "ONLINE"
        },
        data: {
          status: "OFFLINE",
          leftAt: now
        }
      });

      await tx.documentCollabEvent.create({
        data: {
          sessionId: activeSession.id,
          type: "DISCONNECT",
          payload: {
            reason: "idle_timeout"
          }
        }
      });
    });

    return null;
  }

  private async expireStaleDiagramParticipants(sessionId: string, now: Date) {
    const staleCutoff = new Date(now.getTime() - DOCUMENT_DIAGRAM_SESSION_STALE_MS);
    const staleParticipants = await this.getCollabPrisma().documentCollabParticipant.findMany({
      where: {
        sessionId,
        status: "ONLINE",
        OR: [
          {
            lastHeartbeatAt: {
              lt: staleCutoff
            }
          },
          {
            lastHeartbeatAt: null,
            joinedAt: {
              lt: staleCutoff
            }
          }
        ]
      },
      select: {
        id: true,
        userId: true,
        clientId: true
      }
    });

    if (staleParticipants.length === 0) {
      return;
    }

    const staleIds = staleParticipants.map((row: { id: string }) => row.id);

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.updateMany({
        where: {
          id: {
            in: staleIds
          }
        },
        data: {
          status: "OFFLINE",
          leftAt: now
        }
      });

      await tx.documentCollabEvent.createMany({
        data: staleParticipants.map((row: { userId: string; clientId: string }) => ({
          sessionId,
          userId: row.userId,
          clientId: row.clientId,
          type: "DISCONNECT",
          payload: {
            reason: "heartbeat_timeout"
          }
        }))
      });
    });
  }

  private async getSessionParticipants(sessionId: string) {
    const rows = await this.getCollabPrisma().documentCollabParticipant.findMany({
      where: {
        sessionId
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [{ joinedAt: "asc" }]
    });

    return rows.map((row: {
      userId: string;
      clientId: string;
      status: "ONLINE" | "OFFLINE";
      joinedAt: Date;
      leftAt: Date | null;
      lastHeartbeatAt: Date | null;
      user: {
        firstName: string;
        lastName: string;
      };
    }) => this.mapDiagramSessionParticipant(row));
  }

  private async getSessionLastEvent(sessionId: string): Promise<SessionEventType | null> {
    const event = await this.getCollabPrisma().documentCollabEvent.findFirst({
      where: {
        sessionId
      },
      select: {
        type: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return (event?.type as SessionEventType | undefined) ?? null;
  }

  async joinDiagramSession(input: {
    documentId: string;
    userId: string;
    clientId?: string;
  }) {
    const document = await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });
    const now = new Date();
    const clientId = this.normalizeClientId(input.clientId);

    let activeSession = await this.closeIdleDiagramSessionIfNeeded(document.id, now);
    if (!activeSession) {
      activeSession = await this.getCollabPrisma().documentCollabSession.create({
        data: {
          documentId: document.id,
          roomName: document.yDocName,
          status: "ACTIVE",
          lastActivityAt: now
        }
      });
    }

    const participantKey = {
      sessionId: activeSession.id,
      userId: input.userId,
      clientId
    };

    const previousParticipant = await this.getCollabPrisma().documentCollabParticipant.findUnique({
      where: {
        sessionId_userId_clientId: participantKey
      },
      select: {
        status: true
      }
    });

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.upsert({
        where: {
          sessionId_userId_clientId: participantKey
        },
        update: {
          status: "ONLINE",
          leftAt: null,
          lastHeartbeatAt: now
        },
        create: {
          sessionId: activeSession!.id,
          userId: input.userId,
          clientId,
          status: "ONLINE",
          joinedAt: now,
          lastHeartbeatAt: now
        }
      });

      await tx.documentCollabSession.update({
        where: {
          id: activeSession!.id
        },
        data: {
          lastActivityAt: now
        }
      });

      if (!previousParticipant) {
        await tx.documentCollabEvent.create({
          data: {
            sessionId: activeSession!.id,
            userId: input.userId,
            clientId,
            type: "JOIN"
          }
        });
      } else if (previousParticipant.status === "OFFLINE") {
        await tx.documentCollabEvent.create({
          data: {
            sessionId: activeSession!.id,
            userId: input.userId,
            clientId,
            type: "RECONNECT"
          }
        });
      }
    });

    await this.expireStaleDiagramParticipants(activeSession.id, now);

    const [session, participants] = await Promise.all([
      this.getCollabPrisma().documentCollabSession.findUniqueOrThrow({
        where: {
          id: activeSession.id
        }
      }),
      this.getSessionParticipants(activeSession.id)
    ]);

    return {
      sessionId: session.id,
      roomName: session.roomName,
      status: session.status,
      heartbeatMs: this.getDiagramSessionHeartbeatMs(),
      snapshotIntervalMs: this.getDiagramSessionSnapshotIntervalMs(),
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      revision: session.revision,
      lastSnapshotAt: session.latestSnapshotAt ? session.latestSnapshotAt.toISOString() : null,
      lastSnapshotHash: session.latestSnapshotHash ?? null,
      participants
    };
  }

  async heartbeatDiagramSession(input: {
    documentId: string;
    userId: string;
    sessionId: string;
    clientId: string;
  }) {
    await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const session = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        id: input.sessionId,
        documentId: input.documentId,
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    });

    if (!session) {
      throw new Error("La sesión colaborativa no está activa");
    }

    const now = new Date();
    const clientId = this.normalizeClientId(input.clientId);
    const participantKey = {
      sessionId: session.id,
      userId: input.userId,
      clientId
    };

    const previousParticipant = await this.getCollabPrisma().documentCollabParticipant.findUnique({
      where: {
        sessionId_userId_clientId: participantKey
      },
      select: {
        status: true
      }
    });

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.upsert({
        where: {
          sessionId_userId_clientId: participantKey
        },
        update: {
          status: "ONLINE",
          leftAt: null,
          lastHeartbeatAt: now
        },
        create: {
          sessionId: session.id,
          userId: input.userId,
          clientId,
          status: "ONLINE",
          joinedAt: now,
          lastHeartbeatAt: now
        }
      });

      await tx.documentCollabSession.update({
        where: {
          id: session.id
        },
        data: {
          lastActivityAt: now
        }
      });

      if (previousParticipant?.status === "OFFLINE") {
        await tx.documentCollabEvent.create({
          data: {
            sessionId: session.id,
            userId: input.userId,
            clientId,
            type: "RECONNECT"
          }
        });
      }
    });

    await this.expireStaleDiagramParticipants(session.id, now);

    const [participantsOnline, latestSession, lastEvent] = await Promise.all([
      this.getCollabPrisma().documentCollabParticipant.count({
        where: {
          sessionId: session.id,
          status: "ONLINE"
        }
      }),
      this.getCollabPrisma().documentCollabSession.findUniqueOrThrow({
        where: {
          id: session.id
        },
        select: {
          revision: true
        }
      }),
      this.getSessionLastEvent(session.id)
    ]);

    return {
      ok: true as const,
      sessionId: session.id,
      lastHeartbeatAt: now.toISOString(),
      participantsOnline,
      revision: latestSession.revision,
      lastEvent
    };
  }

  async saveDiagramSessionSnapshot(input: {
    documentId: string;
    userId: string;
    sessionId: string;
    clientId: string;
    content: string;
    reason: "interval" | "leave" | "before_unload" | "manual_save" | "migration";
    metadata?: Record<string, unknown>;
  }) {
    const document = await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const session = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        id: input.sessionId,
        documentId: input.documentId,
        status: "ACTIVE"
      }
    });

    if (!session) {
      throw new Error("La sesión colaborativa no está activa");
    }

    const now = new Date();
    const clientId = this.normalizeClientId(input.clientId);
    const contentBuffer = Buffer.from(input.content, "utf8");
    if (contentBuffer.byteLength <= 0) {
      throw new Error("El snapshot está vacío");
    }
    if (contentBuffer.byteLength > DOCUMENT_DIAGRAM_SESSION_SNAPSHOT_MAX_BYTES) {
      throw new Error("El snapshot excede el límite de 10MB");
    }

    const snapshotHash = createHash("sha256").update(contentBuffer).digest("hex");
    const deduped = session.latestSnapshotHash === snapshotHash;
    let nextRevision = session.revision;
    const eventType: SessionEventType =
      input.reason === "migration" ? "MIGRATION" : "SNAPSHOT_SAVED";
    const metadata =
      input.metadata === undefined
        ? null
        : (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue);

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.upsert({
        where: {
          sessionId_userId_clientId: {
            sessionId: session.id,
            userId: input.userId,
            clientId
          }
        },
        update: {
          status: "ONLINE",
          leftAt: null,
          lastHeartbeatAt: now
        },
        create: {
          sessionId: session.id,
          userId: input.userId,
          clientId,
          status: "ONLINE",
          joinedAt: now,
          lastHeartbeatAt: now
        }
      });

      if (!deduped) {
        if (!this.app.storage) {
          throw new Error("Servicio de almacenamiento no disponible");
        }
        nextRevision = session.revision + 1;
        const snapshotPath =
          `documents/${document.projectId}/documentos/diagrama/${document.id}/sessions/${session.id}` +
          `/r${nextRevision}-${Date.now()}-${randomUUID()}.drawio`;
        await this.app.storage.putObject(snapshotPath, contentBuffer, DOCUMENT_DIAGRAM_SNAPSHOT_MIME);

        await tx.documentCollabSession.update({
          where: {
            id: session.id
          },
          data: {
            revision: nextRevision,
            latestSnapshotPath: snapshotPath,
            latestSnapshotHash: snapshotHash,
            latestSnapshotSizeBytes: contentBuffer.byteLength,
            latestSnapshotAt: now,
            lastActivityAt: now
          }
        });

        await tx.documentCollabEvent.create({
          data: {
            sessionId: session.id,
            userId: input.userId,
            clientId,
            type: eventType,
            payload: {
              reason: input.reason,
              snapshotHash,
              snapshotPath,
              snapshotSizeBytes: contentBuffer.byteLength,
              revision: nextRevision,
              deduped: false,
              metadata
            }
          }
        });
      } else {
        await tx.documentCollabSession.update({
          where: {
            id: session.id
          },
          data: {
            lastActivityAt: now
          }
        });

        if (input.reason === "migration") {
          await tx.documentCollabEvent.create({
            data: {
              sessionId: session.id,
              userId: input.userId,
              clientId,
              type: "MIGRATION",
              payload: {
                reason: input.reason,
                snapshotHash,
                revision: nextRevision,
                deduped: true,
                metadata
              }
            }
          });
        }
      }
    });

    await this.expireStaleDiagramParticipants(session.id, now);

    return {
      ok: true as const,
      sessionId: session.id,
      deduped,
      revision: nextRevision,
      snapshotHash,
      snapshotAt: now.toISOString(),
      eventType
    };
  }

  async leaveDiagramSession(input: {
    documentId: string;
    userId: string;
    sessionId: string;
    clientId: string;
  }) {
    await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const session = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        id: input.sessionId,
        documentId: input.documentId,
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    });
    if (!session) {
      throw new Error("La sesión colaborativa no está activa");
    }

    const now = new Date();
    const clientId = this.normalizeClientId(input.clientId);

    const updated = await this.getCollabPrisma().documentCollabParticipant.updateMany({
      where: {
        sessionId: session.id,
        userId: input.userId,
        clientId,
        status: "ONLINE"
      },
      data: {
        status: "OFFLINE",
        leftAt: now,
        lastHeartbeatAt: now
      }
    });

    await this.getCollabPrisma().documentCollabSession.update({
      where: {
        id: session.id
      },
      data: {
        lastActivityAt: now
      }
    });

    if (updated.count > 0) {
      await this.getCollabPrisma().documentCollabEvent.create({
        data: {
          sessionId: session.id,
          userId: input.userId,
          clientId,
          type: "LEAVE"
        }
      });
    }

    return {
      ok: true as const,
      sessionId: session.id,
      leftAt: now.toISOString()
    };
  }

  async getDiagramSessionState(input: {
    documentId: string;
    userId: string;
  }) {
    const document = await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const now = new Date();
    const active = await this.closeIdleDiagramSessionIfNeeded(document.id, now);
    if (!active) {
      return {
        sessionId: null,
        roomName: null,
        status: null,
        heartbeatMs: this.getDiagramSessionHeartbeatMs(),
        snapshotIntervalMs: this.getDiagramSessionSnapshotIntervalMs(),
        startedAt: null,
        lastActivityAt: null,
        revision: 0,
        lastSnapshotAt: null,
        lastSnapshotHash: null,
        lastEvent: null,
        participants: [],
        participantsOnline: 0
      };
    }

    await this.expireStaleDiagramParticipants(active.id, now);

    const [session, participants, participantsOnline, lastEvent] = await Promise.all([
      this.getCollabPrisma().documentCollabSession.findUniqueOrThrow({
        where: {
          id: active.id
        }
      }),
      this.getSessionParticipants(active.id),
      this.getCollabPrisma().documentCollabParticipant.count({
        where: {
          sessionId: active.id,
          status: "ONLINE"
        }
      }),
      this.getSessionLastEvent(active.id)
    ]);

    return {
      sessionId: session.id,
      roomName: session.roomName,
      status: session.status,
      heartbeatMs: this.getDiagramSessionHeartbeatMs(),
      snapshotIntervalMs: this.getDiagramSessionSnapshotIntervalMs(),
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      revision: session.revision,
      lastSnapshotAt: session.latestSnapshotAt ? session.latestSnapshotAt.toISOString() : null,
      lastSnapshotHash: session.latestSnapshotHash ?? null,
      lastEvent,
      participants,
      participantsOnline
    };
  }

  async renameDocument(input: { documentId: string; userId: string; name: string }) {
    await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const updated = await this.app.prisma.collaborativeDocument.update({
      where: {
        id: input.documentId
      },
      data: {
        name: input.name.trim()
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return this.mapDocument(updated);
  }

  async deleteDocument(input: { documentId: string; userId: string }) {
    await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const now = new Date();
    const purgeAt = new Date(now.getTime() + DOCUMENT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const deleted = await this.app.prisma.collaborativeDocument.update({
      where: {
        id: input.documentId
      },
      data: {
        deletedAt: now,
        purgeAt
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return this.mapDocument(deleted);
  }

  async listVersions(input: {
    documentId: string;
    userId: string;
    page: number;
    pageSize: number;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const skip = (input.page - 1) * input.pageSize;

    const [total, rows] = await Promise.all([
      this.app.prisma.collaborativeDocumentVersion.count({
        where: {
          documentId: document.id
        }
      }),
      this.app.prisma.collaborativeDocumentVersion.findMany({
        where: {
          documentId: document.id
        },
        include: {
          createdBy: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: [{ versionNumber: "desc" }],
        skip,
        take: input.pageSize
      })
    ]);

    return {
      items: rows.map((row) => this.mapVersion(row)),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize))
    };
  }

  private async createVersionFromBuffer(input: {
    documentId: string;
    userId: string;
    kind: DocumentVersionKind;
    fileName: string;
    mimeType: string;
    data: Buffer;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    if (input.data.length <= 0) {
      throw new Error("Snapshot vacío");
    }

    if (input.data.length > DOCUMENT_VERSION_MAX_BYTES) {
      throw new Error("El snapshot excede el límite de 50MB");
    }

    const latest = await this.app.prisma.collaborativeDocumentVersion.findFirst({
      where: {
        documentId: document.id
      },
      orderBy: {
        versionNumber: "desc"
      },
      select: {
        versionNumber: true
      }
    });

    const nextVersion = (latest?.versionNumber ?? 0) + 1;
    const safeName = sanitizeFileName(input.fileName || "snapshot.json");
    const safeMime = input.mimeType.trim() || DEFAULT_VERSION_MIME;
    const snapshotPath = `documents/${document.projectId}/documentos/${document.type.toLowerCase()}/${document.id}/v${nextVersion}-${input.kind.toLowerCase()}-${Date.now()}-${safeName}`;

    await this.app.storage.putObject(snapshotPath, input.data, safeMime);

    const created = await this.app.prisma.$transaction(async (tx) => {
      const version = await tx.collaborativeDocumentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: nextVersion,
          kind: input.kind,
          snapshotPath,
          snapshotSizeBytes: input.data.length,
          createdById: input.userId
        },
        include: {
          createdBy: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      await tx.collaborativeDocument.update({
        where: {
          id: document.id
        },
        data: {
          currentVersion: nextVersion
        }
      });

      return version;
    });

    if (document.type === "DIAGRAMA") {
      const activeSession = await this.getCollabPrisma().documentCollabSession.findFirst({
        where: {
          documentId: document.id,
          status: "ACTIVE"
        },
        select: {
          id: true
        }
      });

      if (activeSession) {
        await this.getCollabPrisma().documentCollabEvent.create({
          data: {
            sessionId: activeSession.id,
            userId: input.userId,
            type: "SAVE_VERSION",
            payload: {
              kind: input.kind,
              versionNumber: created.versionNumber
            }
          }
        });
      }
    }

    return {
      document: this.mapDocument(document),
      version: this.mapVersion(created)
    };
  }

  async saveVersion(input: {
    documentId: string;
    userId: string;
    kind: DocumentVersionKind;
    fileName: string;
    mimeType: string;
    data: Buffer;
  }) {
    return this.createVersionFromBuffer(input);
  }

  async getVersionContent(input: {
    documentId: string;
    versionId: string;
    userId: string;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const version = await this.app.prisma.collaborativeDocumentVersion.findFirst({
      where: {
        id: input.versionId,
        documentId: input.documentId
      },
      select: {
        id: true,
        kind: true,
        versionNumber: true,
        snapshotPath: true
      }
    });

    if (!version) {
      throw new Error("Versión no encontrada");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const stream = await this.app.storage.getObjectStream(version.snapshotPath);

    return {
      stream,
      version,
      fileName: inferOnlyOfficeFileNameFromPath(
        version.snapshotPath,
        `document-${document.id}-v${version.versionNumber}`,
        document.type
      ),
      mimeType: inferOnlyOfficeMimeType(version.snapshotPath, document.type)
    };
  }

  async restoreVersion(input: {
    documentId: string;
    versionId: string;
    userId: string;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const sourceVersion = await this.app.prisma.collaborativeDocumentVersion.findFirst({
      where: {
        id: input.versionId,
        documentId: input.documentId
      },
      select: {
        snapshotPath: true,
        versionNumber: true
      }
    });

    if (!sourceVersion) {
      throw new Error("Versión no encontrada");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const sourceStream = await this.app.storage.getObjectStream(sourceVersion.snapshotPath);
    const sourceBuffer = await streamToBuffer(sourceStream);

    return this.createVersionFromBuffer({
      documentId: input.documentId,
      userId: input.userId,
      kind: "MANUAL",
      fileName: inferOnlyOfficeFileNameFromPath(
        sourceVersion.snapshotPath,
        `restore-from-v${sourceVersion.versionNumber}`,
        document.type
      ),
      mimeType:
        document.type === "DIAGRAMA"
          ? DOCUMENT_DIAGRAM_SNAPSHOT_MIME
          : inferOnlyOfficeMimeType(sourceVersion.snapshotPath, document.type),
      data: sourceBuffer
    });
  }

  async uploadAsset(input: {
    documentId: string;
    userId: string;
    originalName: string;
    mimeType: string;
    data: Buffer;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    if (input.data.length <= 0) {
      throw new Error("El archivo está vacío");
    }

    if (input.data.length > DOCUMENT_VERSION_MAX_BYTES) {
      throw new Error("El archivo excede el límite de 50MB");
    }

    const safeName = sanitizeFileName(input.originalName || "asset");
    const safeMime = input.mimeType.trim() || DEFAULT_ASSET_MIME;
    const objectKey = `documents/${document.projectId}/${document.id}/assets/${Date.now()}-${randomUUID()}-${safeName}`;

    await this.app.storage.putObject(objectKey, input.data, safeMime);

    const asset = await this.app.prisma.documentAsset.create({
      data: {
        documentId: document.id,
        createdById: input.userId,
        originalName: safeName,
        mimeType: safeMime,
        sizeBytes: input.data.length,
        minioPath: objectKey
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true
      }
    });

    const token = await this.app.jwt.sign(
      {
        typ: DOCUMENT_ASSET_TOKEN_TYPE,
        documentId: document.id,
        key: objectKey,
        mime: safeMime,
        name: safeName
      },
      {
        expiresIn: "365d"
      }
    );

    return {
      id: asset.id,
      url: `/api/v1/documents/assets/content?token=${encodeURIComponent(token)}`,
      name: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes
    };
  }

  async getAssetContent(input: { token: string }) {
    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const payload = (await this.app.jwt.verify(input.token)) as Partial<{
      typ: string;
      documentId: string;
      key: string;
      mime: string;
      name: string;
    }>;

    if (
      payload.typ !== DOCUMENT_ASSET_TOKEN_TYPE ||
      typeof payload.documentId !== "string" ||
      typeof payload.key !== "string" ||
      !payload.key.startsWith("documents/")
    ) {
      throw new Error("Token de recurso inválido");
    }

    const asset = await this.app.prisma.documentAsset.findFirst({
      where: {
        documentId: payload.documentId,
        minioPath: payload.key,
        document: {
          deletedAt: null
        }
      },
      select: {
        minioPath: true
      }
    });

    if (!asset) {
      throw new Error("Asset no encontrado");
    }

    const stream = await this.app.storage.getObjectStream(asset.minioPath);

    return {
      stream,
      mimeType: typeof payload.mime === "string" && payload.mime ? payload.mime : DEFAULT_ASSET_MIME,
      fileName: sanitizeFileName(typeof payload.name === "string" ? payload.name : "asset")
    };
  }

  async heartbeatPresence(input: {
    documentId: string;
    userId: string;
    color: string;
    cursorLabel?: string;
  }) {
    await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!this.app.redis) {
      return { ok: true };
    }

    const ttlSeconds = this.getPresenceTtlSeconds();
    const payload: PresencePayload = {
      userId: input.userId,
      color: input.color,
      cursorLabel: input.cursorLabel?.trim() || null,
      lastSeenAt: new Date().toISOString()
    };

    const pipeline = this.app.redis.pipeline();
    pipeline.sadd(this.presenceSetKey(input.documentId), input.userId);
    pipeline.expire(this.presenceSetKey(input.documentId), ttlSeconds + 30);
    pipeline.set(
      this.presenceValueKey(input.documentId, input.userId),
      JSON.stringify(payload),
      "EX",
      ttlSeconds
    );
    await pipeline.exec();

    return {
      ok: true
    };
  }

  async listPresence(input: { projectId: string; userId: string }) {
    await this.assertProjectAccess(input.projectId, input.userId);

    const documents = await this.app.prisma.collaborativeDocument.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    const presenceMap = await this.getPresenceForDocuments(documents.map((document) => document.id));

    return {
      items: documents.map((document) => ({
        documentId: document.id,
        collaborators: (presenceMap.get(document.id) ?? []).map((collaborator) => ({
          userId: collaborator.userId,
          name: collaborator.name,
          color: collaborator.color,
          cursorLabel: collaborator.cursorLabel,
          lastSeenAt: collaborator.lastSeenAt
        }))
      }))
    };
  }

  // ── Trash ──────────────────────────────────────────────

  async listTrash(input: { projectId: string; userId: string }) {
    await this.assertProjectAccess(input.projectId, input.userId);

    const documents = await this.app.prisma.collaborativeDocument.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: { not: null },
        purgeAt: { gt: new Date() }
      },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: [{ deletedAt: "desc" }]
    });

    return {
      items: documents.map((doc) => this.mapDocument(doc))
    };
  }

  async restoreDocument(input: { documentId: string; userId: string }) {
    const document = await this.app.prisma.collaborativeDocument.findUnique({
      where: { id: input.documentId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });

    if (!document || !document.deletedAt) {
      throw new Error("Documento no encontrado en papelera");
    }

    await this.assertProjectAccess(document.projectId, input.userId);

    const restored = await this.app.prisma.collaborativeDocument.update({
      where: { id: input.documentId },
      data: { deletedAt: null, purgeAt: null },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });

    return this.mapDocument(restored);
  }

  // ── Duplicate ──────────────────────────────────────────

  async duplicateDocument(input: { documentId: string; userId: string }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const space = await this.ensureDocumentSpace(document.projectId, input.userId);
    const folderId = this.resolveFolderIdByType(space, document.type);
    const now = Date.now();

    const created = await this.app.prisma.collaborativeDocument.create({
      data: {
        projectId: document.projectId,
        folderId,
        type: document.type,
        name: `${document.name} (copia)`,
        yDocName: `doc-${document.projectId}-${now}-${randomUUID()}`,
        ...(document.type === "DIAGRAMA"
          ? {
              diagramEngine: document.diagramEngine ?? ("REACT_FLOW" as const),
              diagramKind: document.diagramKind ?? "FLUJO"
            }
          : {}),
        createdById: input.userId
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });

    // Copy latest version if exists
    if (this.app.storage) {
      const latestVersion = await this.app.prisma.collaborativeDocumentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNumber: "desc" }
      });

      if (latestVersion) {
        try {
          const stream = await this.app.storage.getObjectStream(latestVersion.snapshotPath);
          const buffer = await streamToBuffer(stream);
          const copiedFallbackName = isOnlyOfficeDocumentType(created.type)
            ? getOnlyOfficeFileName(created.name, created.type)
            : `${created.name}.json`;
          const copiedFileName = inferOnlyOfficeFileNameFromPath(
            latestVersion.snapshotPath,
            copiedFallbackName,
            created.type as DocumentType
          );
          const snapshotPath = `documents/${created.projectId}/documentos/${created.type.toLowerCase()}/${created.id}/v1-manual-${Date.now()}-${sanitizeFileName(copiedFileName)}`;
          await this.app.storage.putObject(
            snapshotPath,
            buffer,
            created.type === "DIAGRAMA"
              ? DOCUMENT_DIAGRAM_SNAPSHOT_MIME
              : isOnlyOfficeDocumentType(created.type)
                ? inferOnlyOfficeMimeType(latestVersion.snapshotPath, created.type)
                : DEFAULT_VERSION_MIME
          );

          await this.app.prisma.$transaction(async (tx) => {
            await tx.collaborativeDocumentVersion.create({
              data: {
                documentId: created.id,
                versionNumber: 1,
                kind: "MANUAL",
                snapshotPath,
                snapshotSizeBytes: buffer.length,
                createdById: input.userId
              }
            });
            await tx.collaborativeDocument.update({
              where: { id: created.id },
              data: { currentVersion: 1 }
            });
          });
        } catch {
          // If copy fails, the document is still created without initial version
        }
      }
    }

    return this.mapDocument(created);
  }

  // ── Favorites ──────────────────────────────────────────

  async toggleFavorite(input: { documentId: string; userId: string }) {
    await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const existing = await this.app.prisma.documentFavorite.findUnique({
      where: {
        documentId_userId: {
          documentId: input.documentId,
          userId: input.userId
        }
      }
    });

    if (existing) {
      await this.app.prisma.documentFavorite.delete({
        where: { id: existing.id }
      });
      return { isFavorite: false };
    }

    await this.app.prisma.documentFavorite.create({
      data: {
        documentId: input.documentId,
        userId: input.userId
      }
    });

    return { isFavorite: true };
  }

  async removeFavorite(input: { documentId: string; userId: string }) {
    await this.app.prisma.documentFavorite.deleteMany({
      where: {
        documentId: input.documentId,
        userId: input.userId
      }
    });
    return { isFavorite: false };
  }

  // ── Templates ──────────────────────────────────────────

  async listTemplates(input: { projectId?: string; type?: DocumentType }) {
    const templates = await this.app.prisma.documentTemplate.findMany({
      where: {
        ...(input.projectId
          ? {
              OR: [
                { projectId: input.projectId },
                { projectId: null }
              ]
            }
          : { projectId: null }),
        ...(input.type ? { type: input.type } : {})
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return {
      items: templates.map((t): DocumentTemplate => ({
        id: t.id,
        projectId: t.projectId,
        type: t.type as DocumentType,
        name: t.name,
        description: t.description,
        snapshotPath: t.snapshotPath,
        createdById: t.createdById,
        createdAt: t.createdAt.toISOString()
      }))
    };
  }

  async createTemplate(input: {
    documentId: string;
    name: string;
    description?: string;
    userId: string;
  }) {
    const document = await this.getDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const latestVersion = await this.app.prisma.collaborativeDocumentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { versionNumber: "desc" }
    });

    if (!latestVersion) {
      throw new Error("El documento no tiene versiones guardadas para crear una plantilla");
    }

    const sourceStream = await this.app.storage.getObjectStream(latestVersion.snapshotPath);
    const buffer = await streamToBuffer(sourceStream);
    const templateFallbackName = isOnlyOfficeDocumentType(document.type)
      ? getOnlyOfficeFileName(document.name, document.type)
      : `${document.name}.json`;
    const templateFileName = inferOnlyOfficeFileNameFromPath(
      latestVersion.snapshotPath,
      templateFallbackName,
      document.type
    );
    const snapshotPath = `templates/${document.projectId}/${randomUUID()}-${Date.now()}-${sanitizeFileName(templateFileName)}`;
    await this.app.storage.putObject(
      snapshotPath,
      buffer,
      document.type === "DIAGRAMA"
        ? DOCUMENT_DIAGRAM_SNAPSHOT_MIME
        : isOnlyOfficeDocumentType(document.type)
          ? inferOnlyOfficeMimeType(latestVersion.snapshotPath, document.type)
          : DEFAULT_VERSION_MIME
    );

    const template = await this.app.prisma.documentTemplate.create({
      data: {
        projectId: document.projectId,
        type: document.type,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        snapshotPath,
        createdById: input.userId
      }
    });

    return {
      id: template.id,
      projectId: template.projectId,
      type: template.type as DocumentType,
      name: template.name,
      description: template.description,
      snapshotPath: template.snapshotPath,
      createdById: template.createdById,
      createdAt: template.createdAt.toISOString()
    } satisfies DocumentTemplate;
  }

  async createDocumentFromTemplate(input: {
    projectId: string;
    userId: string;
    type: DocumentType;
    name: string;
    templateId: string;
    diagramKind?: DiagramKind;
  }) {
    await this.assertProjectAccess(input.projectId, input.userId);

    const template = await this.app.prisma.documentTemplate.findUnique({
      where: { id: input.templateId }
    });

    if (!template) {
      throw new Error("Plantilla no encontrada");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const space = await this.ensureDocumentSpace(input.projectId, input.userId);
    const folderId = this.resolveFolderIdByType(space, input.type);
    const now = Date.now();

    const document = await this.app.prisma.collaborativeDocument.create({
      data: {
        projectId: input.projectId,
        folderId,
        type: input.type,
        name: input.name.trim(),
        yDocName: `doc-${input.projectId}-${now}-${randomUUID()}`,
        ...(input.type === "DIAGRAMA"
          ? {
              diagramEngine: "REACT_FLOW" as const,
              diagramKind: input.diagramKind ?? "FLUJO"
            }
          : {}),
        createdById: input.userId
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });

    // Copy template snapshot as version 1
    try {
      const stream = await this.app.storage.getObjectStream(template.snapshotPath);
      const buffer = await streamToBuffer(stream);
      const templateCopyFallbackName = isOnlyOfficeDocumentType(document.type)
        ? getOnlyOfficeFileName(document.name, document.type)
        : `${document.name}.json`;
      const templateFileName = inferOnlyOfficeFileNameFromPath(
        template.snapshotPath,
        templateCopyFallbackName,
        document.type
      );
      const snapshotPath = `documents/${document.projectId}/${document.id}/v1-manual-${Date.now()}-${sanitizeFileName(templateFileName)}`;
      await this.app.storage.putObject(
        snapshotPath,
        buffer,
        document.type === "DIAGRAMA"
          ? DOCUMENT_DIAGRAM_SNAPSHOT_MIME
          : isOnlyOfficeDocumentType(document.type)
            ? inferOnlyOfficeMimeType(template.snapshotPath, document.type)
            : DEFAULT_VERSION_MIME
      );

      await this.app.prisma.$transaction(async (tx) => {
        await tx.collaborativeDocumentVersion.create({
          data: {
            documentId: document.id,
            versionNumber: 1,
            kind: "MANUAL",
            snapshotPath,
            snapshotSizeBytes: buffer.length,
            createdById: input.userId
          }
        });
        await tx.collaborativeDocument.update({
          where: { id: document.id },
          data: { currentVersion: 1 }
        });
      });
    } catch {
      // Document created without template content on failure
    }

    return this.mapDocument(document);
  }

  // ── Batch operations ───────────────────────────────────

  async batchSoftDelete(input: { documentIds: string[]; userId: string }) {
    if (input.documentIds.length === 0) {
      return { count: 0 };
    }

    // Verify access for all documents
    const documents = await this.app.prisma.collaborativeDocument.findMany({
      where: {
        id: { in: input.documentIds },
        deletedAt: null
      },
      select: { id: true, projectId: true }
    });

    const projectIds = [...new Set(documents.map((d) => d.projectId))];
    await Promise.all(projectIds.map((pid) => this.assertProjectAccess(pid, input.userId)));

    const now = new Date();
    const purgeAt = new Date(now.getTime() + DOCUMENT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.app.prisma.collaborativeDocument.updateMany({
      where: {
        id: { in: documents.map((d) => d.id) },
        deletedAt: null
      },
      data: { deletedAt: now, purgeAt }
    });

    return { count: result.count };
  }

  async batchRestore(input: { documentIds: string[]; userId: string }) {
    if (input.documentIds.length === 0) {
      return { count: 0 };
    }

    const documents = await this.app.prisma.collaborativeDocument.findMany({
      where: {
        id: { in: input.documentIds },
        deletedAt: { not: null },
        purgeAt: { gt: new Date() }
      },
      select: { id: true, projectId: true }
    });

    const projectIds = [...new Set(documents.map((d) => d.projectId))];
    await Promise.all(projectIds.map((pid) => this.assertProjectAccess(pid, input.userId)));

    const result = await this.app.prisma.collaborativeDocument.updateMany({
      where: {
        id: { in: documents.map((d) => d.id) }
      },
      data: { deletedAt: null, purgeAt: null }
    });

    return { count: result.count };
  }
}
