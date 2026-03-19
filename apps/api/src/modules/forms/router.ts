import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { parseWithSchema } from "../../lib/validate.js";
import { FormService } from "./service.js";
import { formSchemas } from "./schema.js";

export const formsRouter: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
  const service = new FormService(app);

  app.post(
    "/requests",
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
    "/requests/resolve",
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
    "/requests",
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
    "/",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(formSchemas.createDynamicFormInputSchema, request.body);
        const created = await service.createDynamicForm(request.authUser!.id, payload);
        return reply.code(201).send(created);
      } catch (error) {
        const known = error as Error;
        const status = known.name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: known.message });
      }
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
    async (request, reply) => {
      try {
        const query = parseWithSchema(formSchemas.dynamicFormListQuerySchema, request.query ?? {});
        const forms = await service.listDynamicForms(request.authUser!.id, query);
        return reply.send(forms);
      } catch (error) {
        const known = error as Error;
        const status = known.name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.get(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const form = await service.getDynamicFormById(request.authUser!.id, params.id);
        return reply.send(form);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.put(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const payload = parseWithSchema(formSchemas.updateDynamicFormInputSchema, request.body);
        const updated = await service.updateDynamicForm(request.authUser!.id, params.id, payload);
        return reply.send(updated);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado" || known.message === "Proyecto no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.delete(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const result = await service.deleteDynamicForm(request.authUser!.id, params.id);
        return reply.send(result);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.post(
    "/:id/questions",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const payload = parseWithSchema(formSchemas.addDynamicFormQuestionInputSchema, request.body);
        const question = await service.addDynamicQuestion(request.authUser!.id, params.id, payload);
        return reply.code(201).send(question);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado" || known.message === "Proyecto no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.put(
    "/questions/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormQuestionIdParamsSchema, request.params);
        const payload = parseWithSchema(formSchemas.updateDynamicFormQuestionInputSchema, request.body);
        const question = await service.updateDynamicQuestion(request.authUser!.id, params.id, payload);
        return reply.send(question);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Pregunta no encontrada"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.delete(
    "/questions/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormQuestionIdParamsSchema, request.params);
        const removed = await service.removeDynamicQuestion(request.authUser!.id, params.id);
        return reply.send(removed);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Pregunta no encontrada"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.post(
    "/:id/upload",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ message: "No se envió ningún archivo" });
        }

        if (!app.storage) {
          return reply.code(503).send({ message: "Servicio de almacenamiento no disponible" });
        }

        const buffer = await data.toBuffer();
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (buffer.length > maxSize) {
          return reply.code(400).send({ message: "El archivo excede el tamaño máximo de 10MB" });
        }

        const sanitizedName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const objectKey = `form-uploads/${params.id}/${Date.now()}-${sanitizedName}`;

        await app.storage.putObject(objectKey, buffer, data.mimetype);

        return reply.code(201).send({ path: objectKey, originalName: data.filename, mimeType: data.mimetype, sizeBytes: buffer.length });
      } catch (error) {
        const known = error as Error;
        return reply.code(400).send({ message: known.message });
      }
    }
  );

  app.post(
    "/:id/submit",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const payload = parseWithSchema(formSchemas.submitDynamicFormInputSchema, request.body);
        const submitted = await service.submitDynamicForm(request.authUser!.id, params.id, payload);
        return reply.code(201).send(submitted);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.get(
    "/:id/responses",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const responses = await service.listDynamicFormResponses(request.authUser!.id, params.id);
        return reply.send(responses);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );

  app.get(
    "/:id/summary",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(formSchemas.dynamicFormIdParamsSchema, request.params);
        const summary = await service.getDynamicFormSummary(request.authUser!.id, params.id);
        return reply.send(summary);
      } catch (error) {
        const known = error as Error;
        const status =
          known.name === "Forbidden"
            ? 403
            : known.message === "Formulario no encontrado"
              ? 404
              : 400;
        return reply.code(status).send({ message: known.message });
      }
    }
  );
};
