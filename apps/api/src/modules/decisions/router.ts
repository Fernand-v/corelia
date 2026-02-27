import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { DecisionService } from "./service.js";
import { decisionSchemas } from "./schema.js";

export const decisionsRouter: FastifyPluginAsync = async (app) => {
  const service = new DecisionService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(decisionSchemas.createDecisionNoteInputSchema, request.body);
      const note = await service.create({
        ...payload,
        authorId: request.authUser!.id
      });
      return reply.code(201).send(note);
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(decisionSchemas.listQuerySchema, request.query ?? {});
      return service.list(query);
    }
  );
};
