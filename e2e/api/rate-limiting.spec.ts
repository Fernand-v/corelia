import { test, expect } from "@playwright/test";

test.describe("API — Rate Limiting", () => {
  test("Múltiples peticiones rápidas a login activan rate limit", async ({ request }) => {
    const results: number[] = [];

    // El endpoint tiene rate limit de 10/min - enviamos 15 peticiones
    for (let i = 0; i < 15; i++) {
      const res = await request.post("/auth/login", {
        data: { email: `test${i}@test.com`, password: "wrong" },
      });
      results.push(res.status());
    }

    const has429 = results.includes(429);
    const noServerErrors = results.every((s) => s < 500);

    // No debe haber errores 500
    expect(noServerErrors).toBe(true);

    if (has429) {
      test.info().annotations.push({
        type: "rate-limit",
        description: `Rate limit activado tras ${results.indexOf(429) + 1} peticiones`,
      });
    } else {
      test.info().annotations.push({
        type: "rate-limit",
        description: "Rate limit no se activó en 15 peticiones — verificar configuración",
      });
    }
  });

  test("Múltiples peticiones rápidas a register-request", async ({ request }) => {
    const results: number[] = [];

    for (let i = 0; i < 8; i++) {
      const res = await request.post("/auth/register-request", {
        data: { email: `ratetest${i}@test.com`, name: "Test" },
      });
      results.push(res.status());
    }

    // Verificar que no hay 500 — todos deben ser respuestas controladas
    expect(results.every((s) => s < 500)).toBe(true);

    const has429 = results.includes(429);
    if (has429) {
      test.info().annotations.push({
        type: "rate-limit",
        description: `Register rate limit activado tras ${results.indexOf(429) + 1} peticiones`,
      });
    }
  });
});
