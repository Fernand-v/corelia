import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { parseWithSchema } from "../../lib/validate.js";
import { IntegrationService } from "./service.js";
import { integrationSchemas } from "./schema.js";

const smtpTestSchema = z.object({
  config: integrationSchemas.smtpConfigSchema,
  to: z.string().email()
});

export const integrationsRouter: FastifyPluginAsync = async (app) => {
  const service = new IntegrationService(app);

  app.post(
    "/webhooks",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(
        integrationSchemas.webhookEndpointSchema.pick({ url: true, event: true, secret: true, enabled: true }),
        request.body
      );
      const endpoint = await service.saveWebhook({
        ...payload,
        createdById: request.authUser!.id
      });
      return reply.code(201).send(endpoint);
    }
  );

  app.get(
    "/webhooks",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async () => service.listWebhooks()
  );

  app.post(
    "/smtp/test",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(smtpTestSchema, request.body);
      const result = await service.testSmtp(payload.config, payload.to);
      return reply.send(result);
    }
  );

  app.post(
    "/ics",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(integrationSchemas.icsExportRequestSchema, request.body);
      if (payload.userId !== request.authUser!.id) {
        return reply.code(403).send({ message: "No puedes exportar el calendario de otro usuario" });
      }

      const ics = await service.generateIcs(payload);
      reply.header("Content-Type", "text/calendar; charset=utf-8");
      reply.header("Content-Disposition", "attachment; filename=corelia-calendar.ics");
      return reply.send(ics);
    }
  );
};
