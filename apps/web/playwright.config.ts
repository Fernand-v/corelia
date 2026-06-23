import { defineConfig, devices } from "@playwright/test";
import { HOCUSPOCUS_PORT, STATIC_PORT, TEST_COLLAB_SECRET } from "./e2e/config";

// E2E del transporte colaborativo (Hocuspocus + Y.js) en navegador real.
// Self-contained: levanta el servidor Hocuspocus y un servidor estático para el
// fixture; no requiere la app de Next, la API ni la base de datos.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "node ../hocuspocus/server.js",
      port: HOCUSPOCUS_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        COLLAB_AUTH_SECRET: TEST_COLLAB_SECRET,
        HOCUSPOCUS_HOST: "127.0.0.1",
        HOCUSPOCUS_PORT: String(HOCUSPOCUS_PORT),
        HOCUSPOCUS_QUIET: "true"
      }
    },
    {
      command: "node e2e/static-server.mjs",
      port: STATIC_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        STATIC_PORT: String(STATIC_PORT)
      }
    }
  ]
});
