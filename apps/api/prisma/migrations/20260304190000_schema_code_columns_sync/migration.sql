-- CreateEnum
CREATE TYPE "TaskCodeField" AS ENUM ('TASK_DESCRIPTION', 'TASK_BLOCKED_REASON', 'TASK_STATUS_REASON', 'TASK_REASSIGN_REASON', 'TASK_SCHEDULE_REASON');

-- CreateEnum
CREATE TYPE "ProjectCodeField" AS ENUM ('PROJECT_DESCRIPTION');

-- CreateEnum
CREATE TYPE "TeamCodeField" AS ENUM ('TEAM_DESCRIPTION');

-- CreateEnum
CREATE TYPE "MeetingCodeField" AS ENUM ('MEETING_DESCRIPTION', 'MEETING_AGREEMENT_DESCRIPTION');

-- CreateEnum
CREATE TYPE "ObjectiveCodeField" AS ENUM ('OBJECTIVE_DESCRIPTION');

-- CreateEnum
CREATE TYPE "DecisionCodeField" AS ENUM ('DECISION_DESCRIPTION');

-- CreateEnum
CREATE TYPE "IdentityCodeField" AS ENUM ('OFFBOARDING_REASON');

-- CreateEnum
CREATE TYPE "AuditCodeField" AS ENUM ('AUDIT_REASON');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "reasonCode" TEXT;

-- AlterTable
ALTER TABLE "DecisionNote" ADD COLUMN     "descriptionCode" TEXT;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "descriptionCode" TEXT;

-- AlterTable
ALTER TABLE "MeetingAgreement" ADD COLUMN     "descriptionCode" TEXT;

-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "descriptionCode" TEXT;

-- AlterTable
ALTER TABLE "OffboardingRecord" ADD COLUMN     "reasonCode" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "descriptionCode" TEXT;

-- AlterTable
ALTER TABLE "ProjectStage" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#4F7CFF';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "blockedReasonCode" TEXT,
ADD COLUMN     "descriptionCode" TEXT;

-- AlterTable
ALTER TABLE "TaskReassignment" ADD COLUMN     "reasonCode" TEXT;

-- AlterTable
ALTER TABLE "TaskScheduleHistory" ADD COLUMN     "reasonCode" TEXT;

-- AlterTable
ALTER TABLE "TaskStatusHistory" ADD COLUMN     "reasonCode" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "descriptionCode" TEXT;

-- CreateTable
CREATE TABLE "TaskCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "TaskCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "ProjectCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "TeamCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "MeetingCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "ObjectiveCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectiveCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "DecisionCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "IdentityCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCodeCatalog" (
    "id" UUID NOT NULL,
    "field" "AuditCodeField" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskCodeCatalog_field_isActive_idx" ON "TaskCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCodeCatalog_field_code_key" ON "TaskCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "ProjectCodeCatalog_field_isActive_idx" ON "ProjectCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCodeCatalog_field_code_key" ON "ProjectCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "TeamCodeCatalog_field_isActive_idx" ON "TeamCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCodeCatalog_field_code_key" ON "TeamCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "MeetingCodeCatalog_field_isActive_idx" ON "MeetingCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCodeCatalog_field_code_key" ON "MeetingCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "ObjectiveCodeCatalog_field_isActive_idx" ON "ObjectiveCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveCodeCatalog_field_code_key" ON "ObjectiveCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "DecisionCodeCatalog_field_isActive_idx" ON "DecisionCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionCodeCatalog_field_code_key" ON "DecisionCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "IdentityCodeCatalog_field_isActive_idx" ON "IdentityCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCodeCatalog_field_code_key" ON "IdentityCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "AuditCodeCatalog_field_isActive_idx" ON "AuditCodeCatalog"("field", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditCodeCatalog_field_code_key" ON "AuditCodeCatalog"("field", "code");

-- CreateIndex
CREATE INDEX "AuditLog_reasonCode_idx" ON "AuditLog"("reasonCode");

-- CreateIndex
CREATE INDEX "DecisionNote_descriptionCode_idx" ON "DecisionNote"("descriptionCode");

-- CreateIndex
CREATE INDEX "Meeting_descriptionCode_idx" ON "Meeting"("descriptionCode");

-- CreateIndex
CREATE INDEX "MeetingAgreement_descriptionCode_idx" ON "MeetingAgreement"("descriptionCode");

-- CreateIndex
CREATE INDEX "Objective_descriptionCode_idx" ON "Objective"("descriptionCode");

-- CreateIndex
CREATE INDEX "OffboardingRecord_reasonCode_idx" ON "OffboardingRecord"("reasonCode");

-- CreateIndex
CREATE INDEX "Project_descriptionCode_idx" ON "Project"("descriptionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_code_key" ON "ProjectStage"("projectId", "code");

-- CreateIndex
CREATE INDEX "Task_descriptionCode_idx" ON "Task"("descriptionCode");

-- CreateIndex
CREATE INDEX "Task_blockedReasonCode_idx" ON "Task"("blockedReasonCode");

-- CreateIndex
CREATE INDEX "TaskReassignment_reasonCode_idx" ON "TaskReassignment"("reasonCode");

-- CreateIndex
CREATE INDEX "TaskScheduleHistory_reasonCode_idx" ON "TaskScheduleHistory"("reasonCode");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_reasonCode_idx" ON "TaskStatusHistory"("reasonCode");

-- CreateIndex
CREATE INDEX "Team_descriptionCode_idx" ON "Team"("descriptionCode");

