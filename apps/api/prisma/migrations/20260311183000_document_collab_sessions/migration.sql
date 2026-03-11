-- CreateEnum
CREATE TYPE "DocumentCollabSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentCollabParticipantStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "DocumentCollabEventType" AS ENUM ('JOIN', 'LEAVE', 'DISCONNECT', 'RECONNECT', 'SNAPSHOT_SAVED', 'SAVE_VERSION', 'ERROR', 'MIGRATION');

-- CreateTable
CREATE TABLE "DocumentCollabSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" "DocumentCollabSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "latestSnapshotPath" TEXT,
    "latestSnapshotHash" TEXT,
    "latestSnapshotSizeBytes" INTEGER,
    "latestSnapshotAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentCollabSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCollabParticipant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "DocumentCollabParticipantStatus" NOT NULL DEFAULT 'ONLINE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),

    CONSTRAINT "DocumentCollabParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCollabEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "userId" UUID,
    "clientId" TEXT,
    "type" "DocumentCollabEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCollabEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentCollabSession_documentId_status_lastActivityAt_idx" ON "DocumentCollabSession"("documentId", "status", "lastActivityAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentCollabSession_startedAt_idx" ON "DocumentCollabSession"("startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCollabParticipant_sessionId_userId_clientId_key" ON "DocumentCollabParticipant"("sessionId", "userId", "clientId");

-- CreateIndex
CREATE INDEX "DocumentCollabParticipant_sessionId_status_lastHeartbeatAt_idx" ON "DocumentCollabParticipant"("sessionId", "status", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "DocumentCollabParticipant_userId_status_idx" ON "DocumentCollabParticipant"("userId", "status");

-- CreateIndex
CREATE INDEX "DocumentCollabEvent_sessionId_createdAt_idx" ON "DocumentCollabEvent"("sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentCollabEvent_type_createdAt_idx" ON "DocumentCollabEvent"("type", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "DocumentCollabSession" ADD CONSTRAINT "DocumentCollabSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborativeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollabParticipant" ADD CONSTRAINT "DocumentCollabParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DocumentCollabSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollabParticipant" ADD CONSTRAINT "DocumentCollabParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollabEvent" ADD CONSTRAINT "DocumentCollabEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DocumentCollabSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollabEvent" ADD CONSTRAINT "DocumentCollabEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
