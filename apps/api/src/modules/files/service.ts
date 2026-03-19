import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

const notFound = (message: string): Error => {
  const error = new Error(message);
  error.name = "NotFoundError";
  return error;
};

const TRASH_RETENTION_DAYS = 30;
const DEFAULT_FILE_MIME = "application/octet-stream";
const DEFAULT_PROJECT_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "audio/",
  "video/",
  "text/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/json",
  "application/xml",
  "application/octet-stream"
];

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".scr", ".pif", ".vbs", ".vbe",
  ".js", ".jse", ".wsf", ".wsh", ".msi", ".msp", ".mst", ".cpl",
  ".hta", ".inf", ".ins", ".isp", ".lnk", ".reg", ".rgs", ".sct",
  ".shb", ".shs", ".ws", ".ps1", ".ps1xml", ".ps2", ".ps2xml",
  ".psc1", ".psc2", ".dll", ".sys", ".drv", ".sh", ".bash", ".csh"
]);

const isAllowedMimeType = (mimeType: string): boolean => {
  const normalized = mimeType.trim().toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const isBlockedExtension = (fileName: string): boolean => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) {
    return false;
  }
  const extension = fileName.slice(dotIndex).toLowerCase();
  return BLOCKED_EXTENSIONS.has(extension);
};

const toSafeNumber = (value: bigint): number => {
  if (value <= 0n) {
    return 0;
  }

  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > maxSafe) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(value);
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

  return safe.length > 0 ? safe.slice(0, 255) : "archivo";
};

export class FileService {
  constructor(private readonly app: FastifyInstance) {}

  async listProjectExplorer(input: {
    projectId: string;
    folderId?: string;
  }) {
    const project = await this.app.prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        name: true
      }
    });

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    let currentFolder:
      | {
          id: string;
          name: string;
          parentId: string | null;
        }
      | null = null;

    if (input.folderId) {
      currentFolder = await this.app.prisma.folder.findFirst({
        where: {
          id: input.folderId,
          projectId: input.projectId,
          scope: "PROYECTO"
        },
        select: {
          id: true,
          name: true,
          parentId: true
        }
      });

      if (!currentFolder) {
        throw new Error("Carpeta no encontrada en el proyecto");
      }
    }

    const breadcrumbs: Array<{ id: string; name: string }> = [];
    if (currentFolder) {
      const ancestors = await this.app.prisma.$queryRaw<
        Array<{ id: string; name: string; depth: number }>
      >`
        WITH RECURSIVE folder_path AS (
          SELECT id, name, "parentId", 0 AS depth
          FROM "Folder"
          WHERE id = ${currentFolder.id}::uuid
            AND "projectId" = ${input.projectId}::uuid
            AND scope = 'PROYECTO'
          UNION ALL
          SELECT f.id, f.name, f."parentId", fp.depth + 1
          FROM "Folder" f
          INNER JOIN folder_path fp ON f.id = fp."parentId"
          WHERE f."projectId" = ${input.projectId}::uuid
            AND f.scope = 'PROYECTO'
            AND fp.depth < 50
        )
        SELECT id, name, depth FROM folder_path ORDER BY depth DESC
      `;
      for (const ancestor of ancestors) {
        breadcrumbs.push({ id: ancestor.id, name: ancestor.name });
      }
    }

    const [folders, files] = await Promise.all([
      this.app.prisma.folder.findMany({
        where: {
          scope: "PROYECTO",
          projectId: input.projectId,
          parentId: currentFolder ? currentFolder.id : null
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          parentId: true,
          createdAt: true
        }
      }),
      currentFolder
        ? this.app.prisma.fileObject.findMany({
            where: {
              folderId: currentFolder.id,
              deletedAt: null
            },
            orderBy: [{ createdAt: "desc" }],
            take: 100,
            select: {
              id: true,
              folderId: true,
              ownerId: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              minioPath: true,
              createdAt: true,
              owner: {
                select: {
                  firstName: true,
                  lastName: true
                }
              },
              folder: {
                select: {
                  name: true
                }
              }
            }
          })
        : Promise.resolve([])
    ]);

    return {
      project: {
        id: project.id,
        name: project.name
      },
      currentFolder: currentFolder
        ? {
            id: currentFolder.id,
            name: currentFolder.name,
            parentId: currentFolder.parentId
          }
        : null,
      breadcrumbs,
      folders: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt.toISOString()
      })),
      files: files.map((file) => ({
        id: file.id,
        folderId: file.folderId,
        ownerId: file.ownerId,
        folderName: file.folder.name,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        minioPath: file.minioPath,
        createdAt: file.createdAt.toISOString(),
        ownerName: `${file.owner.firstName} ${file.owner.lastName}`.trim() || "Usuario sin nombre"
      }))
    };
  }

  async uploadProjectFile(input: {
    projectId: string;
    folderId: string;
    ownerId: string;
    originalName: string;
    mimeType: string;
    data: Buffer;
  }) {
    const folder = await this.app.prisma.folder.findFirst({
      where: {
        id: input.folderId,
        projectId: input.projectId,
        scope: "PROYECTO"
      },
      select: {
        id: true
      }
    });

    if (!folder) {
      throw new Error("La carpeta no existe para el proyecto seleccionado");
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    if (input.data.length <= 0) {
      throw new Error("El archivo está vacío");
    }

    const originalName = sanitizeFileName(input.originalName);

    if (isBlockedExtension(originalName)) {
      throw new Error("El tipo de archivo no está permitido por razones de seguridad");
    }

    if (!isAllowedMimeType(input.mimeType)) {
      throw new Error("El tipo MIME del archivo no está permitido");
    }
    const objectKey = `project/${input.projectId}/${input.folderId}/${Date.now()}-${randomUUID()}-${originalName}`;

    await this.app.storage.putObject(
      objectKey,
      input.data,
      input.mimeType.trim() || DEFAULT_FILE_MIME
    );

    return this.app.prisma.fileObject.create({
      data: {
        folderId: input.folderId,
        ownerId: input.ownerId,
        originalName,
        mimeType: input.mimeType.trim() || DEFAULT_FILE_MIME,
        sizeBytes: input.data.length,
        minioPath: objectKey
      }
    });
  }

  async createFolder(input: {
    name: string;
    scope: "EQUIPO" | "PROYECTO";
    teamId?: string | null;
    projectId?: string | null;
    parentId?: string | null;
    createdById: string;
  }) {
    return this.app.prisma.folder.create({
      data: {
        name: input.name,
        scope: input.scope,
        teamId: input.teamId ?? null,
        projectId: input.projectId ?? null,
        parentId: input.parentId ?? null,
        createdById: input.createdById
      }
    });
  }

  async registerFile(input: {
    folderId: string;
    ownerId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    minioPath: string;
  }) {
    const sanitizedName = sanitizeFileName(input.originalName);

    if (isBlockedExtension(sanitizedName)) {
      throw new Error("El tipo de archivo no está permitido por razones de seguridad");
    }

    if (!isAllowedMimeType(input.mimeType)) {
      throw new Error("El tipo MIME del archivo no está permitido");
    }

    if (/\.\./.test(input.minioPath) || input.minioPath.startsWith("/")) {
      throw new Error("La ruta del archivo no es válida");
    }

    const folder = await this.app.prisma.folder.findUnique({
      where: { id: input.folderId },
      select: { id: true }
    });

    if (!folder) {
      throw new Error("La carpeta especificada no existe");
    }

    return this.app.prisma.fileObject.create({
      data: {
        folderId: input.folderId,
        ownerId: input.ownerId,
        originalName: sanitizedName,
        mimeType: input.mimeType.trim() || DEFAULT_FILE_MIME,
        sizeBytes: input.sizeBytes,
        minioPath: input.minioPath
      }
    });
  }

  async getFileContent(input: { fileId: string; userId: string }) {
    const file = await this.app.prisma.fileObject.findUnique({
      where: { id: input.fileId },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        minioPath: true,
        deletedAt: true,
        folder: {
          select: {
            projectId: true
          }
        }
      }
    });

    if (!file || file.deletedAt) {
      throw notFound("Archivo no encontrado");
    }

    if (file.folder.projectId) {
      const isAdmin = await this.app.prisma.user.findFirst({
        where: {
          id: input.userId,
          baseRole: { is: { key: "ADMINISTRADOR" } }
        },
        select: { id: true }
      });

      if (!isAdmin) {
        const isMember = await this.app.prisma.projectMember.findFirst({
          where: {
            projectId: file.folder.projectId,
            userId: input.userId
          },
          select: { userId: true }
        });

        const isOwner = !isMember
          ? await this.app.prisma.project.findFirst({
              where: {
                id: file.folder.projectId,
                ownerId: input.userId
              },
              select: { id: true }
            })
          : null;

        if (!isMember && !isOwner) {
          throw notFound("Archivo no encontrado");
        }
      }
    }

    if (!this.app.storage) {
      throw new Error("Servicio de almacenamiento no disponible");
    }

    const stream = await this.app.storage.getObjectStream(file.minioPath);

    return {
      file,
      stream
    };
  }

  async listProjectChanges(input: { projectId: string; limit?: number }) {
    const project = await this.app.prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        name: true
      }
    });

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    const limit = input.limit ?? 50;
    const fileTake = Math.max(limit * 2, 100);

    const [folders, files] = await Promise.all([
      this.app.prisma.folder.findMany({
        where: {
          projectId: input.projectId,
          scope: "PROYECTO"
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          createdAt: true,
          createdBy: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      this.app.prisma.fileObject.findMany({
        where: {
          folder: {
            projectId: input.projectId,
            scope: "PROYECTO"
          }
        },
        orderBy: { createdAt: "desc" },
        take: fileTake,
        select: {
          id: true,
          originalName: true,
          createdAt: true,
          deletedAt: true,
          owner: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          folder: {
            select: {
              name: true
            }
          }
        }
      })
    ]);

    const folderChanges = folders.map((folder) => ({
      id: `${folder.id}:folder-created`,
      type: "CARPETA_CREADA" as const,
      title: folder.name,
      detail: "Carpeta creada",
      actorName: `${folder.createdBy.firstName} ${folder.createdBy.lastName}`.trim() || "Usuario",
      occurredAt: folder.createdAt.toISOString()
    }));

    const fileUploadChanges = files.map((file) => ({
      id: `${file.id}:file-uploaded`,
      type: "ARCHIVO_SUBIDO" as const,
      title: file.originalName,
      detail: `Archivo subido en ${file.folder.name}`,
      actorName: `${file.owner.firstName} ${file.owner.lastName}`.trim() || "Usuario",
      occurredAt: file.createdAt.toISOString()
    }));

    const fileDeleteChanges = files
      .filter((file) => Boolean(file.deletedAt))
      .map((file) => ({
        id: `${file.id}:file-deleted`,
        type: "ARCHIVO_ELIMINADO" as const,
        title: file.originalName,
        detail: `Archivo eliminado en ${file.folder.name}`,
        actorName: "Sistema",
        occurredAt: file.deletedAt!.toISOString()
      }));

    const changes = [...folderChanges, ...fileUploadChanges, ...fileDeleteChanges]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);

    return {
      project: {
        id: project.id,
        name: project.name
      },
      changes
    };
  }

  async deleteToTrash(input: { fileId: string; projectId: string }) {
    const now = new Date();
    const purgeAt = new Date(now.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const file = await this.app.prisma.fileObject.findFirst({
      where: {
        id: input.fileId,
        folder: {
          projectId: input.projectId,
          scope: "PROYECTO"
        }
      },
      select: {
        id: true,
        deletedAt: true
      }
    });

    if (!file) {
      throw new Error("Archivo no encontrado en el proyecto");
    }

    if (file.deletedAt) {
      throw new Error("El archivo ya fue eliminado");
    }

    return this.app.prisma.$transaction(async (tx) => {
      const deletedFile = await tx.fileObject.update({
        where: { id: input.fileId },
        data: {
          deletedAt: now
        }
      });

      await tx.fileTrash.upsert({
        where: { fileId: input.fileId },
        update: { scheduledPurgeAt: purgeAt },
        create: {
          fileId: input.fileId,
          scheduledPurgeAt: purgeAt
        }
      });

      return deletedFile;
    });
  }

  async upsertQuota(input: {
    scopeType: "USUARIO" | "EQUIPO";
    scopeId: string;
    bytesLimit: bigint;
    alertThresholdPct: number;
  }) {
    const isUserScope = input.scopeType === "USUARIO";
    return this.app.prisma.storageQuota.upsert({
      where: {
        ...(isUserScope ? { userId: input.scopeId } : { teamId: input.scopeId })
      },
      update: {
        bytesLimit: input.bytesLimit,
        alertThresholdPct: input.alertThresholdPct
      },
      create: {
        userId: isUserScope ? input.scopeId : null,
        teamId: isUserScope ? null : input.scopeId,
        bytesLimit: input.bytesLimit,
        alertThresholdPct: input.alertThresholdPct
      }
    });
  }

  async getProjectStorageSummary(input: { projectId: string }) {
    const project = await this.app.prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        ownerId: true
      }
    });

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    const usageAggregate = await this.app.prisma.fileObject.aggregate({
      where: {
        deletedAt: null,
        folder: {
          projectId: input.projectId,
          scope: "PROYECTO"
        }
      },
      _sum: {
        sizeBytes: true
      }
    });

    const ownerQuota = await this.app.prisma.storageQuota.findUnique({
      where: {
        userId: project.ownerId
      },
      select: {
        bytesLimit: true,
        alertThresholdPct: true
      }
    });

    const resolvedQuota = ownerQuota;
    const usageBytes = usageAggregate._sum.sizeBytes ?? 0;
    const bytesLimit = resolvedQuota
      ? toSafeNumber(resolvedQuota.bytesLimit)
      : DEFAULT_PROJECT_STORAGE_LIMIT_BYTES;
    const remainingBytes = Math.max(0, bytesLimit - usageBytes);
    const usagePct = bytesLimit > 0 ? Math.min(1, usageBytes / bytesLimit) : 0;
    const warningThreshold = resolvedQuota?.alertThresholdPct ?? 0.8;

    return {
      projectId: project.id,
      usageBytes,
      bytesLimit,
      remainingBytes,
      usagePct,
      warning80: usagePct >= warningThreshold
    };
  }

  async usage(scopeType: "USUARIO" | "EQUIPO", scopeId: string) {
    if (scopeType === "USUARIO") {
      const aggregate = await this.app.prisma.fileObject.aggregate({
        where: {
          ownerId: scopeId,
          deletedAt: null
        },
        _sum: { sizeBytes: true }
      });
      return aggregate._sum.sizeBytes ?? 0;
    }

    const aggregate = await this.app.prisma.fileObject.aggregate({
      where: {
        folder: {
          teamId: scopeId
        },
        deletedAt: null
      },
      _sum: { sizeBytes: true }
    });
    return aggregate._sum.sizeBytes ?? 0;
  }
}
