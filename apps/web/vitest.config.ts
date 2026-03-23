import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  },
  test: {
    environment: "node",
    include: ["**/*.spec.ts", "**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["components/**/*.tsx", "lib/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.d.ts"],
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 50,
        branches: 40
      }
    }
  }
});
