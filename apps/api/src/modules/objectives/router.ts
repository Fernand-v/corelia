import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { ObjectiveService } from "./service.js";
import { objectiveSchemas } from "./schema.js";

export const objectivesRouter: FastifyPluginAsync = async (app) => {
  const service = new ObjectiveService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "OBJETIVOS",
        requiredResource: "OBJETIVO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(objectiveSchemas.createObjectiveInputSchema, request.body);
      const objective = await service.create(payload);
      return reply.code(201).send(objective);
    }
  );

  app.put(
    "/progress",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "OBJETIVOS",
        requiredResource: "OBJETIVO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(objectiveSchemas.updateProgressSchema, request.body);
      const objective = await service.updateProgress(payload.objectiveId, payload.progressPct);
      return reply.send(objective);
    }
  );

  app.post(
    "/link-task",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "OBJETIVOS",
        requiredResource: "OBJETIVO",
        requiredAction: "GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(objectiveSchemas.linkTaskSchema, request.body);
      const link = await service.linkTask(payload.objectiveId, payload.taskId);
      return reply.code(201).send(link);
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "OBJETIVOS",
        requiredResource: "PROYECTO",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      return service.listForUser(request.authUser!.id);
    }
  );
};
