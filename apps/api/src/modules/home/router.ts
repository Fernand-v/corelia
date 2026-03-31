import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { HomeService } from "./service.js";
import { homeSchemas } from "./schema.js";

export const homeRouter: FastifyPluginAsync = async (app) => {
  const service = new HomeService(app);

  app.get(
    "/",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(homeSchemas.homeQuerySchema, request.query ?? {});
        const dashboard = await service.getDashboard({
          userId: request.authUser!.id,
          role: request.accessContext?.activeRole ?? "INVITADO_EXTERNO",
          projectId: request.accessContext?.projectId ?? query.projectId,
          teamId: query.teamId
        });
        return reply.send({
          ...dashboard,
          roleDisplayName: request.accessContext?.roleDisplayName
        });
      } catch (error) {
        throw error;
      }
    }
  );
};
