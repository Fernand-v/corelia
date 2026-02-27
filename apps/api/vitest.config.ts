import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/modules/auth/service.ts",
        "src/modules/identity/service.ts",
        "src/modules/tasks/service.ts",
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
