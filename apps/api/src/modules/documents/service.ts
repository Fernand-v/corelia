import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import type {
  CollaborativeDocument,
  CollaborativeDocumentVersion,
  DiagramKind,
  DocumentType,
  DocumentVersionKind,
  DocumentsExplorerResponse
} from "@corelia/types";
import { Prisma } from "@prisma/client";

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

const stripControlChars = (input: string): string =>
  Array.from(input)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

const sanitizeFileName = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ");

  const safe = stripControlChars(normalized)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ");

  return safe.length > 0 ? safe.slice(0, 255) : "snapshot.json";
};

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
          baseRole: "ADMINISTRADOR"
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
      grouped[document.type].push(this.mapDocument(document));
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
    const snapshotPath = `documents/${document.projectId}/${document.id}/v${nextVersion}-${input.kind.toLowerCase()}-${Date.now()}-${safeName}`;

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
    await this.getDocumentForUser({
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
      version
    };
  }

  async restoreVersion(input: {
    documentId: string;
    versionId: string;
    userId: string;
  }) {
    await this.getDocumentForUser({
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
      fileName: `restore-from-v${sourceVersion.versionNumber}.json`,
      mimeType: DEFAULT_VERSION_MIME,
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
}
