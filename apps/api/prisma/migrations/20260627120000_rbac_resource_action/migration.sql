-- RBAC normalizado: recurso y accion como entidades de primera clase (tipo Program).
-- Deriva Resource/Action desde la key canonica `${recurso}_${accion}` de los permisos existentes.

-- Defensa: limpia artefactos de una version previa basada en columnas string.
DROP INDEX IF EXISTS "Permission_resource_action_key";
DROP INDEX IF EXISTS "Permission_resource_idx";
ALTER TABLE "Permission" DROP COLUMN IF EXISTS "resource";
ALTER TABLE "Permission" DROP COLUMN IF EXISTS "action";

CREATE TABLE "Resource" (
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

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Action" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'write',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Resource_code_key" ON "Resource"("code");
CREATE UNIQUE INDEX "Resource_key_key" ON "Resource"("key");
CREATE INDEX "Resource_sortOrder_idx" ON "Resource"("sortOrder");
CREATE INDEX "Resource_isActive_idx" ON "Resource"("isActive");
CREATE UNIQUE INDEX "Action_code_key" ON "Action"("code");
CREATE UNIQUE INDEX "Action_key_key" ON "Action"("key");
CREATE INDEX "Action_sortOrder_idx" ON "Action"("sortOrder");
CREATE INDEX "Action_isActive_idx" ON "Action"("isActive");

-- Derivacion temporal de recurso/accion desde la key.
ALTER TABLE "Permission" ADD COLUMN "_res" TEXT;
ALTER TABLE "Permission" ADD COLUMN "_act" TEXT;
UPDATE "Permission"
  SET "_act" = 'CAMBIAR_ESTADO', "_res" = left("key", length("key") - 15)
  WHERE "_act" IS NULL AND right("key", 15) = '_CAMBIAR_ESTADO';
UPDATE "Permission"
  SET "_act" = 'REASIGNAR', "_res" = left("key", length("key") - 10)
  WHERE "_act" IS NULL AND right("key", 10) = '_REASIGNAR';
UPDATE "Permission"
  SET "_act" = 'GESTIONAR', "_res" = left("key", length("key") - 10)
  WHERE "_act" IS NULL AND right("key", 10) = '_GESTIONAR';
UPDATE "Permission"
  SET "_act" = 'ESCRIBIR', "_res" = left("key", length("key") - 9)
  WHERE "_act" IS NULL AND right("key", 9) = '_ESCRIBIR';
UPDATE "Permission"
  SET "_act" = 'PUBLICAR', "_res" = left("key", length("key") - 9)
  WHERE "_act" IS NULL AND right("key", 9) = '_PUBLICAR';
UPDATE "Permission"
  SET "_act" = 'COMENTAR', "_res" = left("key", length("key") - 9)
  WHERE "_act" IS NULL AND right("key", 9) = '_COMENTAR';
UPDATE "Permission"
  SET "_act" = 'ASIGNAR', "_res" = left("key", length("key") - 8)
  WHERE "_act" IS NULL AND right("key", 8) = '_ASIGNAR';
UPDATE "Permission"
  SET "_act" = 'APROBAR', "_res" = left("key", length("key") - 8)
  WHERE "_act" IS NULL AND right("key", 8) = '_APROBAR';
UPDATE "Permission"
  SET "_act" = 'CREAR', "_res" = left("key", length("key") - 6)
  WHERE "_act" IS NULL AND right("key", 6) = '_CREAR';
UPDATE "Permission"
  SET "_act" = 'SUBIR', "_res" = left("key", length("key") - 6)
  WHERE "_act" IS NULL AND right("key", 6) = '_SUBIR';
UPDATE "Permission"
  SET "_act" = 'LEER', "_res" = left("key", length("key") - 5)
  WHERE "_act" IS NULL AND right("key", 5) = '_LEER';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Permission" WHERE "_res" IS NULL OR "_act" IS NULL) THEN
    RAISE EXCEPTION 'Permisos sin recurso/accion derivable';
  END IF;
END $$;

-- Pobla Resource/Action distinct (displayName = key; el seed corrige nombres/orden de los del sistema).
INSERT INTO "Resource" ("id", "key", "displayName", "isSystem", "isActive", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), d.res, d.res, true, true,
       (row_number() OVER (ORDER BY d.res))::int - 1, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "_res" AS res FROM "Permission") d;

INSERT INTO "Action" ("id", "key", "displayName", "kind", "isSystem", "isActive", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), d.act, d.act,
       CASE WHEN d.act = 'LEER' THEN 'read' ELSE 'write' END,
       true, true, (row_number() OVER (ORDER BY d.act))::int - 1, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "_act" AS act FROM "Permission") d;

-- FK columns.
ALTER TABLE "Permission" ADD COLUMN "resourceId" UUID;
ALTER TABLE "Permission" ADD COLUMN "actionId" UUID;
UPDATE "Permission" p SET "resourceId" = r."id" FROM "Resource" r WHERE r."key" = p."_res";
UPDATE "Permission" p SET "actionId" = a."id" FROM "Action" a WHERE a."key" = p."_act";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Permission" WHERE "resourceId" IS NULL OR "actionId" IS NULL) THEN
    RAISE EXCEPTION 'Permisos sin FK de recurso/accion';
  END IF;
END $$;

ALTER TABLE "Permission" ALTER COLUMN "resourceId" SET NOT NULL;
ALTER TABLE "Permission" ALTER COLUMN "actionId" SET NOT NULL;
ALTER TABLE "Permission" DROP COLUMN "_res";
ALTER TABLE "Permission" DROP COLUMN "_act";

CREATE UNIQUE INDEX "Permission_resourceId_actionId_key" ON "Permission"("resourceId", "actionId");
CREATE INDEX "Permission_resourceId_idx" ON "Permission"("resourceId");
CREATE INDEX "Permission_actionId_idx" ON "Permission"("actionId");

ALTER TABLE "Permission" ADD CONSTRAINT "Permission_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
