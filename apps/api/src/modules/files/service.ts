import type { FastifyInstance } from "fastify";

const TRASH_RETENTION_DAYS = 30;

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
      let cursor: { id: string; name: string; parentId: string | null } | null = currentFolder;
      while (cursor) {
        breadcrumbs.unshift({ id: cursor.id, name: cursor.name });
        if (!cursor.parentId) {
          break;
        }
        cursor = await this.app.prisma.folder.findFirst({
          where: {
            id: cursor.parentId,
            projectId: input.projectId,
            scope: "PROYECTO"
          },
          select: {
            id: true,
            name: true,
            parentId: true
          }
        });
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
      this.app.prisma.fileObject.findMany({
        where: currentFolder
          ? {
              folderId: currentFolder.id,
              deletedAt: null
            }
          : {
              deletedAt: null,
              folder: {
                projectId: input.projectId,
                scope: "PROYECTO"
              }
            },
        orderBy: [{ createdAt: "desc" }],
        take: currentFolder ? 100 : 10,
        select: {
          id: true,
          folderId: true,
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
        folderName: file.folder.name,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        minioPath: file.minioPath,
        createdAt: file.createdAt.toISOString(),
        ownerName: `${file.owner.firstName} ${file.owner.lastName}`.trim()
      }))
    };
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
        teamId: input.teamId,
        projectId: input.projectId,
        parentId: input.parentId,
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
    return this.app.prisma.fileObject.create({
      data: {
        folderId: input.folderId,
        ownerId: input.ownerId,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        minioPath: input.minioPath
      }
    });
  }

  async deleteToTrash(fileId: string) {
    const now = new Date();
    const purgeAt = new Date(now.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    return this.app.prisma.$transaction(async (tx) => {
      const file = await tx.fileObject.update({
        where: { id: fileId },
        data: {
          deletedAt: now
        }
      });

      await tx.fileTrash.upsert({
        where: { fileId },
        update: { scheduledPurgeAt: purgeAt },
        create: {
          fileId,
          scheduledPurgeAt: purgeAt
        }
      });

      return file;
    });
  }

  async upsertQuota(input: {
    scopeType: "USUARIO" | "EQUIPO";
    scopeId: string;
    bytesLimit: bigint;
    alertThresholdPct: number;
  }) {
    return this.app.prisma.storageQuota.upsert({
      where: {
        scopeType_scopeId: {
          scopeType: input.scopeType,
          scopeId: input.scopeId
        }
      },
      update: {
        bytesLimit: input.bytesLimit,
        alertThresholdPct: input.alertThresholdPct
      },
      create: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        bytesLimit: input.bytesLimit,
        alertThresholdPct: input.alertThresholdPct
      }
    });
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
