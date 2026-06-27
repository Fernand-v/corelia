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
        requiredProgram: "MENSAJERIA",
        requiredResource: "MENSAJE",
        requiredAction: "ESCRIBIR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(messagingSchemas.createMessageInputSchema, request.body);
      const message = await service.createMessage({
        ...payload,
        authorId: request.authUser!.id
      });
      return reply.code(201).send(message);
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "MENSAJERIA",
        requiredResource: "PROYECTO",
        requiredAction: "LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(messagingSchemas.listMessagesQuerySchema, request.query ?? {});
      const messages = await service.listMessages(query.channelId, request.authUser!.id);
      return reply.send(messages);
    }
  );
};
