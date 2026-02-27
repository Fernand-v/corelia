import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { MessagingService } from "./service.js";
import { messagingSchemas } from "./schema.js";

export const messagesRouter: FastifyPluginAsync = async (app) => {
  const service = new MessagingService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(messagingSchemas.createMessageInputSchema, request.body);
        const message = await service.createMessage({
          ...payload,
          authorId: request.authUser!.id
        });
        return reply.code(201).send(message);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
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
    async (request, reply) => {
      try {
        const query = parseWithSchema(messagingSchemas.listMessagesQuerySchema, request.query ?? {});
        const messages = await service.listMessages(query.channelId, request.authUser!.id);
        return reply.send(messages);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );
};
