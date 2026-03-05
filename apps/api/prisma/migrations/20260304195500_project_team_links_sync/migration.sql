-- CreateEnum
CREATE TYPE "ProjectMembershipSource" AS ENUM ('MANUAL', 'SYNC');

-- AlterTable
ALTER TABLE "ProjectMember"
ADD COLUMN     "membershipSource" "ProjectMembershipSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "syncTeamsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProjectTeamLink" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeamLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_membershipSource_idx" ON "ProjectMember"("membershipSource");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamLink_projectId_teamId_key" ON "ProjectTeamLink"("projectId", "teamId");

-- CreateIndex
CREATE INDEX "ProjectTeamLink_projectId_idx" ON "ProjectTeamLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTeamLink_teamId_idx" ON "ProjectTeamLink"("teamId");

-- CreateIndex
CREATE INDEX "ProjectTeamLink_createdById_idx" ON "ProjectTeamLink"("createdById");

-- AddForeignKey
ALTER TABLE "ProjectTeamLink" ADD CONSTRAINT "ProjectTeamLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamLink" ADD CONSTRAINT "ProjectTeamLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamLink" ADD CONSTRAINT "ProjectTeamLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
