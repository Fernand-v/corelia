-- CreateTable
CREATE TABLE "InternalInvite" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "baseRole" "SystemRole" NOT NULL,
    "teamId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resentAt" TIMESTAMP(3),

    CONSTRAINT "InternalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalInvite_tokenHash_key" ON "InternalInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "InternalInvite_email_idx" ON "InternalInvite"("email");

-- CreateIndex
CREATE INDEX "InternalInvite_expiresAt_idx" ON "InternalInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "InternalInvite_createdById_idx" ON "InternalInvite"("createdById");

-- CreateIndex
CREATE INDEX "InternalInvite_teamId_idx" ON "InternalInvite"("teamId");

-- AddForeignKey
ALTER TABLE "InternalInvite" ADD CONSTRAINT "InternalInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalInvite" ADD CONSTRAINT "InternalInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
