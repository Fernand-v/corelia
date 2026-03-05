-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskScheduleHistory" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "previousStartDate" TIMESTAMP(3),
    "previousDueDate" TIMESTAMP(3),
    "newStartDate" TIMESTAMP(3),
    "newDueDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "changedById" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskScheduleHistory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "stageId" UUID;

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_idx" ON "ProjectStage"("projectId");
CREATE INDEX "ProjectStage_projectId_order_idx" ON "ProjectStage"("projectId", "order");
CREATE UNIQUE INDEX "ProjectStage_projectId_name_key" ON "ProjectStage"("projectId", "name");

CREATE INDEX "Task_stageId_idx" ON "Task"("stageId");

CREATE INDEX "TaskScheduleHistory_taskId_idx" ON "TaskScheduleHistory"("taskId");
CREATE INDEX "TaskScheduleHistory_changedById_idx" ON "TaskScheduleHistory"("changedById");
CREATE INDEX "TaskScheduleHistory_changedAt_idx" ON "TaskScheduleHistory"("changedAt");

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskScheduleHistory" ADD CONSTRAINT "TaskScheduleHistory_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskScheduleHistory" ADD CONSTRAINT "TaskScheduleHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
