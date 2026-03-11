-- CreateEnum
CREATE TYPE "SignupRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "SignupRequest" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "message" TEXT,
    "status" "SignupRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "decisionNote" TEXT,
    "inviteId" UUID,

    CONSTRAINT "SignupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupRequest_email_idx" ON "SignupRequest"("email");

-- CreateIndex
CREATE INDEX "SignupRequest_status_idx" ON "SignupRequest"("status");

-- CreateIndex
CREATE INDEX "SignupRequest_requestedAt_idx" ON "SignupRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "SignupRequest_reviewedById_idx" ON "SignupRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "SignupRequest_inviteId_idx" ON "SignupRequest"("inviteId");

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "InternalInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
