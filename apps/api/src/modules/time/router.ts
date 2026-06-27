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
        requiredProgram: "TIEMPO",
        requiredResource: "TAREA",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(timeSchemas.createTimeEntryInputSchema, request.body);
      const entry = await service.createEntry({
        ...payload,
        userId: request.authUser!.id,
        activeRoleRank: request.accessContext!.rank
      });
      return reply.code(201).send(entry);
    }
  );

  app.get(
    "/summary",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TIEMPO",
        requiredResource: "TAREA",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(timeSchemas.summaryQuerySchema, request.query ?? {});
      return service.summary({
        ...query,
        actorId: request.authUser!.id,
        activeRoleRank: request.accessContext!.rank,
        projectContextId: request.accessContext?.projectId
      });
    }
  );
};
