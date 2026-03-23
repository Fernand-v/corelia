-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'URGENTE');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Notification" ADD COLUMN "groupKey" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_groupKey_idx" ON "Notification"("userId", "groupKey");
