-- 3FN hardening: remove generic polymorphic references from DecisionNote and AuditLog.

-- Add target columns first so we can backfill from legacy entityType/entityId.
ALTER TABLE "AuditLog"
  ADD COLUMN "targetAnnouncementId" UUID,
  ADD COLUMN "targetAutomationRuleId" UUID,
  ADD COLUMN "targetDecisionId" UUID,
  ADD COLUMN "targetExpenseId" UUID,
  ADD COLUMN "targetFileId" UUID,
  ADD COLUMN "targetFormRequestId" UUID,
  ADD COLUMN "targetMeetingAgreementId" UUID,
  ADD COLUMN "targetMeetingId" UUID,
  ADD COLUMN "targetMessageId" UUID,
  ADD COLUMN "targetObjectiveId" UUID,
  ADD COLUMN "targetProjectId" UUID,
  ADD COLUMN "targetTaskId" UUID,
  ADD COLUMN "targetUserId" UUID;

ALTER TABLE "DecisionNote"
  ADD COLUMN "linkedAnnouncementId" UUID,
  ADD COLUMN "linkedAutomationRuleId" UUID,
  ADD COLUMN "linkedDecisionId" UUID,
  ADD COLUMN "linkedExpenseId" UUID,
  ADD COLUMN "linkedFileId" UUID,
  ADD COLUMN "linkedFormRequestId" UUID,
  ADD COLUMN "linkedMeetingAgreementId" UUID,
  ADD COLUMN "linkedMeetingId" UUID,
  ADD COLUMN "linkedMessageId" UUID,
  ADD COLUMN "linkedObjectiveId" UUID,
  ADD COLUMN "linkedProjectId" UUID,
  ADD COLUMN "linkedTaskId" UUID,
  ADD COLUMN "linkedUserId" UUID;

-- Backfill DecisionNote target FKs from legacy polymorphic columns.
UPDATE "DecisionNote" SET "linkedUserId" = "linkedEntityId" WHERE "linkedEntityType" = 'USUARIO';
UPDATE "DecisionNote" SET "linkedProjectId" = "linkedEntityId" WHERE "linkedEntityType" = 'PROYECTO';
UPDATE "DecisionNote" SET "linkedTaskId" = "linkedEntityId" WHERE "linkedEntityType" = 'TAREA';
UPDATE "DecisionNote" SET "linkedMeetingId" = "linkedEntityId" WHERE "linkedEntityType" = 'REUNION';
UPDATE "DecisionNote" SET "linkedMeetingAgreementId" = "linkedEntityId" WHERE "linkedEntityType" = 'ACUERDO_REUNION';
UPDATE "DecisionNote" SET "linkedMessageId" = "linkedEntityId" WHERE "linkedEntityType" = 'MENSAJE';
UPDATE "DecisionNote" SET "linkedFileId" = "linkedEntityId" WHERE "linkedEntityType" = 'ARCHIVO';
UPDATE "DecisionNote" SET "linkedFormRequestId" = "linkedEntityId" WHERE "linkedEntityType" = 'SOLICITUD';
UPDATE "DecisionNote" SET "linkedAnnouncementId" = "linkedEntityId" WHERE "linkedEntityType" = 'ANUNCIO';
UPDATE "DecisionNote" SET "linkedObjectiveId" = "linkedEntityId" WHERE "linkedEntityType" = 'OBJETIVO';
UPDATE "DecisionNote" SET "linkedDecisionId" = "linkedEntityId" WHERE "linkedEntityType" = 'DECISION';
UPDATE "DecisionNote" SET "linkedAutomationRuleId" = "linkedEntityId" WHERE "linkedEntityType" = 'AUTOMATIZACION';
UPDATE "DecisionNote" SET "linkedExpenseId" = "linkedEntityId" WHERE "linkedEntityType" = 'GASTO';

-- Backfill AuditLog target FKs from legacy polymorphic columns.
UPDATE "AuditLog" SET "targetUserId" = "entityId" WHERE "entityType" = 'USUARIO';
UPDATE "AuditLog" SET "targetProjectId" = "entityId" WHERE "entityType" = 'PROYECTO';
UPDATE "AuditLog" SET "targetTaskId" = "entityId" WHERE "entityType" = 'TAREA';
UPDATE "AuditLog" SET "targetMeetingId" = "entityId" WHERE "entityType" = 'REUNION';
UPDATE "AuditLog" SET "targetMeetingAgreementId" = "entityId" WHERE "entityType" = 'ACUERDO_REUNION';
UPDATE "AuditLog" SET "targetMessageId" = "entityId" WHERE "entityType" = 'MENSAJE';
UPDATE "AuditLog" SET "targetFileId" = "entityId" WHERE "entityType" = 'ARCHIVO';
UPDATE "AuditLog" SET "targetFormRequestId" = "entityId" WHERE "entityType" = 'SOLICITUD';
UPDATE "AuditLog" SET "targetAnnouncementId" = "entityId" WHERE "entityType" = 'ANUNCIO';
UPDATE "AuditLog" SET "targetObjectiveId" = "entityId" WHERE "entityType" = 'OBJETIVO';
UPDATE "AuditLog" SET "targetDecisionId" = "entityId" WHERE "entityType" = 'DECISION';
UPDATE "AuditLog" SET "targetAutomationRuleId" = "entityId" WHERE "entityType" = 'AUTOMATIZACION';
UPDATE "AuditLog" SET "targetExpenseId" = "entityId" WHERE "entityType" = 'GASTO';

-- Drop legacy indexes and columns.
DROP INDEX "AuditLog_entityType_entityId_idx";
DROP INDEX "DecisionNote_linkedEntityType_linkedEntityId_idx";

ALTER TABLE "AuditLog"
  DROP COLUMN "entityId",
  DROP COLUMN "entityType";

ALTER TABLE "DecisionNote"
  DROP COLUMN "linkedEntityId",
  DROP COLUMN "linkedEntityType";

DROP TYPE "EntityType";

-- Add per-target indexes.
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");
CREATE INDEX "AuditLog_targetProjectId_idx" ON "AuditLog"("targetProjectId");
CREATE INDEX "AuditLog_targetTaskId_idx" ON "AuditLog"("targetTaskId");
CREATE INDEX "AuditLog_targetMeetingId_idx" ON "AuditLog"("targetMeetingId");
CREATE INDEX "AuditLog_targetMeetingAgreementId_idx" ON "AuditLog"("targetMeetingAgreementId");
CREATE INDEX "AuditLog_targetMessageId_idx" ON "AuditLog"("targetMessageId");
CREATE INDEX "AuditLog_targetFileId_idx" ON "AuditLog"("targetFileId");
CREATE INDEX "AuditLog_targetFormRequestId_idx" ON "AuditLog"("targetFormRequestId");
CREATE INDEX "AuditLog_targetAnnouncementId_idx" ON "AuditLog"("targetAnnouncementId");
CREATE INDEX "AuditLog_targetObjectiveId_idx" ON "AuditLog"("targetObjectiveId");
CREATE INDEX "AuditLog_targetDecisionId_idx" ON "AuditLog"("targetDecisionId");
CREATE INDEX "AuditLog_targetAutomationRuleId_idx" ON "AuditLog"("targetAutomationRuleId");
CREATE INDEX "AuditLog_targetExpenseId_idx" ON "AuditLog"("targetExpenseId");

CREATE INDEX "DecisionNote_linkedUserId_idx" ON "DecisionNote"("linkedUserId");
CREATE INDEX "DecisionNote_linkedProjectId_idx" ON "DecisionNote"("linkedProjectId");
CREATE INDEX "DecisionNote_linkedTaskId_idx" ON "DecisionNote"("linkedTaskId");
CREATE INDEX "DecisionNote_linkedMeetingId_idx" ON "DecisionNote"("linkedMeetingId");
CREATE INDEX "DecisionNote_linkedMeetingAgreementId_idx" ON "DecisionNote"("linkedMeetingAgreementId");
CREATE INDEX "DecisionNote_linkedMessageId_idx" ON "DecisionNote"("linkedMessageId");
CREATE INDEX "DecisionNote_linkedFileId_idx" ON "DecisionNote"("linkedFileId");
CREATE INDEX "DecisionNote_linkedFormRequestId_idx" ON "DecisionNote"("linkedFormRequestId");
CREATE INDEX "DecisionNote_linkedAnnouncementId_idx" ON "DecisionNote"("linkedAnnouncementId");
CREATE INDEX "DecisionNote_linkedObjectiveId_idx" ON "DecisionNote"("linkedObjectiveId");
CREATE INDEX "DecisionNote_linkedDecisionId_idx" ON "DecisionNote"("linkedDecisionId");
CREATE INDEX "DecisionNote_linkedAutomationRuleId_idx" ON "DecisionNote"("linkedAutomationRuleId");
CREATE INDEX "DecisionNote_linkedExpenseId_idx" ON "DecisionNote"("linkedExpenseId");

-- Add explicit FKs for each target.
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedProjectId_fkey" FOREIGN KEY ("linkedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedMeetingId_fkey" FOREIGN KEY ("linkedMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedMeetingAgreementId_fkey" FOREIGN KEY ("linkedMeetingAgreementId") REFERENCES "MeetingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedMessageId_fkey" FOREIGN KEY ("linkedMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedFileId_fkey" FOREIGN KEY ("linkedFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedFormRequestId_fkey" FOREIGN KEY ("linkedFormRequestId") REFERENCES "FormRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedAnnouncementId_fkey" FOREIGN KEY ("linkedAnnouncementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedObjectiveId_fkey" FOREIGN KEY ("linkedObjectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedDecisionId_fkey" FOREIGN KEY ("linkedDecisionId") REFERENCES "DecisionNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedAutomationRuleId_fkey" FOREIGN KEY ("linkedAutomationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionNote" ADD CONSTRAINT "DecisionNote_linkedExpenseId_fkey" FOREIGN KEY ("linkedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetTaskId_fkey" FOREIGN KEY ("targetTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetMeetingId_fkey" FOREIGN KEY ("targetMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetMeetingAgreementId_fkey" FOREIGN KEY ("targetMeetingAgreementId") REFERENCES "MeetingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetFileId_fkey" FOREIGN KEY ("targetFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetFormRequestId_fkey" FOREIGN KEY ("targetFormRequestId") REFERENCES "FormRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetAnnouncementId_fkey" FOREIGN KEY ("targetAnnouncementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetObjectiveId_fkey" FOREIGN KEY ("targetObjectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetDecisionId_fkey" FOREIGN KEY ("targetDecisionId") REFERENCES "DecisionNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetAutomationRuleId_fkey" FOREIGN KEY ("targetAutomationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetExpenseId_fkey" FOREIGN KEY ("targetExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce single-target semantics at DB level.
ALTER TABLE "DecisionNote"
  ADD CONSTRAINT "DecisionNote_single_link_target_chk"
  CHECK (
    (CASE WHEN "linkedUserId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedProjectId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedTaskId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedMeetingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedMeetingAgreementId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedMessageId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedFileId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedFormRequestId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedAnnouncementId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedObjectiveId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedDecisionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedAutomationRuleId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "linkedExpenseId" IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  );

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_single_target_chk"
  CHECK (
    (CASE WHEN "targetUserId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetProjectId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetTaskId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetMeetingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetMeetingAgreementId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetMessageId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetFileId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetFormRequestId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetAnnouncementId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetObjectiveId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetDecisionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetAutomationRuleId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "targetExpenseId" IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  );
