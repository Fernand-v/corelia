import { PrismaClient } from "@prisma/client";

// Cliente Prisma dedicado a la suite DB, apuntando a TEST_DATABASE_URL (no a la
// DATABASE_URL de desarrollo). Singleton reutilizado por todos los specs.
const url = process.env.TEST_DATABASE_URL;

export const testPrisma = new PrismaClient(
  url ? { datasources: { db: { url } } } : undefined
);

/**
 * Vacía todas las tablas (excepto el historial de migraciones) reiniciando
 * identidades y cascadeando FKs. Llamar en beforeEach para aislar cada test.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await testPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await testPrisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE;`);
}
