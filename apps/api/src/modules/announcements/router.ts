import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { parseWithSchema } from "../../lib/validate.js";
import { AnnouncementService } from "./service.js";
import { announcementSchemas } from "./schema.js";

export const announcementsRouter: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
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

  app.post(
    "/assets/upload",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ANUNCIO_PUBLICAR"
      }
    },
    async (request, reply) => {
      try {
        const upload = await request.file({
          limits: {
            files: 1,
            fileSize: 50 * 1024 * 1024
          }
        });

        if (!upload) {
          return reply.code(400).send({ message: "No se recibió archivo para subir" });
        }

        const asset = await service.uploadAsset({
          createdById: request.authUser!.id,
          originalName: upload.filename,
          mimeType: upload.mimetype,
          data: await upload.toBuffer()
        });

        return reply.code(201).send(asset);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/assets/content",
    {
      config: {
        requiresAuth: false
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(
          announcementSchemas.announcementAssetContentQuerySchema,
          request.query ?? {}
        );
        const content = await service.getAssetContent({ token: query.token });
        const encodedFileName = encodeURIComponent(content.fileName);

        reply.header("Content-Type", content.mimeType || "application/octet-stream");
        reply.header(
          "Content-Disposition",
          `${query.mode}; filename*=UTF-8''${encodedFileName}`
        );
        reply.header("X-Content-Type-Options", "nosniff");
        return reply.send(content.stream);
      } catch (error) {
        const message = (error as Error).message;
        const statusCode = message.toLowerCase().includes("not found") ? 404 : 400;
        return reply.code(statusCode).send({ message });
      }
    }
  );
};
