import type { FastifyPluginAsync } from "fastify";
import multipart, { type Multipart } from "@fastify/multipart";
import { parseWithSchema } from "../../lib/validate.js";
import { FileService } from "./service.js";
import { fileSchemas } from "./schema.js";

export const filesRouter: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
  const service = new FileService(app);

  const readMultipartField = (input: Multipart | Multipart[] | undefined): string => {
    const field = Array.isArray(input) ? input[0] : input;
    if (!field || field.type !== "field") {
      return "";
    }

    return typeof field.value === "string" ? field.value : "";
  };

  app.get(
    "/explorer",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(fileSchemas.explorerQuerySchema, request.query ?? {});
      const result = await service.listProjectExplorer({
        projectId: query.projectId,
        folderId: query.folderId,
        cursor: query.cursor,
        pageSize: query.pageSize
      });
      return reply.send(result);
    }
  );

  app.get(
    "/history",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(fileSchemas.historyQuerySchema, request.query ?? {});
      const result = await service.listProjectChanges({
        projectId: query.projectId,
        limit: query.limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/storage-summary",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(fileSchemas.storageSummaryQuerySchema, request.query ?? {});
      const result = await service.getProjectStorageSummary({
        projectId: query.projectId
      });
      return reply.send(result);
    }
  );

  app.post(
    "/folders",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
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
    "/upload",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
        requiredPermission: "ARCHIVO_SUBIR"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(fileSchemas.projectQuerySchema, request.query ?? {});
      const upload = await request.file({
        limits: {
          files: 1,
          fileSize: 50 * 1024 * 1024
        }
      });

      if (!upload) {
        return reply.code(400).send({ message: "No se recibió archivo para subir" });
      }

      const body = parseWithSchema(fileSchemas.uploadFileBodySchema, {
        folderId: readMultipartField(upload.fields.folderId)
      });

      const file = await service.uploadProjectFile({
        projectId: query.projectId,
        folderId: body.folderId,
        ownerId: request.authUser!.id,
        originalName: upload.filename,
        mimeType: upload.mimetype,
        data: await upload.toBuffer()
      });

      return reply.code(201).send(file);
    }
  );

  app.post(
    "/objects",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
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
        requiredProgram: "ARCHIVOS",
        requiredPermission: "ARCHIVO_SUBIR"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(fileSchemas.projectQuerySchema, request.query ?? {});
      const params = parseWithSchema(fileSchemas.fileIdParamSchema, request.params);
      const file = await service.deleteToTrash({
        fileId: params.fileId,
        projectId: query.projectId
      });
      return reply.send(file);
    }
  );

  app.get(
    "/objects/:fileId/content",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      const params = parseWithSchema(fileSchemas.fileIdParamSchema, request.params);
      const query = parseWithSchema(fileSchemas.fileContentQuerySchema, request.query ?? {});
      const content = await service.getFileContent({ fileId: params.fileId, userId: request.authUser!.id });
      const encodedFileName = encodeURIComponent(content.file.originalName);

      reply.header("Content-Type", content.file.mimeType || "application/octet-stream");
      reply.header(
        "Content-Disposition",
        `${query.mode}; filename*=UTF-8''${encodedFileName}`
      );
      reply.header("X-Content-Type-Options", "nosniff");
      return reply.send(content.stream);
    }
  );

  app.put(
    "/quotas",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ARCHIVOS",
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
