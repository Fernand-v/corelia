-- DropIndex
DROP INDEX "SignupRequest_inviteId_idx";

-- AlterTable
ALTER TABLE "AutomationRule" DROP COLUMN "configText",
ADD COLUMN     "config" TEXT;

-- AlterTable
ALTER TABLE "FormRequest" ADD COLUMN     "payload" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MeetingNote" DROP COLUMN "contentText",
ADD COLUMN     "content" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WebhookDelivery" DROP COLUMN "body",
ADD COLUMN     "payload" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SignupRequest_inviteId_key" ON "SignupRequest"("inviteId");
