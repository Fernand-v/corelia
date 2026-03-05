import type { FastifyPluginAsync } from "fastify";
import { createUserInputSchema } from "@corelia/types";
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
    async (request, reply) => {
      try {
        const payload = parseWithSchema(createUserInputSchema, request.body);
        const user = await service.register(payload);
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: user.id,
          action: "CREAR",
          newData: user
        };
        return reply.code(201).send(user);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
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
        return reply.code(401).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/activate-invite",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
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
          newData: {
            source: "INTERNAL_INVITE_ACTIVATION"
          }
        };
        return reply.send(tokens);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/refresh",
    {
      config: {
        requiresAuth: false,
        skipMaintenance: true
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(authSchemas.refreshInputSchema, request.body);
        const tokens = await service.refresh(payload);
        return reply.send(tokens);
      } catch (error) {
        return reply.code(401).send({ message: (error as Error).message });
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
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/change-password",
    {
      config: {
        requiresAuth: true
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
          reasonCode: "PASSWORD_CHANGE",
          reason: "Cambio de contraseña desde perfil",
          newData: {
            passwordChanged: true,
            source: "PROFILE_MODAL"
          }
        };
        return reply.send(result);
      } catch (error) {
        const message = (error as Error).message;
        const status = message === "La contraseña actual no es válida" ? 401 : 400;
        return reply.code(status).send({ message });
      }
    }
  );

  app.post(
    "/admin-reset-password",
    {
      config: {
        requiresAuth: true
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
          newData: {
            passwordResetBy: request.authUser!.id
          }
        };
        return reply.send(result);
      } catch (error) {
        const knownError = error as Error;
        let status = 400;
        if (knownError.name === "Forbidden") {
          status = 403;
        } else if (knownError.message === "Usuario objetivo no encontrado") {
          status = 404;
        }
        return reply.code(status).send({ message: knownError.message });
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
        return reply.code(400).send({ message: (error as Error).message });
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
        where: { id: request.authUser?.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          baseRole: true,
          isActive: true
        }
      });

      if (!user) {
        return reply.code(404).send({ message: "Usuario no encontrado" });
      }

      return reply.send({
        ...user,
        activeRole: request.accessContext?.activeRole
      });
    }
  );
};
