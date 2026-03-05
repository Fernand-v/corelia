-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TEXTO', 'DIAGRAMA', 'TABLA', 'WHITEBOARD', 'PRESENTACION');

-- CreateEnum
CREATE TYPE "DocumentVersionKind" AS ENUM ('MANUAL', 'AUTO');

-- CreateTable
CREATE TABLE "ProjectDocumentSpace" (
    "projectId" UUID NOT NULL,
    "rootFolderId" UUID NOT NULL,
    "textoFolderId" UUID NOT NULL,
    "diagramasFolderId" UUID NOT NULL,
    "tablasFolderId" UUID NOT NULL,
    "whiteboardFolderId" UUID NOT NULL,
    "presentacionesFolderId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocumentSpace_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "CollaborativeDocument" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "yDocName" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborativeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborativeDocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "kind" "DocumentVersionKind" NOT NULL,
    "snapshotPath" TEXT NOT NULL,
    "snapshotSizeBytes" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborativeDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDocumentSpace_projectId_idx" ON "ProjectDocumentSpace"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborativeDocument_yDocName_key" ON "CollaborativeDocument"("yDocName");

-- CreateIndex
CREATE INDEX "CollaborativeDocument_projectId_type_updatedAt_idx" ON "CollaborativeDocument"("projectId", "type", "updatedAt");

-- CreateIndex
CREATE INDEX "CollaborativeDocument_deletedAt_purgeAt_idx" ON "CollaborativeDocument"("deletedAt", "purgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborativeDocumentVersion_documentId_versionNumber_key" ON "CollaborativeDocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "CollaborativeDocumentVersion_documentId_versionNumber_idx" ON "CollaborativeDocumentVersion"("documentId", "versionNumber" DESC);

-- AddForeignKey
ALTER TABLE "ProjectDocumentSpace" ADD CONSTRAINT "ProjectDocumentSpace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocument" ADD CONSTRAINT "CollaborativeDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocument" ADD CONSTRAINT "CollaborativeDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocument" ADD CONSTRAINT "CollaborativeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocumentVersion" ADD CONSTRAINT "CollaborativeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborativeDocumentVersion" ADD CONSTRAINT "CollaborativeDocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
