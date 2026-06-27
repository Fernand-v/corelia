-- AlterEnum: eventos de notificación para tickets
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_CREADO';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_ACTUALIZADO';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TICKET_COMENTARIO';

-- CreateTable
CREATE TABLE "estados_ticket" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "estados_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioridades_ticket" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "prioridades_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estadoId" INTEGER NOT NULL DEFAULT 1,
    "prioridadId" INTEGER NOT NULL DEFAULT 2,
    "assigneeId" UUID,
    "createdById" UUID NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estados_ticket_nombre_key" ON "estados_ticket"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "prioridades_ticket_nombre_key" ON "prioridades_ticket"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "Ticket_estadoId_idx" ON "Ticket"("estadoId");

-- CreateIndex
CREATE INDEX "Ticket_prioridadId_idx" ON "Ticket"("prioridadId");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_authorId_idx" ON "TicketComment"("authorId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "estados_ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_prioridadId_fkey" FOREIGN KEY ("prioridadId") REFERENCES "prioridades_ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: catálogo de estados (clave numérica, 3NF)
INSERT INTO "estados_ticket" ("id", "nombre") VALUES
    (1, 'Abierto'),
    (2, 'En proceso'),
    (3, 'Resuelto'),
    (4, 'Rechazado'),
    (5, 'Cerrado')
ON CONFLICT ("id") DO NOTHING;

-- Seed: catálogo de prioridades (clave numérica, 3NF)
INSERT INTO "prioridades_ticket" ("id", "nombre") VALUES
    (1, 'Baja'),
    (2, 'Normal'),
    (3, 'Alta'),
    (4, 'Crítica')
ON CONFLICT ("id") DO NOTHING;
