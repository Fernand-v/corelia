import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const ADMIN_FIRST_NAME = process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "Admin";
const ADMIN_LAST_NAME = process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "Corelia";

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_EMAIL.includes("@")) {
    throw new Error(`BOOTSTRAP_ADMIN_EMAIL inválido: ${ADMIN_EMAIL}`);
  }

  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 8 caracteres");
  }

  const adminRole = await prisma.role.findUnique({
    where: { key: "ADMINISTRADOR" },
    select: { id: true }
  });

  if (!adminRole) {
    throw new Error("No existe el rol ADMINISTRADOR. Ejecuta primero: corepack pnpm prisma:seed");
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      passwordHash,
      baseRoleId: adminRole.id,
      isActive: true,
      deactivatedAt: null
    },
    create: {
      email: ADMIN_EMAIL,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      passwordHash,
      baseRoleId: adminRole.id,
      isActive: true
    },
    select: {
      id: true,
      email: true
    }
  });

  console.log(`Administrador listo: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
