
import { test, expect } from "@playwright/test";

test.describe("API — Autenticación", () => {
  test("POST /auth/login sin credenciales devuelve error controlado", async ({ request }) => {
    const res = await request.post("/auth/login", {
      data: {},
    });
    expect([400, 401, 422]).toContain(res.status());
    expect(res.status()).not.toBe(500);
  });

  test("POST /auth/login con credenciales inválidas devuelve 401 o 400", async ({ request }) => {
    const res = await request.post("/auth/login", {
      data: { email: "noexiste@test.com", password: "wrongpass123" },
    });
    expect([400, 401]).toContain(res.status());
  });

  test("POST /auth/refresh sin token devuelve error", async ({ request }) => {
    const res = await request.post("/auth/refresh", {
      data: { refreshToken: "invalid-token" },
    });
    expect([400, 401]).toContain(res.status());
  });

  test("POST /auth/logout sin sesión devuelve error", async ({ request }) => {
    const res = await request.post("/auth/logout", {
      data: { refreshToken: "invalid-token" },
    });
    expect([400, 401]).toContain(res.status());
  });

  test("GET /auth/me sin token devuelve 401", async ({ request }) => {
    const res = await request.get("/auth/me");
    expect(res.status()).toBe(401);
  });

  test("GET /auth/memberships sin token devuelve 401", async ({ request }) => {
    const res = await request.get("/auth/memberships");
    expect(res.status()).toBe(401);
  });

  test("POST /auth/register está bloqueado (401 o 410)", async ({ request }) => {
    const res = await request.post("/auth/register", {
      data: { email: "test@test.com", password: "test123" },
    });
    // Puede devolver 410 (deshabilitado) o 401 (auth intercepta primero)
    expect([401, 410]).toContain(res.status());
  });

  test("POST /auth/change-password sin token devuelve 401", async ({ request }) => {
    const res = await request.post("/auth/change-password", {
      data: { currentPassword: "old", newPassword: "new123456" },
    });
    expect(res.status()).toBe(401);
  });
});
