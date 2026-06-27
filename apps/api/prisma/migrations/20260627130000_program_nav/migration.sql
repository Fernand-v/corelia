-- Navegación dinámica: metadata de menú en Program (route/icon/orden) para
-- que un administrador pueda crear programas que aparezcan en el menú sin
-- intervención de un programador.
ALTER TABLE "Program" ADD COLUMN "route" TEXT;
ALTER TABLE "Program" ADD COLUMN "icon" TEXT;
ALTER TABLE "Program" ADD COLUMN "navOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Program" ADD COLUMN "isNavItem" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Program_isNavItem_idx" ON "Program"("isNavItem");
