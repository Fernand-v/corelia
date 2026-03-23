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

  app.get(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "AUTOMATIZACION_GESTIONAR"
      }
    },
    async (request, reply) => {
      const { id } = parseWithSchema(automationSchemas.idParamsSchema, request.params);
      try {
        const rule = await service.getById(id);
        return reply.send(rule);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NotFoundError") {
          return reply.code(404).send({ message: err.message });
        }
        throw err;
      }
    }
  );

  app.patch(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "AUTOMATIZACION_GESTIONAR"
      }
    },
    async (request, reply) => {
      const { id } = parseWithSchema(automationSchemas.idParamsSchema, request.params);
      const payload = parseWithSchema(automationSchemas.updateAutomationRuleSchema, request.body);
      try {
        const rule = await service.update(id, payload);
        return reply.send(rule);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NotFoundError") {
          return reply.code(404).send({ message: err.message });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "AUTOMATIZACION_GESTIONAR"
      }
    },
    async (request, reply) => {
      const { id } = parseWithSchema(automationSchemas.idParamsSchema, request.params);
      try {
        const result = await service.delete(id);
        return reply.send(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NotFoundError") {
          return reply.code(404).send({ message: err.message });
        }
        throw err;
      }
    }
  );

  app.patch(
    "/:id/toggle",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "AUTOMATIZACION_GESTIONAR"
      }
    },
    async (request, reply) => {
      const { id } = parseWithSchema(automationSchemas.idParamsSchema, request.params);
      const { enabled } = parseWithSchema(automationSchemas.toggleSchema, request.body);
      try {
        const rule = await service.toggle(id, enabled);
        return reply.send(rule);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NotFoundError") {
          return reply.code(404).send({ message: err.message });
        }
        throw err;
      }
    }
  );
};
