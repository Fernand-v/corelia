import Fastify, { type FastifyInstance } from "fastify";
import { auditPlugin } from "./plugins/audit.js";
import { authPlugin } from "./plugins/auth.js";
import { maintenancePlugin } from "./plugins/maintenance.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { rbacPlugin } from "./plugins/rbac.js";
import { redisPlugin } from "./plugins/redis.js";
import { queuesPlugin } from "./plugins/queues.js";
import { socketPlugin } from "./plugins/socket.js";
import { mediaPlugin } from "./plugins/media.js";
import { storagePlugin } from "./plugins/storage.js";
import { securityPlugin } from "./plugins/security.js";
import { searchIndexPlugin } from "./plugins/search-index.js";
import metricsPlugin from "./plugins/metrics.js";
import { statusRouter } from "./modules/status/router.js";
import { authRouter } from "./modules/auth/router.js";
import { identityRouter } from "./modules/identity/router.js";
import { projectsRouter } from "./modules/projects/router.js";
import { tasksRouter } from "./modules/tasks/router.js";
import { availabilityRouter } from "./modules/availability/router.js";
import { timeRouter } from "./modules/time/router.js";
import { messagingRouter } from "./modules/messaging/router.js";
import { messagesRouter } from "./modules/messaging/messages-router.js";
import { notificationsRouter } from "./modules/notifications/router.js";
import { announcementsRouter } from "./modules/announcements/router.js";
import { formsRouter } from "./modules/forms/router.js";
import { filesRouter } from "./modules/files/router.js";
import { documentsRouter } from "./modules/documents/router.js";
import { searchRouter } from "./modules/search/router.js";
import { decisionsRouter } from "./modules/decisions/router.js";
import { automationsRouter } from "./modules/automations/router.js";
import { objectivesRouter } from "./modules/objectives/router.js";
import { integrationsRouter } from "./modules/integrations/router.js";
import { importsRouter } from "./modules/imports/router.js";
import { auditRouter } from "./modules/audit/router.js";
import { meetingsRouter } from "./modules/meetings/router.js";
import { calendarRouter } from "./modules/calendar/router.js";
import { homeRouter } from "./modules/home/router.js";
import { adminRouter } from "./modules/admin/router.js";
import { reportsRouter } from "./modules/reports/router.js";
import { expensesRouter } from "./modules/expenses/router.js";

export const createApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug"
    },
    trustProxy: true
  });

  app.setErrorHandler((error, _request, reply) => {
    const knownError = error as Error & {
      statusCode?: number;
      validation?: unknown;
      code?: string;
    };
    const prismaCode = typeof knownError.code === "string" ? knownError.code : null;

    const resolveStatusCode = (): number => {
      if (
        knownError.name === "ValidationError" ||
        knownError.name === "ZodError" ||
        Boolean(knownError.validation)
      )
        return 400;
      if (knownError.name === "Unauthorized") return 401;
      if (knownError.name === "Forbidden") return 403;
      if (knownError.name === "NotFoundError" || prismaCode === "P2025") return 404;
      if (knownError.name === "Conflict" || prismaCode === "P2002") return 409;
      if (knownError.name === "ServiceUnavailable") return 503;
      if (
        typeof knownError.statusCode === "number" &&
        knownError.statusCode >= 400 &&
        knownError.statusCode <= 599
      )
        return knownError.statusCode;
      return 500;
    };

    const statusCode = resolveStatusCode();

    if (statusCode >= 500) {
      app.log.error(knownError);
      return reply.code(statusCode).send({
        message: "Error interno del servidor"
      });
    }

    return reply.code(statusCode).send({
      message: knownError.message
    });
  });

  await app.register(securityPlugin);
  await app.register(metricsPlugin);
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(storagePlugin);
  await app.register(searchIndexPlugin);
  await app.register(queuesPlugin);
  await app.register(authPlugin);
  await app.register(socketPlugin);
  await app.register(mediaPlugin);
  await app.register(rbacPlugin);
  await app.register(maintenancePlugin);
  await app.register(auditPlugin);

  app.get(
    "/",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async () => ({
      name: "Corelia API",
      version: "v1"
    })
  );

  await app.register(statusRouter, { prefix: "/status" });

  await app.register(authRouter, { prefix: "/api/v1/auth" });
  await app.register(identityRouter, { prefix: "/api/v1/identity" });
  await app.register(projectsRouter, { prefix: "/api/v1/projects" });
  await app.register(tasksRouter, { prefix: "/api/v1/tasks" });
  await app.register(availabilityRouter, { prefix: "/api/v1/availability" });
  await app.register(timeRouter, { prefix: "/api/v1/time" });
  await app.register(messagingRouter, { prefix: "/api/v1/messaging" });
  await app.register(messagesRouter, { prefix: "/api/v1/messages" });
  await app.register(notificationsRouter, { prefix: "/api/v1/notifications" });
  await app.register(announcementsRouter, { prefix: "/api/v1/announcements" });
  await app.register(formsRouter, { prefix: "/api/v1/forms" });
  await app.register(filesRouter, { prefix: "/api/v1/files" });
  await app.register(documentsRouter, { prefix: "/api/v1/documents" });
  await app.register(searchRouter, { prefix: "/api/v1/search" });
  await app.register(decisionsRouter, { prefix: "/api/v1/decisions" });
  await app.register(automationsRouter, { prefix: "/api/v1/automations" });
  await app.register(objectivesRouter, { prefix: "/api/v1/objectives" });
  await app.register(integrationsRouter, { prefix: "/api/v1/integrations" });
  await app.register(importsRouter, { prefix: "/api/v1/imports" });
  await app.register(auditRouter, { prefix: "/api/v1/audit" });
  await app.register(meetingsRouter, { prefix: "/api/v1/meetings" });
  await app.register(calendarRouter, { prefix: "/api/v1/calendar" });
  await app.register(homeRouter, { prefix: "/api/v1/home" });
  await app.register(adminRouter, { prefix: "/api/v1/admin" });
  await app.register(reportsRouter, { prefix: "/api/v1/reports" });
  // Expenses routes are intentionally scoped under /api/v1/projects/:projectId/
  // because all endpoints are project-level resources (budget details, expenses, summary).
  await app.register(expensesRouter, { prefix: "/api/v1" });

  return app;
};
