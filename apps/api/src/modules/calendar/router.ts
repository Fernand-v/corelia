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
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(calendarSchemas.calendarRangeSchema, request.query);
      const events = await service.getPersonalEvents({
        userId: request.authUser!.id,
        from: query.from,
        to: query.to
      });
      return reply.send(events);
    }
  );

  app.get(
    "/shared",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(calendarSchemas.calendarSharedQuerySchema, request.query);
      const events = await service.getSharedEvents(query);
      return reply.send(events);
    }
  );

  app.post(
    "/tasks/reschedule",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
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
    }
  );

  app.get(
    "/capacity",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(calendarSchemas.calendarCapacityQuerySchema, request.query);
      const rows = await service.getTeamCapacity(query);
      return reply.send(rows);
    }
  );

  app.get(
    "/external/oauth-url",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(calendarSchemas.externalOauthUrlQuerySchema, request.query);
      return reply.send({ url: service.getExternalOAuthUrl(query.provider) });
    }
  );

  app.post(
    "/external/connect",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(calendarSchemas.connectExternalCalendarSchema, request.body);
      const connection = await service.connectExternalCalendar({
        ...payload,
        userId: request.authUser!.id
      });
      return reply.code(201).send(connection);
    }
  );

  app.post(
    "/external/sync",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "CALENDARIO",
        requiredResource: "CALENDARIO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(calendarSchemas.syncExternalEventsSchema, request.body);
      const result = await service.syncExternalEvents({
        ...payload,
        userId: request.authUser!.id
      });
      return reply.send(result);
    }
  );
};
