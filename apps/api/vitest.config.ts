import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/**/*.spec.ts"],
    // Los specs de DB real (*.dbtest.spec.ts) corren con vitest.db.config.ts y
    // requieren Postgres; no deben ejecutarse en la suite unitaria.
    exclude: [...configDefaults.exclude, "src/test/**/*.dbtest.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/modules/auth/service.ts",
        "src/modules/identity/service.ts",
        "src/modules/tasks/service.ts",
        "src/modules/automations/service.ts",
        "src/modules/notifications/service.ts",
        "src/modules/decisions/service.ts",
        "src/modules/objectives/service.ts",
        "src/plugins/audit.ts",
        "src/lib/rbac.ts"
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60
      }
    }
  }
});
