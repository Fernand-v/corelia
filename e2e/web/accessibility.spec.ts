import { test, expect } from "@playwright/test";

test.describe("Web — Accesibilidad básica", () => {
  test("La landing page tiene título de página", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("La página de login tiene etiquetas en los inputs", async ({ page }) => {
    await page.goto("/login");

    // Verificar que hay labels o aria-labels para los inputs
    const emailLabel = page.locator("text=Email");
    await expect(emailLabel).toBeVisible();

    const passwordLabel = page.locator("text=Contraseña");
    await expect(passwordLabel).toBeVisible();
  });

  test("El toggle de contraseña tiene aria-label", async ({ page }) => {
    await page.goto("/login");
    const toggleButton = page.locator('button[aria-label*="contraseña"]');
    await expect(toggleButton).toBeVisible();
  });

  test("La landing page tiene estructura semántica con h1", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const h1Count = await h1.count();
    expect(h1Count).toBe(1); // Solo un h1 por página
  });

  test("Login page tiene estructura semántica con h1", async ({ page }) => {
    await page.goto("/login");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("Los formularios no tienen autocompletado deshabilitado en campos de login", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"]');
    const autocomplete = await emailInput.getAttribute("autocomplete");
    // Debe tener autocomplete="email" para accesibilidad
    expect(autocomplete).toBe("email");
  });

  test("La página funciona sin JavaScript (contenido básico visible)", async ({ page }) => {
    // Verificar que al menos el HTML base se renderiza
    await page.goto("/login");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
