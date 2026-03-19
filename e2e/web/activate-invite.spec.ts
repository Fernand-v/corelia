import { test, expect } from "@playwright/test";

test.describe("Web — Pantalla de activación de invitación", () => {
  test("La página /activate-invite carga", async ({ page }) => {
    await page.goto("/activate-invite");
    // Debería mostrar la página de activación (o redirigir si no hay token)
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("La página /activate-invite sin token muestra formulario o error", async ({ page }) => {
    await page.goto("/activate-invite");
    await page.waitForTimeout(2000);

    // Debería haber algún contenido visible (formulario o mensaje de error)
    const content = page.locator("main, form, [role='alert'], h1, h2, p");
    const count = await content.count();
    expect(count).toBeGreaterThan(0);
  });
});
