-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'FILE', 'CALL_INVITE');

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "meetingId" UUID;

-- CreateTable
CREATE TABLE "MessageAttachment" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "minioPath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_kind_idx" ON "Message"("kind");

-- CreateIndex
CREATE INDEX "Message_meetingId_idx" ON "Message"("meetingId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageAttachment_createdAt_idx" ON "MessageAttachment"("createdAt");

-- AddForeignKey
ALTER TABLE "Message"
ADD CONSTRAINT "Message_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment"
ADD CONSTRAINT "MessageAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
