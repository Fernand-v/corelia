import { test, expect } from "@playwright/test";

test.describe("Web — Rendimiento y carga", () => {
  test("La landing page carga en menos de 5 segundos", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    test.info().annotations.push({
      type: "performance",
      description: `Landing cargó en ${loadTime}ms`,
    });
  });

  test("La página de login carga en menos de 5 segundos", async ({ page }) => {
    const start = Date.now();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    test.info().annotations.push({
      type: "performance",
      description: `Login cargó en ${loadTime}ms`,
    });
  });

  test("No hay errores de consola JavaScript en landing", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    // Filtrar errores conocidos/inofensivos (ej. favicon)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("404")
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("No hay errores de consola JavaScript en login", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/login");
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("404")
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("No hay peticiones de red fallidas (5xx) en landing", async ({ page }) => {
    const serverErrors: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    expect(serverErrors).toHaveLength(0);
  });
});
