-- CreateTable
CREATE TABLE "FrontendSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "organizationName" TEXT NOT NULL,
    "taskStatusColorPending" TEXT NOT NULL,
    "taskStatusColorInReview" TEXT NOT NULL,
    "taskStatusColorCompleted" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrontendSettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row with defaults
INSERT INTO "FrontendSettings" (
  "id",
  "organizationName",
  "taskStatusColorPending",
  "taskStatusColorInReview",
  "taskStatusColorCompleted",
  "updatedAt"
)
VALUES (
  1,
  'Corelia',
  '#F59E0B',
  '#2563EB',
  '#16A34A',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
