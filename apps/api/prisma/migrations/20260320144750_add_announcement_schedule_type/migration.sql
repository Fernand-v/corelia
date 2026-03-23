-- CreateEnum
CREATE TYPE "TipoProgramacionAnuncio" AS ENUM ('INMEDIATO', 'PROGRAMADO', 'CUMPLEANOS');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "recurringDay" INTEGER,
ADD COLUMN     "recurringMonth" INTEGER,
ADD COLUMN     "scheduleType" "TipoProgramacionAnuncio" NOT NULL DEFAULT 'INMEDIATO',
ADD COLUMN     "startsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BrowserPushSubscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocumentCollabEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocumentCollabParticipant" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocumentCollabSession" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocumentFavorite" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocumentTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DynamicForm" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DynamicFormAnswer" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DynamicFormQuestion" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DynamicFormResponse" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Announcement_scheduleType_idx" ON "Announcement"("scheduleType");
