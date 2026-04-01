import { test, expect } from "@playwright/test";

test.describe("Web — Página principal (landing)", () => {
  test("La landing page carga correctamente", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/intranet colaborativa|corelia/i);
  });

  test("Muestra el nombre de la organización", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("Tiene enlace a login", async ({ page }) => {
    await page.goto("/");
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveText(/iniciar sesión/i);
  });

  test("Tiene enlace a tareas", async ({ page }) => {
    await page.goto("/");
    const tasksLink = page.locator('a[href="/tasks"]');
    await expect(tasksLink).toBeVisible();
  });

  test("Tiene enlace a reuniones", async ({ page }) => {
    await page.goto("/");
    const meetingsLink = page.locator('a[href="/meetings"]');
    await expect(meetingsLink).toBeVisible();
  });

  test("Navegación a /login funciona desde landing", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/\/login/);
  });
});
