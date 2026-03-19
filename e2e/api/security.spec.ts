import { test, expect } from "@playwright/test";

const API_ROOT = process.env.API_ROOT ?? "http://localhost:4000";

test.describe("API — Seguridad y cabeceras", () => {
  test("Las respuestas no exponen x-powered-by", async ({ request }) => {
    const res = await request.get(`${API_ROOT}/status`);
    const headers = res.headers();
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("Rutas inexistentes no causan error 500", async ({ request }) => {
    const res = await request.get("/ruta-que-no-existe-12345");
    // Puede devolver 401 (auth intercepta) o 404
    expect([401, 404]).toContain(res.status());
    expect(res.status()).not.toBe(500);
  });

  test("SQL injection en login es rechazado", async ({ request }) => {
    const res = await request.post("/auth/login", {
      data: {
        email: "' OR 1=1 --",
        password: "' OR 1=1 --",
      },
    });
    expect([400, 401, 422]).toContain(res.status());
    expect(res.status()).not.toBe(200);
    expect(res.status()).not.toBe(500);
  });

  test("XSS en búsqueda no causa error 500", async ({ request }) => {
    const res = await request.get("/search?q=<script>alert(1)</script>");
    // Sin auth debería dar 401, no 500
    expect(res.status()).not.toBe(500);
  });

  test("Token JWT malformado devuelve 401", async ({ request }) => {
    const res = await request.get("/auth/me", {
      headers: { Authorization: "Bearer not.a.valid.jwt.token" },
    });
    expect(res.status()).toBe(401);
  });

  test("Header Authorization vacío devuelve 401", async ({ request }) => {
    const res = await request.get("/auth/me", {
      headers: { Authorization: "" },
    });
    expect(res.status()).toBe(401);
  });

  test("Body excesivamente grande es rechazado (no causa 500)", async ({ request }) => {
    const largeBody = "x".repeat(2 * 1024 * 1024); // 2MB
    const res = await request.post("/auth/login", {
      data: { email: largeBody, password: "test" },
    });
    // Debería rechazar con 400, 413 o 422, NO 500
    expect(res.status()).not.toBe(500);
    expect(res.status()).not.toBe(200);
  });

  test("Content-Type incorrecto es manejado", async ({ request }) => {
    const res = await request.post("/auth/login", {
      headers: { "Content-Type": "text/plain" },
      data: "not json",
    });
    expect(res.status()).not.toBe(500);
  });
});
