import { test, expect } from "@playwright/test";

/**
 * Verifica que todas las rutas del dashboard redirigen al login
 * cuando no hay sesión activa.
 */

const dashboardRoutes = [
  { path: "/home", name: "Home" },
  { path: "/projects", name: "Proyectos" },
  { path: "/tasks", name: "Tareas" },
  { path: "/task-management", name: "Gestión de tareas" },
  { path: "/documents", name: "Documentos" },
  { path: "/files", name: "Archivos" },
  { path: "/messaging", name: "Mensajería" },
  { path: "/announcements", name: "Anuncios" },
  { path: "/calendar", name: "Calendario" },
  { path: "/meetings", name: "Reuniones" },
  { path: "/admin/panel", name: "Admin Panel" },
  { path: "/admin/system", name: "Admin Sistema" },
  { path: "/admin/teams", name: "Admin Equipos" },
  { path: "/reports", name: "Reportes" },
  { path: "/search", name: "Búsqueda" },
  { path: "/profile", name: "Perfil" },
  { path: "/directory", name: "Directorio" },
  { path: "/notifications", name: "Notificaciones" },
  { path: "/requests", name: "Solicitudes" },
  { path: "/changes", name: "Cambios" },
];

test.describe("Web — Protección de rutas del dashboard", () => {
  for (const { path, name } of dashboardRoutes) {
    test(`${path} (${name}) redirige a /login sin sesión`, async ({ page }) => {
      await page.goto(path);

      // Esperar a que la app procese y redirija (o muestre login)
      await page.waitForTimeout(3000);

      // Debe redirigir a login o mostrar la pantalla de login
      const url = page.url();
      const hasLoginForm = await page.locator('input[type="email"]').isVisible().catch(() => false);
      const isOnLogin = url.includes("/login");

      expect(isOnLogin || hasLoginForm).toBe(true);
    });
  }
});
