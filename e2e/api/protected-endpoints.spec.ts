import { test, expect } from "@playwright/test";

/**
 * Auditoría de endpoints protegidos: verifica que todos los endpoints
 * que requieren autenticación rechacen peticiones sin token JWT.
 *
 * baseURL = http://localhost:4000/api/v1
 */

const protectedGets = [
  { path: "/projects", name: "Proyectos" },
  { path: "/tasks", name: "Tareas" },
  { path: "/documents", name: "Documentos" },
  { path: "/files/explorer", name: "Explorador de archivos" },
  { path: "/messaging/channels", name: "Canales de mensajería" },
  { path: "/notifications", name: "Notificaciones" },
  { path: "/notifications/unread-count", name: "Conteo no leídas" },
  { path: "/identity/directory", name: "Directorio de usuarios" },
  { path: "/identity/teams", name: "Equipos" },
  { path: "/home", name: "Dashboard home" },
  { path: "/calendar/personal", name: "Calendario personal" },
  { path: "/search?q=test", name: "Búsqueda global" },
  { path: "/announcements/active", name: "Anuncios activos" },
  { path: "/audit", name: "Auditoría" },
  { path: "/reports/executive", name: "Reportes ejecutivos" },
  { path: "/admin/users", name: "Admin: usuarios" },
  { path: "/admin/teams", name: "Admin: equipos" },
  { path: "/admin/roles", name: "Admin: roles" },
  { path: "/admin/permissions", name: "Admin: permisos" },
  { path: "/admin/signup-requests", name: "Admin: solicitudes" },
  { path: "/admin/internal-invites", name: "Admin: invitaciones internas" },
  { path: "/admin/guest-invites", name: "Admin: invitaciones externas" },
  { path: "/admin/system-status", name: "Admin: estado del sistema" },
  { path: "/admin/audit-report", name: "Admin: reporte auditoría" },
  { path: "/admin/overview", name: "Admin: overview" },
  { path: "/admin/frontend-settings", name: "Admin: config frontend" },
  { path: "/admin/code-catalogs", name: "Admin: catálogos" },
];

const protectedPosts = [
  { path: "/projects", name: "Crear proyecto" },
  { path: "/tasks", name: "Crear tarea" },
  { path: "/documents", name: "Crear documento" },
  { path: "/messaging/channels", name: "Crear canal" },
  { path: "/messaging/messages", name: "Enviar mensaje" },
  { path: "/announcements", name: "Crear anuncio" },
  { path: "/admin/users", name: "Admin: crear usuario" },
  { path: "/admin/teams", name: "Admin: crear equipo" },
  { path: "/admin/database-backup", name: "Admin: backup BD" },
  { path: "/identity/users", name: "Crear usuario identidad" },
];

test.describe("API — Endpoints protegidos (GET sin auth → 401)", () => {
  for (const { path, name } of protectedGets) {
    test(`GET ${path} (${name}) rechaza sin token`, async ({ request }) => {
      const res = await request.get(path.replace(/^\//, ""));
      expect(res.status()).toBe(401);
    });
  }
});

test.describe("API — Endpoints protegidos (POST sin auth → 401)", () => {
  for (const { path, name } of protectedPosts) {
    test(`POST ${path} (${name}) rechaza sin token`, async ({ request }) => {
      const res = await request.post(path.replace(/^\//, ""), { data: {} });
      expect(res.status()).toBe(401);
    });
  }
});
