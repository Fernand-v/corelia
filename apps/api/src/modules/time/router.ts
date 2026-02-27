import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { TimeService } from "./service.js";
import { timeSchemas } from "./schema.js";

export const timeRouter: FastifyPluginAsync = async (app) => {
  const service = new TimeService(app);

  app.post(
    "/entries",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "TAREA_LEER"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(timeSchemas.createTimeEntryInputSchema, request.body);
        const entry = await service.createEntry({
          ...payload,
          userId: request.authUser!.id
        });
        return reply.code(201).send(entry);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/summary",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "TAREA_LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(timeSchemas.summaryQuerySchema, request.query ?? {});
      return service.summary(query);
    }
  );
};
