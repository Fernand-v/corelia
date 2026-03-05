ALTER TABLE "Task"
ADD COLUMN "startDate" TIMESTAMP(3);

CREATE INDEX "Task_startDate_idx" ON "Task"("startDate");
