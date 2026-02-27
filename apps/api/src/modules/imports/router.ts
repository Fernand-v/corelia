import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { ImportService } from "./service.js";
import { importSchemas } from "./schema.js";

export const importsRouter: FastifyPluginAsync = async (app) => {
  const service = new ImportService(app);

  app.post(
    "/jobs",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(importSchemas.createImportJobSchema, request.body);
      const job = await service.createJob({
        ...payload,
        createdById: request.authUser!.id
      });
      return reply.code(201).send(job);
    }
  );

  app.post(
    "/jobs/errors",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(importSchemas.addImportErrorsSchema, request.body);
      const result = await service.addErrors(payload);
      return reply.send(result);
    }
  );

  app.post(
    "/jobs/:jobId/complete",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const params = parseWithSchema(importSchemas.jobParamSchema, request.params);
      const job = await service.completeJob(params.jobId);
      return reply.send(job);
    }
  );

  app.get(
    "/jobs/:jobId/report",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request) => {
      const params = parseWithSchema(importSchemas.jobParamSchema, request.params);
      return service.report(params.jobId);
    }
  );
};
