import { defineConfig, devices } from "@playwright/test";

const API_BASE = process.env.API_URL ?? "http://localhost:4000/api/v1";
const WEB_BASE = process.env.WEB_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  use: {
    baseURL: WEB_BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "api-audit",
      testMatch: "api/**/*.spec.ts",
      use: {
        baseURL: API_BASE,
      },
    },
    {
      name: "web-audit",
      testMatch: "web/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WEB_BASE,
      },
    },
  ],
});
