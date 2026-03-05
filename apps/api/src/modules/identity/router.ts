import type { FastifyPluginAsync } from "fastify";
import { createUserInputSchema, offboardingInputSchema } from "@corelia/types";
import { parseWithSchema } from "../../lib/validate.js";
import { hashPassword } from "../../lib/password.js";
import { IdentityService } from "./service.js";
import { identitySchemas } from "./schema.js";

export const identityRouter: FastifyPluginAsync = async (app) => {
  const service = new IdentityService(app);

  app.get(
    "/active-role",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request) => {
      const projectId = (request.query as { projectId?: string } | undefined)?.projectId;
      return service.resolveActiveRole(request.authUser!.id, projectId);
    }
  );

  app.post(
    "/users",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(createUserInputSchema, request.body);
        const user = await app.prisma.user.create({
          data: {
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            baseRole: payload.baseRole,
            passwordHash: await hashPassword(payload.password)
          }
        });

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: user.id,
          action: "CREAR",
          newData: {
            id: user.id,
            email: user.email,
            baseRole: user.baseRole
          }
        };

        return reply.code(201).send({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          baseRole: user.baseRole
        });
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/directory",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async () => service.getDirectory()
  );

  app.get(
    "/presence",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(identitySchemas.userPresenceQuerySchema, request.query ?? {});
        return reply.send(await service.getPresenceForUsers(query.userIds));
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/teams",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request) => service.listTeamsForUser(request.authUser!.id)
  );

  app.post(
    "/onboarding/checklists",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          identitySchemas.createOnboardingChecklistSchema,
          request.body
        );
        const checklist = await service.createOnboardingChecklist({
          name: payload.name,
          items: payload.items.map((item) => ({
            key: item.key,
            label: item.label,
            required: item.required,
            order: item.order
          }))
        });

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: checklist.id,
          action: "CREAR",
          newData: checklist as unknown as Record<string, unknown>
        };

        return reply.code(201).send(checklist);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/onboarding/start",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(identitySchemas.onboardingStartSchema, request.body);
        const run = await service.startOnboardingRun(payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: run.userId,
          action: "ACTUALIZAR",
          newData: { onboardingRunId: run.id }
        };
        return reply.code(201).send(run);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/onboarding/step-complete",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(identitySchemas.onboardingStepCompleteSchema, request.body);
        const step = await service.completeOnboardingStep(payload);
        return reply.send(step);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/offboarding",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(offboardingInputSchema, request.body);
        const result = await service.offboard(payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: payload.userId,
          action: "ACTUALIZAR",
          reason: payload.reason,
          newData: {
            transferToUserId: payload.transferToUserId,
            archived: payload.archiveHistory
          }
        };

        return reply.send(result);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/guest-invites",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(identitySchemas.guestInviteInputSchema, request.body);
        const invite = await service.createGuestInvite({
          email: payload.email,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,
          expiresAt: payload.expiresAt,
          createdById: request.authUser!.id
        });

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: invite.id,
          action: "CREAR",
          newData: {
            email: invite.email,
            resourceType: invite.resourceType,
            expiresAt: invite.expiresAt.toISOString()
          }
        };

        return reply.code(201).send({
          id: invite.id,
          email: invite.email,
          resourceType: invite.resourceType,
          resourceId: invite.resourceId,
          expiresAt: invite.expiresAt
        });
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );
};
