import type { FastifyPluginAsync } from "fastify";
import { createUserInputSchema, offboardingInputSchema } from "@corelia/types";
import { parseWithSchema } from "../../lib/validate.js";
import { hashPassword } from "../../lib/password.js";
import { IdentityService } from "./service.js";
import { identitySchemas } from "./schema.js";

export const identityRouter: FastifyPluginAsync = async (app) => {
  const service = new IdentityService(app);

  app.get(
    "/roles",
    {
      config: {
        requiresAuth: true
      }
    },
    async () => service.listAvailableRoles()
  );

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
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(createUserInputSchema, request.body);
      const user = await app.prisma.user.create({
        data: {
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          baseRole: {
            connect: {
              key: payload.baseRole
            }
          },
          passwordHash: await hashPassword(payload.password)
        }
      });

      request.auditEvent = {
        entityType: "USUARIO",
        entityId: user.id,
        action: "CREAR",
        newDataText: {
          id: user.id,
          email: user.email,
          baseRoleId: user.baseRoleId,
          baseRole: payload.baseRole
        }
      };

      return reply.code(201).send({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        baseRoleId: user.baseRoleId,
        baseRole: payload.baseRole
      });
    }
  );

  app.get(
    "/directory",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "IDENTIDAD",
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
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(identitySchemas.userPresenceQuerySchema, request.query ?? {});
      return reply.send(await service.getPresenceForUsers(query.userIds));
    }
  );

  app.get(
    "/teams",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "IDENTIDAD",
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
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(
        identitySchemas.createOnboardingChecklistSchema,
        request.body
      );
      const checklist = await service.createOnboardingChecklist({
        name: payload.name,
        items: payload.items.map((item: (typeof payload.items)[number]) => ({
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
        newDataText: checklist as unknown as Record<string, unknown>
      };

      return reply.code(201).send(checklist);
    }
  );

  app.post(
    "/onboarding/start",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(identitySchemas.onboardingStartSchema, request.body);
      const run = await service.startOnboardingRun(payload);
      request.auditEvent = {
        entityType: "USUARIO",
        entityId: run.userId,
        action: "ACTUALIZAR",
        newDataText: { onboardingRunId: run.id }
      };
      return reply.code(201).send(run);
    }
  );

  app.post(
    "/onboarding/step-complete",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(identitySchemas.onboardingStepCompleteSchema, request.body);
      const step = await service.completeOnboardingStep(payload);
      return reply.send(step);
    }
  );

  app.post(
    "/offboarding",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(offboardingInputSchema, request.body);
      const result = await service.offboard(payload);

      request.auditEvent = {
        entityType: "USUARIO",
        entityId: payload.userId,
        action: "ACTUALIZAR",
        reason: payload.reason,
        newDataText: {
          transferToUserId: payload.transferToUserId,
          archived: payload.archiveHistory
        }
      };

      return reply.send(result);
    }
  );

  app.post(
    "/guest-invites",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "IDENTIDAD",
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(identitySchemas.guestInviteInputSchema, request.body);
      const invite = await service.createGuestInvite({
        email: payload.email,
        resourceScopeType: payload.resourceScopeType,
        resourceScopeId: payload.resourceScopeId,
        expiresAt: payload.expiresAt,
        createdById: request.authUser!.id
      });

      request.auditEvent = {
        entityType: "USUARIO",
        entityId: invite.id,
        action: "CREAR",
        newDataText: {
          email: invite.email,
          resourceScopeType: invite.projectId
            ? "PROYECTO"
            : invite.fileId
              ? "ARCHIVO"
              : "DOCUMENTO",
          expiresAt: invite.expiresAt.toISOString()
        }
      };

      return reply.code(201).send({
        id: invite.id,
        email: invite.email,
        resourceScopeType: invite.projectId
          ? "PROYECTO"
          : invite.fileId
            ? "ARCHIVO"
            : "DOCUMENTO",
        resourceScopeId: invite.projectId ?? invite.fileId ?? invite.documentId ?? "",
        expiresAt: invite.expiresAt
      });
    }
  );
};
