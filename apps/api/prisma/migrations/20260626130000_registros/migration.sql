-- CreateTable
CREATE TABLE "Empresa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" SERIAL NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "fax" TEXT,
    "localidad" TEXT,
    "ruc" TEXT,
    "dv" TEXT,
    "nroInscripcionIps" TEXT,
    "nroInscripcionBnt" TEXT,
    "explotacion" TEXT,
    "nombreContador" TEXT,
    "rucContador" TEXT,
    "nombreRepresentante" TEXT,
    "rucRepresentante" TEXT,
    "descripcionFactura" TEXT,
    "urlReports" TEXT,
    "logoUrl" TEXT,
    "esExportador" BOOLEAN NOT NULL DEFAULT false,
    "esExterna" BOOLEAN NOT NULL DEFAULT false,
    "facturadorElectronico" BOOLEAN NOT NULL DEFAULT false,
    "habilitada" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresaId" UUID NOT NULL,
    "codigo" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "fax" TEXT,
    "localidad" TEXT,
    "departamento" TEXT,
    "ruc" TEXT,
    "abreviatura" TEXT,
    "esCasaCentral" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "nacionalidad" TEXT,

    CONSTRAINT "Pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ciudad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisId" UUID NOT NULL,

    CONSTRAINT "Ciudad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sexo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "Sexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" SERIAL NOT NULL,
    "empresaId" UUID NOT NULL,
    "tipoDocumento" INTEGER NOT NULL DEFAULT 1,
    "ruc" TEXT NOT NULL,
    "dv" TEXT,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "propietario" TEXT,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT,
    "barrio" TEXT,
    "paisId" UUID,
    "ciudadId" UUID,
    "sexoId" UUID,
    "telefono" TEXT NOT NULL,
    "celular" TEXT,
    "email" TEXT,
    "personaContacto" TEXT,
    "fechaAniversario" TIMESTAMP(3),
    "esPep" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_codigo_key" ON "Empresa"("codigo");

-- CreateIndex
CREATE INDEX "Sucursal_empresaId_idx" ON "Sucursal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_empresaId_codigo_key" ON "Sucursal"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Pais_codigo_key" ON "Pais"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Ciudad_codigo_key" ON "Ciudad"("codigo");

-- CreateIndex
CREATE INDEX "Ciudad_paisId_idx" ON "Ciudad"("paisId");

-- CreateIndex
CREATE UNIQUE INDEX "Sexo_codigo_key" ON "Sexo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_codigo_key" ON "Persona"("codigo");

-- CreateIndex
CREATE INDEX "Persona_empresaId_idx" ON "Persona"("empresaId");

-- CreateIndex
CREATE INDEX "Persona_paisId_idx" ON "Persona"("paisId");

-- CreateIndex
CREATE INDEX "Persona_ciudadId_idx" ON "Persona"("ciudadId");

-- CreateIndex
CREATE INDEX "Persona_sexoId_idx" ON "Persona"("sexoId");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_empresaId_ruc_key" ON "Persona"("empresaId", "ruc");

-- AddForeignKey
ALTER TABLE "Ciudad" ADD CONSTRAINT "Ciudad_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_ciudadId_fkey" FOREIGN KEY ("ciudadId") REFERENCES "Ciudad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_sexoId_fkey" FOREIGN KEY ("sexoId") REFERENCES "Sexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: catálogo de sexo (M=Masculino, F=Femenino, X=No binario / Otro)
INSERT INTO "Sexo" ("id", "codigo", "descripcion") VALUES
    (gen_random_uuid(), 'M', 'Masculino'),
    (gen_random_uuid(), 'F', 'Femenino'),
    (gen_random_uuid(), 'X', 'No binario / Otro')
ON CONFLICT ("codigo") DO NOTHING;
