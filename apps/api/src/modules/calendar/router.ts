import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { CalendarService } from "./service.js";
import { calendarSchemas } from "./schema.js";

export const calendarRouter: FastifyPluginAsync = async (app) => {
  const service = new CalendarService(app);

  app.get(
    "/personal",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(calendarSchemas.calendarRangeSchema, request.query);
        const events = await service.getPersonalEvents({
          userId: request.authUser!.id,
          from: query.from,
          to: query.to
        });
        return reply.send(events);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/shared",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(calendarSchemas.calendarSharedQuerySchema, request.query);
        const events = await service.getSharedEvents(query);
        return reply.send(events);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/tasks/reschedule",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(calendarSchemas.calendarTaskRescheduleInputSchema, request.body);
        const result = await service.rescheduleTask({
          ...payload,
          requesterId: request.authUser!.id
        });

        request.auditEvent = {
          entityType: "TAREA",
          entityId: result.task.id,
          action: "ACTUALIZAR",
          newDataText: {
            dueDate: result.task.dueDate,
            warnings: result.warnings
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/capacity",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(calendarSchemas.calendarCapacityQuerySchema, request.query);
        const rows = await service.getTeamCapacity(query);
        return reply.send(rows);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/external/oauth-url",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(calendarSchemas.externalOauthUrlQuerySchema, request.query);
        return reply.send({ url: service.getExternalOAuthUrl(query.provider) });
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/external/connect",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(calendarSchemas.connectExternalCalendarSchema, request.body);
        const connection = await service.connectExternalCalendar({
          ...payload,
          userId: request.authUser!.id
        });
        return reply.code(201).send(connection);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/external/sync",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "CALENDARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(calendarSchemas.syncExternalEventsSchema, request.body);
        const result = await service.syncExternalEvents({
          ...payload,
          userId: request.authUser!.id
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );
};
