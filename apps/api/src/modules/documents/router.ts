import type { FastifyPluginAsync } from "fastify";
import multipart, { type Multipart } from "@fastify/multipart";
import { parseWithSchema } from "../../lib/validate.js";
import { DocumentsService } from "./service.js";
import { documentSchemas } from "./schema.js";

export const documentsRouter: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
  const service = new DocumentsService(app);

  const readMultipartField = (
    input: Multipart | Multipart[] | undefined,
  ): string => {
    const field = Array.isArray(input) ? input[0] : input;
    if (!field || field.type !== "field") {
      return "";
    }

    return typeof field.value === "string" ? field.value : "";
  };

  // ── Trash ──────────────────────────────────────────────

  app.get(
    "/trash",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(
          documentSchemas.listTrashQuerySchema,
          request.query ?? {},
        );
        const result = await service.listTrash({
          projectId: query.projectId,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  // ── Templates ──────────────────────────────────────────

  app.get(
    "/templates",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(
          documentSchemas.listTemplatesQuerySchema,
          request.query ?? {},
        );
        const result = await service.listTemplates({
          projectId: query.projectId,
          type: query.type,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/templates",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          documentSchemas.createTemplateInputSchema,
          request.body,
        );
        const result = await service.createTemplate({
          documentId: payload.documentId,
          name: payload.name,
          description: payload.description,
          userId: request.authUser!.id,
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: result.id,
          action: "CREAR",
          newDataText: {
            type: "template",
            name: result.name,
          },
        };

        return reply.code(201).send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  // ── Batch operations ───────────────────────────────────

  app.post(
    "/batch-delete",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          documentSchemas.batchDocumentIdsSchema,
          request.body,
        );
        const result = await service.batchSoftDelete({
          documentIds: payload.documentIds,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/batch-restore",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          documentSchemas.batchDocumentIdsSchema,
          request.body,
        );
        const result = await service.batchRestore({
          documentIds: payload.documentIds,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/init-folders",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          documentSchemas.initFoldersInputSchema,
          request.body,
        );
        const result = await service.initFolders({
          projectId: payload.projectId,
          userId: request.authUser!.id,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(
          documentSchemas.listDocumentsQuerySchema,
          request.query ?? {},
        );
        const result = await service.listDocuments({
          projectId: query.projectId,
          userId: request.authUser!.id,
          q: query.q,
          type: query.type,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          documentSchemas.createDocumentInputSchema,
          request.body,
        );
        const created = payload.templateId
          ? await service.createDocumentFromTemplate({
              projectId: payload.projectId,
              userId: request.authUser!.id,
              type: payload.type,
              name: payload.name,
              templateId: payload.templateId,
              diagramKind: payload.diagramKind,
            })
          : await service.createDocument({
              projectId: payload.projectId,
              userId: request.authUser!.id,
              type: payload.type,
              name: payload.name,
              diagramKind: payload.diagramKind,
            });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: created.id,
          action: "CREAR",
          newDataText: {
            projectId: created.projectId,
            type: created.type,
            name: created.name,
          },
        };

        return reply.code(201).send(created);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/presence",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(
          documentSchemas.documentsPresenceQuerySchema,
          request.query ?? {},
        );
        const result = await service.listPresence({
          projectId: query.projectId,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/:documentId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const result = await service.getDocument({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/collab-token",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const token = await service.createCollabToken({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });

        return reply.send(token);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/diagram-session/join",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentDiagramSessionParamsSchema,
          request.params,
        );
        const body = parseWithSchema(
          documentSchemas.documentDiagramSessionJoinInputSchema,
          request.body ?? {},
        );

        const result = await service.joinDiagramSession({
          documentId: params.documentId,
          userId: request.authUser!.id,
          clientId: body.clientId,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/diagram-session/heartbeat",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentDiagramSessionParamsSchema,
          request.params,
        );
        const body = parseWithSchema(
          documentSchemas.documentDiagramSessionHeartbeatInputSchema,
          request.body,
        );

        const result = await service.heartbeatDiagramSession({
          documentId: params.documentId,
          userId: request.authUser!.id,
          sessionId: body.sessionId,
          clientId: body.clientId,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/diagram-session/snapshot",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentDiagramSessionParamsSchema,
          request.params,
        );
        const body = parseWithSchema(
          documentSchemas.documentDiagramSessionSnapshotInputSchema,
          request.body,
        );

        const result = await service.saveDiagramSessionSnapshot({
          documentId: params.documentId,
          userId: request.authUser!.id,
          sessionId: body.sessionId,
          clientId: body.clientId,
          content: body.content,
          reason: body.reason,
          metadata: body.metadata,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/diagram-session/leave",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentDiagramSessionParamsSchema,
          request.params,
        );
        const body = parseWithSchema(
          documentSchemas.documentDiagramSessionLeaveInputSchema,
          request.body,
        );

        const result = await service.leaveDiagramSession({
          documentId: params.documentId,
          userId: request.authUser!.id,
          sessionId: body.sessionId,
          clientId: body.clientId,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/:documentId/diagram-session/state",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentDiagramSessionParamsSchema,
          request.params,
        );
        const result = await service.getDiagramSessionState({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.patch(
    "/:documentId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const payload = parseWithSchema(
          documentSchemas.renameDocumentInputSchema,
          request.body,
        );
        const updated = await service.renameDocument({
          documentId: params.documentId,
          userId: request.authUser!.id,
          name: payload.name,
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: updated.id,
          action: "ACTUALIZAR",
          newDataText: {
            name: updated.name,
          },
        };

        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    },
  );

  app.delete(
    "/:documentId",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const deleted = await service.deleteDocument({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: deleted.id,
          action: "ELIMINAR",
          reasonCatalogId: "DOCUMENT_SOFT_DELETE",
          reason: "Documento movido a papelera por 7 días",
        };

        return reply.send(deleted);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/:documentId/versions",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const query = parseWithSchema(
          documentSchemas.listDocumentVersionsQuerySchema,
          request.query ?? {},
        );

        const versions = await service.listVersions({
          documentId: params.documentId,
          userId: request.authUser!.id,
          page: query.page,
          pageSize: query.pageSize,
        });

        return reply.send(versions);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/assets",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const upload = await request.file({
          limits: {
            files: 1,
            fileSize: 50 * 1024 * 1024,
          },
        });

        if (!upload) {
          return reply
            .code(400)
            .send({ message: "No se recibió archivo para subir" });
        }

        const asset = await service.uploadAsset({
          documentId: params.documentId,
          userId: request.authUser!.id,
          originalName: upload.filename,
          mimeType: upload.mimetype,
          data: await upload.toBuffer(),
        });

        return reply.code(201).send(asset);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/assets/content",
    {
      config: {
        requiresAuth: false,
      },
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(
          documentSchemas.documentAssetContentQuerySchema,
          request.query ?? {},
        );
        const content = await service.getAssetContent({ token: query.token });
        const encodedFileName = encodeURIComponent(content.fileName);

        reply.header(
          "Content-Type",
          content.mimeType || "application/octet-stream",
        );
        reply.header(
          "Content-Disposition",
          `${query.mode}; filename*=UTF-8''${encodedFileName}`,
        );
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Cross-Origin-Resource-Policy", "cross-origin");
        return reply.send(content.stream);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/versions",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const upload = await request.file({
          limits: {
            files: 1,
            fileSize: 50 * 1024 * 1024,
          },
        });

        if (!upload) {
          return reply
            .code(400)
            .send({ message: "No se recibió snapshot para versionar" });
        }

        const body = parseWithSchema(documentSchemas.saveVersionInputSchema, {
          kind: readMultipartField(upload.fields.kind) || undefined,
        });

        const result = await service.saveVersion({
          documentId: params.documentId,
          userId: request.authUser!.id,
          kind: body.kind,
          fileName: upload.filename,
          mimeType: upload.mimetype,
          data: await upload.toBuffer(),
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: params.documentId,
          action: "ACTUALIZAR",
          reasonCatalogId: "DOCUMENT_VERSION_SAVE",
          reason: `Versión ${result.version.versionNumber} guardada`,
          newDataText: {
            version: result.version.versionNumber,
            kind: result.version.kind,
          },
        };

        return reply.code(201).send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/:documentId/versions/:versionId/content",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentVersionParamsSchema,
          request.params,
        );
        const query = parseWithSchema(
          documentSchemas.documentVersionContentQuerySchema,
          request.query ?? {},
        );
        const content = await service.getVersionContent({
          documentId: params.documentId,
          versionId: params.versionId,
          userId: request.authUser!.id,
        });

        const fileName = encodeURIComponent(content.fileName);

        reply.header("Content-Type", content.mimeType);
        reply.header(
          "Content-Disposition",
          `${query.mode}; filename*=UTF-8''${fileName}`,
        );
        reply.header("X-Content-Type-Options", "nosniff");
        return reply.send(content.stream);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/:documentId/onlyoffice/config",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const canEdit = Boolean(
          request.accessContext?.permissions.includes("ARCHIVO_SUBIR"),
        );
        const result = await service.getOnlyOfficeConfig({
          documentId: params.documentId,
          userId: request.authUser!.id,
          canEdit,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.get(
    "/:documentId/onlyoffice/file",
    {
      config: {
        requiresAuth: false,
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const query = parseWithSchema(
          documentSchemas.onlyOfficeSignedTokenQuerySchema,
          request.query ?? {},
        );
        const content = await service.getOnlyOfficeFileContent({
          documentId: params.documentId,
          token: query.token,
        });
        const encodedFileName = encodeURIComponent(content.fileName);
        reply.header("Content-Type", content.mimeType);
        reply.header(
          "Content-Disposition",
          `inline; filename*=UTF-8''${encodedFileName}`,
        );
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Cross-Origin-Resource-Policy", "cross-origin");
        return reply.send(content.stream);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/onlyoffice/callback",
    {
      config: {
        requiresAuth: false,
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const query = parseWithSchema(
          documentSchemas.onlyOfficeSignedTokenQuerySchema,
          request.query ?? {},
        );
        const body = parseWithSchema(
          documentSchemas.onlyOfficeCallbackBodySchema,
          request.body ?? {},
        );
        const result = await service.handleOnlyOfficeCallback({
          documentId: params.documentId,
          token: query.token,
          body,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/onlyoffice/forcesave",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const result = await service.forceSaveOnlyOffice({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/versions/:versionId/restore",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentVersionParamsSchema,
          request.params,
        );
        const result = await service.restoreVersion({
          documentId: params.documentId,
          versionId: params.versionId,
          userId: request.authUser!.id,
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: params.documentId,
          action: "ACTUALIZAR",
          reasonCatalogId: "DOCUMENT_VERSION_RESTORE",
          reason: `Versión restaurada desde ${params.versionId}`,
          newDataText: {
            version: result.version.versionNumber,
          },
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.post(
    "/:documentId/presence",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentIdParamsSchema,
          request.params,
        );
        const payload = parseWithSchema(
          documentSchemas.presenceHeartbeatInputSchema,
          request.body,
        );
        const result = await service.heartbeatPresence({
          documentId: params.documentId,
          userId: request.authUser!.id,
          color: payload.color,
          cursorLabel: payload.cursorLabel,
        });

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  // ── Restore from trash ─────────────────────────────────

  app.post(
    "/:documentId/restore",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.restoreDocumentParamsSchema,
          request.params,
        );
        const restored = await service.restoreDocument({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: restored.id,
          action: "ACTUALIZAR",
          reasonCatalogId: "DOCUMENT_RESTORE",
          reason: "Documento restaurado desde papelera",
        };

        return reply.send(restored);
      } catch (error) {
        throw error;
      }
    },
  );

  // ── Duplicate ──────────────────────────────────────────

  app.post(
    "/:documentId/duplicate",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "ARCHIVO_SUBIR",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.duplicateDocumentParamsSchema,
          request.params,
        );
        const duplicated = await service.duplicateDocument({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });

        request.auditEvent = {
          entityType: "ARCHIVO",
          entityId: duplicated.id,
          action: "CREAR",
          newDataText: {
            name: duplicated.name,
            duplicatedFrom: params.documentId,
          },
        };

        return reply.code(201).send(duplicated);
      } catch (error) {
        throw error;
      }
    },
  );

  // ── Favorites ──────────────────────────────────────────

  app.post(
    "/:documentId/favorite",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentFavoriteParamsSchema,
          request.params,
        );
        const result = await service.toggleFavorite({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );

  app.delete(
    "/:documentId/favorite",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_LEER",
      },
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(
          documentSchemas.documentFavoriteParamsSchema,
          request.params,
        );
        const result = await service.removeFavorite({
          documentId: params.documentId,
          userId: request.authUser!.id,
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    },
  );
};
