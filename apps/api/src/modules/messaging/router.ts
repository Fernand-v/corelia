import type { FastifyPluginAsync } from "fastify";
import multipart, { type Multipart } from "@fastify/multipart";
import { parseWithSchema } from "../../lib/validate.js";
import { MessagingService } from "./service.js";
import { messagingSchemas } from "./schema.js";

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const readMultipartField = (input: Multipart | Multipart[] | undefined): string => {
  const field = Array.isArray(input) ? input[0] : input;
  if (!field || field.type !== "field") {
    return "";
  }

  return typeof field.value === "string" ? field.value : "";
};

const parseMentionsField = (input: Multipart | Multipart[] | undefined): string[] => {
  const raw = readMultipartField(input).trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fallback to comma-separated input when value is not JSON.
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

export const messagingRouter: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
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

  app.post(
    "/messages/file",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
      }
    },
    async (request, reply) => {
      try {
        const upload = await request.file({
          limits: {
            files: 1,
            fileSize: MAX_ATTACHMENT_SIZE
          }
        });

        if (!upload) {
          return reply.code(400).send({ message: "No se recibió archivo para enviar" });
        }

        const payload = parseWithSchema(messagingSchemas.createFileMessageInputSchema, {
          channelId: readMultipartField(upload.fields.channelId),
          content: readMultipartField(upload.fields.content),
          mentions: parseMentionsField(upload.fields.mentions)
        });

        const message = await service.createFileMessage({
          channelId: payload.channelId,
          authorId: request.authUser!.id,
          content: payload.content,
          mentions: payload.mentions,
          originalName: upload.filename,
          mimeType: upload.mimetype,
          data: await upload.toBuffer()
        });

        return reply.code(201).send(message);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
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
    async (request, reply) => {
      try {
        const params = parseWithSchema(messagingSchemas.channelParamsSchema, request.params);
        const messages = await service.listMessages(params.channelId, request.authUser!.id);
        return reply.send(messages);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/channels/:channelId/instant-call",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(messagingSchemas.channelParamsSchema, request.params);
        const result = await service.createInstantCall({
          channelId: params.channelId,
          authorId: request.authUser!.id
        });

        request.auditEvent = {
          entityType: "REUNION",
          entityId: result.meetingId,
          action: "PROGRAMAR_REUNION",
          reasonCatalogId: "INSTANT_CALL",
          reason: "Videollamada instantánea iniciada desde mensajería",
          newDataText: {
            channelId: params.channelId,
            joinUrl: result.joinUrl
          }
        };

        return reply.code(201).send(result);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/attachments/:attachmentId/content",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(messagingSchemas.attachmentParamsSchema, request.params);
        const query = parseWithSchema(messagingSchemas.attachmentContentQuerySchema, request.query ?? {});
        const content = await service.getAttachmentContent({
          attachmentId: params.attachmentId,
          userId: request.authUser!.id
        });

        const encodedFileName = encodeURIComponent(content.attachment.originalName);
        const disposition = query.mode;

        reply.header("Content-Type", content.attachment.mimeType || "application/octet-stream");
        reply.header("Content-Disposition", `${disposition}; filename*=UTF-8''${encodedFileName}`);
        reply.header("X-Content-Type-Options", "nosniff");

        return reply.send(content.stream);
      } catch (error) {
        const message = (error as Error).message;
        const statusCode =
          message.toLowerCase().includes("acceso")
            ? 403
            : message.toLowerCase().includes("no encontrado")
              ? 404
              : 400;
        return reply.code(statusCode).send({ message });
      }
    }
  );

  app.get(
    "/conversations",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const data = await service.getConversations(request.authUser!.id);
        return reply.send(data);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/projects/:projectId/general-channel/ensure",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "MENSAJE_ESCRIBIR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(messagingSchemas.projectParamsSchema, request.params);
        const channel = await service.ensureProjectGeneralChannel({
          projectId: params.projectId,
          requesterId: request.authUser!.id
        });
        return reply.send(channel);
      } catch (error) {
        const message = (error as Error).message;
        const statusCode = message.toLowerCase().includes("acceso") ? 403 : 400;
        return reply.code(statusCode).send({ message });
      }
    }
  );
};
