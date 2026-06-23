import { defineConfig } from "vitest/config";

// Suite de integración con base de datos REAL (Postgres). Separada de la suite
// unitaria (vitest.config.ts) para mantener los tests unitarios sin dependencia
// de Docker/DB. Requiere TEST_DATABASE_URL apuntando a una DB desechable.
//   pnpm --filter @corelia/api test:db
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/**/*.dbtest.spec.ts"],
    globalSetup: ["src/test/db/global-setup.ts"],
    // DB compartida entre archivos → ejecución serial para evitar carreras.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000
  }
});
