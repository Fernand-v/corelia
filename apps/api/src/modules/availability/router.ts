import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { AvailabilityService } from "./service.js";
import { availabilitySchemas } from "./schema.js";

export const availabilityRouter: FastifyPluginAsync = async (app) => {
  const service = new AvailabilityService(app);

  app.post(
    "/blocks",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(availabilitySchemas.createAvailabilityBlockInputSchema, request.body);
        const block = await service.createBlock(payload);
        return reply.code(201).send(block);
      } catch (error) {
        throw error;
      }
    }
  );

  app.put(
    "/schedule",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(availabilitySchemas.workScheduleSchema, request.body);
        const schedule = await service.upsertSchedule(payload);
        return reply.send(schedule);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/check-assignment",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "TAREA_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          availabilitySchemas.assignmentAvailabilityCheckInputSchema,
          request.body
        );
        const result = await service.checkAssignment(payload);
        if (result.blocked) {
          return reply.code(409).send(result);
        }
        if (!result.allowed) {
          return reply.code(400).send(result);
        }
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );
};
