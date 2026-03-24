import type { FastifyPluginAsync } from "fastify";
import { AuthService } from "./service.js";
import { authSchemas } from "./schema.js";
import { parseWithSchema } from "../../lib/validate.js";

export const authRouter: FastifyPluginAsync = async (app) => {
  const service = new AuthService(app);

  app.post(
    "/register",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async (_request, reply) =>
      reply.code(410).send({
        message: "El registro directo está deshabilitado. Envía una solicitud en /api/v1/auth/register-request."
      })
  );

  app.post(
    "/register-request",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true,
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.registerRequestInputSchema, request.body);
        const created = await service.createSignupRequest(payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: created.id,
          action: "CREAR",
          reasonCatalogId: "SIGNUP_REQUEST",
          newDataText: {
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName
          }
        };
        return reply.code(201).send(created);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/login",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true,
        rateLimit: {
          max: 10,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.loginInputSchema, request.body);
        const tokens = await service.login(payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: tokens.userId,
          action: "LOGIN"
        };
        return reply.send(tokens);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/activate-invite",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true,
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.activateInviteInputSchema, request.body);
        const tokens = await service.activateInternalInvite(payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: tokens.userId,
          action: "CREAR",
          newDataText: {
            source: "INTERNAL_INVITE_ACTIVATION"
          }
        };
        return reply.send(tokens);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/refresh",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true,
        rateLimit: {
          max: 20,
          timeWindow: "5 minutes"
        }
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.refreshInputSchema, request.body);
        const tokens = await service.refresh(payload);
        return reply.send(tokens);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/logout",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.logoutInputSchema, request.body);
        const userId = await service.logout(payload);
        if (userId) {
          request.auditEvent = {
            entityType: "USUARIO",
            entityId: userId,
            action: "LOGOUT"
          };
        }
        return reply.code(204).send();
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/change-password",
    {
      config: {
        requiresAuth: true,
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes"
        }
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.changePasswordInputSchema, request.body);
        const result = await service.changePassword(request.authUser!.id, payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: request.authUser!.id,
          action: "ACTUALIZAR",
          reasonCatalogId: "PASSWORD_CHANGE",
          reason: "Cambio de contraseña desde perfil",
          newDataText: {
            passwordChanged: true,
            source: "PROFILE_MODAL"
          }
        };
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/admin-reset-password",
    {
      config: {
        requiresAuth: true,
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes"
        }
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.adminResetPasswordInputSchema, request.body);
        const result = await service.adminResetPassword(request.authUser!.id, payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: payload.userId,
          action: "ACTUALIZAR",
          newDataText: {
            passwordResetBy: request.authUser!.id
          }
        };
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/memberships",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const summary = await service.getMembershipSummary(request.authUser!.id);
        return reply.send(summary);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/me",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.authUser!.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          baseRole: {
            select: {
              key: true
            }
          },
          isActive: true
        }
      });

      if (!user) {
        return reply.code(404).send({ message: "Usuario no encontrado" });
      }

      const baseRoleKey = user.baseRole?.key ?? request.accessContext?.activeRole ?? "INVITADO_EXTERNO";

      return reply.send({
        ...user,
        baseRole: baseRoleKey,
        activeRole: request.accessContext?.activeRole,
        permissions: request.accessContext?.permissions ?? []
      });
    }
  );
};
