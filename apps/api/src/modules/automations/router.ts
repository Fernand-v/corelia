import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { AutomationService } from "./service.js";
import { automationSchemas } from "./schema.js";

export const automationsRouter: FastifyPluginAsync = async (app) => {
  const service = new AutomationService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "AUTOMATIZACION_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(automationSchemas.createAutomationRuleInputSchema, request.body);
      const rule = await service.create({
        ...payload,
        createdById: request.authUser!.id
      });
      return reply.code(201).send(rule);
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "AUTOMATIZACION_GESTIONAR"
      }
    },
    async (request) => {
      const query = parseWithSchema(automationSchemas.listQuerySchema, request.query ?? {});
      return service.list(query.projectId);
    }
  );
};
