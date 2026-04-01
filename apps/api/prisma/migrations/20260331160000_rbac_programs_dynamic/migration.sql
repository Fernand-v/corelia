-- CreateTable
CREATE TABLE "Program" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (needed before ON CONFLICT ("key"))
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateIndex (needed before ON CONFLICT ("key"))
CREATE UNIQUE INDEX "Program_key_key" ON "Program"("key");

-- AlterTable
ALTER TABLE "Permission"
    ADD COLUMN "programId" UUID,
    ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Seed initial system programs
INSERT INTO "Program" ("id", "key", "displayName", "description", "sortOrder", "isSystem", "isActive", "updatedAt") VALUES
('9f000000-0000-4000-8000-000000000001', 'ADMINISTRACION', 'Administracion', NULL, 0, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000002', 'IDENTIDAD', 'Identidad', NULL, 1, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000003', 'PROYECTOS', 'Proyectos', NULL, 2, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000004', 'TAREAS', 'Tareas', NULL, 3, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000005', 'CALENDARIO', 'Calendario', NULL, 4, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000006', 'REUNIONES', 'Reuniones', NULL, 5, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000007', 'MENSAJERIA', 'Mensajeria', NULL, 6, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000008', 'NOTIFICACIONES', 'Notificaciones', NULL, 7, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000009', 'ARCHIVOS', 'Archivos', NULL, 8, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-00000000000a', 'ANUNCIOS', 'Anuncios', NULL, 9, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-00000000000b', 'FORMULARIOS', 'Formularios', NULL, 10, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-00000000000c', 'OBJETIVOS', 'Objetivos', NULL, 11, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-00000000000d', 'AUTOMATIZACIONES', 'Automatizaciones', NULL, 12, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-00000000000e', 'AUDITORIA', 'Auditoria', NULL, 13, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-00000000000f', 'PRESUPUESTO', 'Presupuesto', NULL, 14, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000010', 'DOCUMENTOS', 'Documentos', NULL, 15, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000011', 'REPORTES', 'Reportes', NULL, 16, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000012', 'BUSQUEDA', 'Busqueda', NULL, 17, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000013', 'DECISIONES', 'Decisiones', NULL, 18, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000014', 'INTEGRACIONES', 'Integraciones', NULL, 19, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000015', 'IMPORTACIONES', 'Importaciones', NULL, 20, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000016', 'DISPONIBILIDAD', 'Disponibilidad', NULL, 21, true, true, CURRENT_TIMESTAMP),
('9f000000-0000-4000-8000-000000000017', 'TIEMPO', 'Tiempo', NULL, 22, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Backfill existing permissions to system programs according to category
UPDATE "Permission" AS p
SET "programId" = pr."id"
FROM "PermissionCategory" AS pc
JOIN "Program" AS pr
  ON pr."key" = CASE pc."key"
    WHEN 'USUARIO' THEN 'IDENTIDAD'
    WHEN 'PROYECTO' THEN 'PROYECTOS'
    WHEN 'TAREA' THEN 'TAREAS'
    WHEN 'CALENDARIO' THEN 'CALENDARIO'
    WHEN 'REUNION' THEN 'REUNIONES'
    WHEN 'MENSAJE' THEN 'MENSAJERIA'
    WHEN 'NOTIFICACION' THEN 'NOTIFICACIONES'
    WHEN 'ARCHIVO' THEN 'ARCHIVOS'
    WHEN 'ANUNCIO' THEN 'ANUNCIOS'
    WHEN 'SOLICITUD' THEN 'FORMULARIOS'
    WHEN 'OBJETIVO' THEN 'OBJETIVOS'
    WHEN 'AUTOMATIZACION' THEN 'AUTOMATIZACIONES'
    WHEN 'AUDITORIA' THEN 'AUDITORIA'
    WHEN 'PRESUPUESTO' THEN 'PRESUPUESTO'
    ELSE NULL
  END
WHERE p."categoryId" = pc."id"
  AND p."programId" IS NULL;

-- Existing permissions are treated as system permissions
UPDATE "Permission"
SET "isSystem" = true
WHERE "isSystem" = false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Permission" WHERE "programId" IS NULL) THEN
    RAISE EXCEPTION 'No se pudo mapear programId para todos los permisos existentes';
  END IF;
END $$;

ALTER TABLE "Permission"
    ALTER COLUMN "programId" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProgramRole" (
    "programId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramRole_pkey" PRIMARY KEY ("programId","roleId")
);

-- Backfill role-program links from role-permission links
INSERT INTO "ProgramRole" ("programId", "roleId", "createdAt")
SELECT DISTINCT p."programId", rp."roleId", CURRENT_TIMESTAMP
FROM "RolePermission" AS rp
JOIN "Permission" AS p ON p."id" = rp."permissionId"
ON CONFLICT ("programId", "roleId") DO NOTHING;

-- Admin gets all active programs by default
INSERT INTO "ProgramRole" ("programId", "roleId", "createdAt")
SELECT p."id", r."id", CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "Program" AS p
WHERE r."key" = 'ADMINISTRADOR'
  AND p."isActive" = true
ON CONFLICT ("programId", "roleId") DO NOTHING;

-- CreateIndex
CREATE INDEX "Program_sortOrder_idx" ON "Program"("sortOrder");

-- CreateIndex
CREATE INDEX "Program_isActive_idx" ON "Program"("isActive");

-- CreateIndex
CREATE INDEX "Permission_programId_idx" ON "Permission"("programId");

-- CreateIndex
CREATE INDEX "Permission_isActive_idx" ON "Permission"("isActive");

-- CreateIndex
CREATE INDEX "ProgramRole_roleId_idx" ON "ProgramRole"("roleId");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRole" ADD CONSTRAINT "ProgramRole_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRole" ADD CONSTRAINT "ProgramRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
