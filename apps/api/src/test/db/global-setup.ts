import { execFileSync } from "node:child_process";

// globalSetup de la suite DB: aplica las migraciones Prisma sobre la base de
// datos de pruebas antes de ejecutar ningún test. Falla rápido si falta la URL.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL no está definido. Levanta la DB de pruebas (docker compose -f docker/docker-compose.test.yml up -d) y exporta TEST_DATABASE_URL."
    );
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url }
  });
}
