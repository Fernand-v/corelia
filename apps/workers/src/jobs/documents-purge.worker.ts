import { PrismaClient } from "@prisma/client";
import { Client } from "minio";
import { env } from "../lib/env.js";
import { buildAuditTargetCreateData } from "../lib/audit-target.js";
import { createPrismaSchemaGate } from "../lib/schema-readiness.js";

const prisma = new PrismaClient();
const ensureDocumentsPurgeSchemaReady = createPrismaSchemaGate(prisma, "documents purge scheduler", [
  { table: "CollaborativeDocument", column: "purgeAt" },
  { table: "CollaborativeDocumentVersion", column: "snapshotPath" },
  { table: "DocumentAsset", column: "minioPath" },
  { table: "AuditLog", column: "action" }
]);

const storage = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY
});

const purgeIntervalMs = Math.max(5, env.DOCUMENTS_PURGE_INTERVAL_MINUTES) * 60 * 1000;

const purgeExpiredDocuments = async () => {
  const now = new Date();

  const documents = await prisma.collaborativeDocument.findMany({
    where: {
      deletedAt: {
        not: null
      },
      purgeAt: {
        lte: now
      }
    },
    include: {
      versions: {
        select: {
          id: true,
          snapshotPath: true
        }
      },
      assets: {
        select: {
          minioPath: true
        }
      }
    },
    take: 200,
    orderBy: {
      purgeAt: "asc"
    }
  });

  for (const document of documents) {
    for (const version of document.versions) {
      try {
        await storage.removeObject(env.MINIO_BUCKET, version.snapshotPath);
      } catch {
        // Purga idempotente: si ya no existe, se ignora.
      }
    }

    for (const asset of document.assets) {
      try {
        await storage.removeObject(env.MINIO_BUCKET, asset.minioPath);
      } catch {
        // Purga idempotente: si ya no existe, se ignora.
      }
    }

    await prisma.$transaction([
      prisma.documentAsset.deleteMany({
        where: {
          documentId: document.id
        }
      }),
      prisma.collaborativeDocumentVersion.deleteMany({
        where: {
          documentId: document.id
        }
      }),
      prisma.collaborativeDocument.delete({
        where: {
          id: document.id
        }
      }),
      prisma.auditLog.create({
        data: {
          ...buildAuditTargetCreateData("ARCHIVO", document.id),
          action: "ELIMINAR",
          reasonCatalogId: null,
          reason: "Papelera expirada: documento purgado automáticamente"
        }
      })
    ]);
  }
};

const runDocumentsPurge = async () => {
  if (!(await ensureDocumentsPurgeSchemaReady())) {
    return;
  }

  await purgeExpiredDocuments();
};

export const startDocumentsPurgeScheduler = () => {
  const timer = setInterval(() => {
    void runDocumentsPurge().catch((error) => {
      console.error("[workers] documents purge failed", error);
    });
  }, purgeIntervalMs);

  void runDocumentsPurge().catch((error) => {
    console.error("[workers] initial documents purge failed", error);
  });

  return () => {
    clearInterval(timer);
  };
};
