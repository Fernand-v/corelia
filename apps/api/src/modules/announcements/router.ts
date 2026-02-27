import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { AnnouncementService } from "./service.js";
import { announcementSchemas } from "./schema.js";

export const announcementsRouter: FastifyPluginAsync = async (app) => {
  const service = new AnnouncementService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ANUNCIO_PUBLICAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(announcementSchemas.createAnnouncementInputSchema, request.body);
      const announcement = await service.create({
        ...payload,
        createdById: request.authUser!.id
      });

      request.auditEvent = {
        entityType: "ANUNCIO",
        entityId: announcement.id,
        action: "CREAR",
        newData: {
          title: announcement.title,
          expiresAt: announcement.expiresAt
        }
      };

      return reply.code(201).send(announcement);
    }
  );

  app.get(
    "/active",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request) => {
      return service.listForUser(request.authUser!.id);
    }
  );
};
