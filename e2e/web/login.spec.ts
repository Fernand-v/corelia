import { test, expect } from "@playwright/test";

test.describe("Web — Pantalla de Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("La página de login carga correctamente", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toHaveText(/iniciar sesión/i);
  });

  test("Muestra campo de email", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeEnabled();
  });

  test("Muestra campo de contraseña", async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toBeEnabled();
  });

  test("Muestra botón de submit", async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText(/entrar/i);
  });

  test("Toggle de mostrar/ocultar contraseña funciona", async ({ page }) => {
    const passwordInput = page.locator("input").nth(1); // segundo input
    const toggleButton = page.locator('button[aria-label*="contraseña"]');

    // Inicialmente es tipo password
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click en toggle
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click de nuevo
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("Validación de formulario: email vacío muestra error", async ({ page }) => {
    await page.locator('input[type="email"]').fill("");
    await page.locator('input[type="password"]').fill("somepassword");
    await page.locator('button[type="submit"]').click();

    // Debería mostrar un error de validación
    const errorMessage = page.locator(".text-red-500");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test("Validación de formulario: password vacío muestra error", async ({ page }) => {
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('button[type="submit"]').click();

    const errorMessage = page.locator(".text-red-500");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test("Login con credenciales inválidas muestra error del servidor", async ({ page }) => {
    await page.locator('input[type="email"]').fill("noexiste@ejemplo.com");
    await page.locator('input[type="password"]').fill("contraseñamala123");
    await page.locator('button[type="submit"]').click();

    // Esperar la respuesta del API y el mensaje de error
    const errorBox = page.locator(".bg-red-50\\/80, .bg-red-50");
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
  });

  test("Botón se deshabilita durante el envío", async ({ page }) => {
    await page.locator('input[type="email"]').fill("test@test.com");
    await page.locator('input[type="password"]').fill("password123");

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Brevemente debería mostrar "Entrando…" y estar deshabilitado
    await expect(submitButton).toHaveText(/entrando/i);
  });
});
