-- CreateEnum
CREATE TYPE "DiagramEngine" AS ENUM ('EXCALIDRAW', 'REACT_FLOW');

-- CreateEnum
CREATE TYPE "DiagramKind" AS ENUM ('FLUJO', 'SECUENCIA', 'UML_CLASES', 'ENTIDAD_RELACION', 'ESTADO', 'ARQUITECTURA', 'BPMN');

-- AlterTable
ALTER TABLE "CollaborativeDocument"
  ADD COLUMN "diagramEngine" "DiagramEngine",
  ADD COLUMN "diagramKind" "DiagramKind";

-- Keep legacy diagrams explicitly tagged as Excalidraw
UPDATE "CollaborativeDocument"
SET "diagramEngine" = 'EXCALIDRAW'
WHERE "type" = 'DIAGRAMA' AND "diagramEngine" IS NULL;

-- CreateTable
CREATE TABLE "DocumentAsset" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "minioPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAsset_documentId_createdAt_idx" ON "DocumentAsset"("documentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentAsset_createdById_idx" ON "DocumentAsset"("createdById");

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
