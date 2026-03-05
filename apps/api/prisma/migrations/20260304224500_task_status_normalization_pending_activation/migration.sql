-- Add pending activation column for hybrid visibility in "Mis tareas"
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "pendingActivatedAt" TIMESTAMP(3);

-- Preserve legacy status text before enum normalization
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "__legacyStatusText" TEXT;

UPDATE "Task"
SET "__legacyStatusText" = "status"::text
WHERE "__legacyStatusText" IS NULL;

ALTER TABLE "TaskStatusHistory"
ADD COLUMN IF NOT EXISTS "__legacyFromStatusText" TEXT;

ALTER TABLE "TaskStatusHistory"
ADD COLUMN IF NOT EXISTS "__legacyToStatusText" TEXT;

UPDATE "TaskStatusHistory"
SET "__legacyFromStatusText" = "fromStatus"::text
WHERE "__legacyFromStatusText" IS NULL;

UPDATE "TaskStatusHistory"
SET "__legacyToStatusText" = "toStatus"::text
WHERE "__legacyToStatusText" IS NULL;

-- Normalize TaskStatus enum to 3-state model
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'COMPLETADA');

ALTER TABLE "Task"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "TaskStatus"
USING (
  CASE
    WHEN "__legacyStatusText" IN ('BACKLOG', 'PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA') THEN 'PENDIENTE'
    WHEN "__legacyStatusText" = 'EN_REVISION' THEN 'EN_REVISION'
    ELSE 'COMPLETADA'
  END
)::"TaskStatus",
ALTER COLUMN "status" SET DEFAULT 'PENDIENTE';

ALTER TABLE "TaskStatusHistory"
ALTER COLUMN "fromStatus" TYPE "TaskStatus"
USING (
  CASE
    WHEN "__legacyFromStatusText" IS NULL THEN NULL
    WHEN "__legacyFromStatusText" IN ('BACKLOG', 'PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA') THEN 'PENDIENTE'
    WHEN "__legacyFromStatusText" = 'EN_REVISION' THEN 'EN_REVISION'
    ELSE 'COMPLETADA'
  END
)::"TaskStatus";

ALTER TABLE "TaskStatusHistory"
ALTER COLUMN "toStatus" TYPE "TaskStatus"
USING (
  CASE
    WHEN "__legacyToStatusText" IN ('BACKLOG', 'PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA') THEN 'PENDIENTE'
    WHEN "__legacyToStatusText" = 'EN_REVISION' THEN 'EN_REVISION'
    ELSE 'COMPLETADA'
  END
)::"TaskStatus";

DROP TYPE "TaskStatus_old";

-- Backfill pending activation timestamp to preserve active visibility
UPDATE "Task"
SET "pendingActivatedAt" = CASE
  WHEN "status" = 'COMPLETADA' THEN COALESCE("completedAt", "updatedAt", "createdAt")
  WHEN "status" = 'EN_REVISION' THEN COALESCE("updatedAt", "createdAt")
  WHEN "startDate" IS NULL OR "startDate" <= NOW() THEN COALESCE("startDate", "updatedAt", "createdAt")
  ELSE NULL
END
WHERE "pendingActivatedAt" IS NULL;

-- Trace CANCELADA -> COMPLETADA migrations in status history
INSERT INTO "TaskStatusHistory" (
  "id",
  "taskId",
  "fromStatus",
  "toStatus",
  "reason",
  "reasonCode",
  "changedById",
  "changedAt"
)
SELECT
  (
    substr(md5(random()::text || "id"), 1, 8) || '-' ||
    substr(md5(random()::text || "id"), 9, 4) || '-' ||
    substr(md5(random()::text || "id"), 13, 4) || '-' ||
    substr(md5(random()::text || "id"), 17, 4) || '-' ||
    substr(md5(random()::text || "id"), 21, 12)
  )::uuid,
  "id",
  'COMPLETADA'::"TaskStatus",
  'COMPLETADA'::"TaskStatus",
  'Migración legacy: estado CANCELADA normalizado a COMPLETADA',
  'MIGRACION_LEGACY_CANCELADA',
  "createdById",
  COALESCE("updatedAt", "createdAt")
FROM "Task"
WHERE "__legacyStatusText" = 'CANCELADA';

ALTER TABLE "Task"
DROP COLUMN "__legacyStatusText";

ALTER TABLE "TaskStatusHistory"
DROP COLUMN "__legacyFromStatusText",
DROP COLUMN "__legacyToStatusText";

CREATE INDEX IF NOT EXISTS "Task_pendingActivatedAt_idx" ON "Task"("pendingActivatedAt");
