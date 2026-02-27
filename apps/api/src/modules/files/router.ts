import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { FileService } from "./service.js";
import { fileSchemas } from "./schema.js";

export const filesRouter: FastifyPluginAsync = async (app) => {
  const service = new FileService(app);

  app.get(
    "/explorer",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(fileSchemas.explorerQuerySchema, request.query ?? {});
        const result = await service.listProjectExplorer({
          projectId: query.projectId,
          folderId: query.folderId
        });
        return reply.send(result);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/folders",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(fileSchemas.createFolderSchema, request.body);
      const folder = await service.createFolder({
        ...payload,
        createdById: request.authUser!.id
      });
      return reply.code(201).send(folder);
    }
  );

  app.post(
    "/objects",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(fileSchemas.registerFileSchema, request.body);
      const file = await service.registerFile({
        ...payload,
        ownerId: request.authUser!.id
      });
      return reply.code(201).send(file);
    }
  );

  app.delete(
    "/objects/:fileId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR"
      }
    },
    async (request, reply) => {
      const params = parseWithSchema(fileSchemas.fileIdParamSchema, request.params);
      const file = await service.deleteToTrash(params.fileId);
      return reply.send(file);
    }
  );

  app.put(
    "/quotas",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(fileSchemas.storageQuotaSchema, request.body);
      const quota = await service.upsertQuota({
        scopeType: payload.scopeType,
        scopeId: payload.scopeId,
        bytesLimit: BigInt(payload.bytesLimit),
        alertThresholdPct: payload.alertThresholdPct
      });

      const usage = await service.usage(payload.scopeType, payload.scopeId);
      const percent = usage / payload.bytesLimit;

      return reply.send({
        quota,
        usageBytes: usage,
        usagePct: percent,
        warning80: percent >= 0.8
      });
    }
  );
};
