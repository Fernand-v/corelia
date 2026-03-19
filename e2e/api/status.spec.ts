import { test, expect } from "@playwright/test";

/**
 * El statusRouter se monta en /status (sin prefijo /api/v1).
 * Pero en este proyecto de tests, el baseURL apunta a http://localhost:4000/api/v1
 * por lo que usamos rutas relativas al server root con URL absoluta.
 */

const API_ROOT = process.env.API_ROOT ?? "http://localhost:4000";

test.describe("API — Health & Status", () => {
  test("GET /status devuelve 200 y estado del sistema", async ({ request }) => {
    const res = await request.get(`${API_ROOT}/status`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("maintenance");
    expect(body).toHaveProperty("services");
    expect(body.services).toBeInstanceOf(Array);
  });

  test("GET /status/frontend-settings devuelve configuración pública", async ({ request }) => {
    const res = await request.get(`${API_ROOT}/status/frontend-settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("organizationName");
  });

  test("GET / devuelve nombre y versión de la API", async ({ request }) => {
    const res = await request.get(`${API_ROOT}/`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Corelia API");
    expect(body.version).toBe("v1");
  });

  test("Los servicios reportan su estado individual", async ({ request }) => {
    const res = await request.get(`${API_ROOT}/status`);
    const body = await res.json();

    const serviceNames = body.services.map((s: { service: string }) => s.service);
    expect(serviceNames).toContain("api");
    expect(serviceNames).toContain("postgres");
    expect(serviceNames).toContain("redis");
  });
});
