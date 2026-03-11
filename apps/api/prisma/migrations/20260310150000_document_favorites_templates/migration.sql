-- CreateTable
CREATE TABLE "DocumentFavorite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID,
    "type" "DocumentType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "snapshotPath" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFavorite_documentId_userId_key" ON "DocumentFavorite"("documentId", "userId");

-- CreateIndex
CREATE INDEX "DocumentTemplate_projectId_type_idx" ON "DocumentTemplate"("projectId", "type");

-- AddForeignKey
ALTER TABLE "DocumentFavorite" ADD CONSTRAINT "DocumentFavorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFavorite" ADD CONSTRAINT "DocumentFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
