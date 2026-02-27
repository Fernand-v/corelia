import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { SearchService } from "./service.js";
import { searchSchemas } from "./schema.js";

export const searchRouter: FastifyPluginAsync = async (app) => {
  const service = new SearchService(app);

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(searchSchemas.globalSearchInputSchema, request.query ?? {});
      return service.search({
        query: query.query,
        projectId: query.projectId,
        userId: request.authUser!.id
      });
    }
  );
};
