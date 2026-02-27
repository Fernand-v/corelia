import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { MessagingService } from "./service.js";
import { messagingSchemas } from "./schema.js";

export const messagingRouter: FastifyPluginAsync = async (app) => {
  const service = new MessagingService(app);

  app.get(
    "/channels",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(messagingSchemas.listChannelsQuerySchema, request.query ?? {});
        const channels = await service.listChannels(request.authUser!.id, query);
        return reply.send(channels);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/channels",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(messagingSchemas.createChannelSchema, request.body);
      const channel = await service.createChannel({
        ...payload,
        creatorId: request.authUser!.id
      });
      return reply.code(201).send(channel);
    }
  );

  app.post(
    "/channels/direct",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(messagingSchemas.createDirectChannelSchema, request.body);
        const channel = await service.createDirectChannel({
          creatorId: request.authUser!.id,
          targetUserId: payload.targetUserId
        });
        return reply.code(201).send(channel);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/messages",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
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
    "/channels/:channelId/messages",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request) => {
      const params = parseWithSchema(messagingSchemas.channelParamsSchema, request.params);
      return service.listMessages(params.channelId, request.authUser!.id);
    }
  );
};
