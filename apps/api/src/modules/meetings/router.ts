import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { MeetingsService } from "./service.js";
import { meetingsSchemas } from "./schema.js";

export const meetingsRouter: FastifyPluginAsync = async (app) => {
  const service = new MeetingsService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(meetingsSchemas.createMeetingInputSchema, request.body);
        const created = await service.createMeeting({
          ...payload,
          createdById: request.authUser!.id
        });

        request.auditEvent = {
          entityType: "REUNION",
          entityId: created.meeting.id,
          action: "PROGRAMAR_REUNION",
          newDataText: {
            title: created.meeting.title,
            projectId: created.meeting.projectId,
            teamId: created.meeting.teamId,
            startsAt: created.meeting.startsAt,
            endsAt: created.meeting.endsAt
          }
        };

        return reply.code(201).send(created);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(meetingsSchemas.listMeetingsQuerySchema, request.query);
        const meetings = await service.listMeetings({
          ...query,
          userId: request.authUser!.id
        });
        return reply.send(meetings);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/:meetingId",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(meetingsSchemas.meetingIdParamsSchema, request.params);
        const meeting = await service.getMeeting(params.meetingId, request.authUser!.id);
        return reply.send(meeting);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/:meetingId/notes",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(meetingsSchemas.meetingIdParamsSchema, request.params);
        const payload = parseWithSchema(meetingsSchemas.addMeetingNoteInputSchema, {
          ...(request.body as Record<string, unknown>),
          meetingId: params.meetingId
        });
        const note = await service.addNote({
          meetingId: payload.meetingId,
          content: payload.content,
          userId: request.authUser!.id
        });
        return reply.code(201).send(note);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/:meetingId/agreements",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(meetingsSchemas.meetingIdParamsSchema, request.params);
        const payload = parseWithSchema(meetingsSchemas.createMeetingAgreementInputSchema, {
          ...(request.body as Record<string, unknown>),
          meetingId: params.meetingId
        });
        const agreement = await service.createAgreement({
          meetingId: payload.meetingId,
          userId: request.authUser!.id,
          title: payload.title,
          description: payload.description,
          descriptionCatalogId: payload.descriptionCatalogId,
          existingTaskId: payload.existingTaskId,
          createTask: payload.createTask
        });

        request.auditEvent = {
          entityType: "ACUERDO_REUNION",
          entityId: agreement.id,
          action: "REGISTRAR_ACUERDO",
          newDataText: {
            meetingId: agreement.meetingId,
            title: agreement.title,
            taskId: agreement.taskId
          }
        };

        return reply.code(201).send(agreement);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/:meetingId/status",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(meetingsSchemas.meetingIdParamsSchema, request.params);
        const payload = parseWithSchema(meetingsSchemas.updateMeetingStatusSchema, request.body);
        const updated = await service.updateStatus({
          meetingId: params.meetingId,
          status: payload.status,
          userId: request.authUser!.id
        });
        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/:meetingId/follow-up",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(meetingsSchemas.meetingIdParamsSchema, request.params);
        const pending = await service.listPendingFollowUp(params.meetingId, request.authUser!.id);
        return reply.send(pending);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/:meetingId/media/capabilities",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "REUNIONES",
        requiredPermission: "REUNION_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(meetingsSchemas.meetingIdParamsSchema, request.params);
        const capabilities = await service.getMediaCapabilities(
          params.meetingId,
          request.authUser!.id
        );
        return reply.send(capabilities);
      } catch (error) {
        throw error;
      }
    }
  );
};
