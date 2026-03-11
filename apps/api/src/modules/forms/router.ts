import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { FormService } from "./service.js";
import { formSchemas } from "./schema.js";

export const formsRouter: FastifyPluginAsync = async (app) => {
  const service = new FormService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(formSchemas.createFormRequestInputSchema, request.body);
      const formRequest = await service.create({
        requesterId: request.authUser!.id,
        type: payload.type,
        payload: payload.payload
      });
      return reply.code(201).send(formRequest);
    }
  );

  app.post(
    "/resolve",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "SOLICITUD_APROBAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(formSchemas.resolveFormRequestInputSchema, request.body);
      const resolved = await service.resolve({
        ...payload,
        approverId: request.authUser!.id
      });

      request.auditEvent = {
        entityType: "SOLICITUD",
        entityId: resolved.id,
        action: "APROBAR_SOLICITUD",
        reason: payload.comment,
        newDataText: {
          status: payload.status,
          approverId: request.authUser!.id
        }
      };

      return reply.send(resolved);
    }
  );

  app.get(
    "/",
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
