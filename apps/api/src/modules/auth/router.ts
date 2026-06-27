import type { FastifyPluginAsync } from "fastify";
import { AuthService } from "./service.js";
import { authSchemas } from "./schema.js";
import { parseWithSchema } from "../../lib/validate.js";
import { env } from "../../config/env.js";

const REFRESH_COOKIE = "corelia_refresh";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: REFRESH_COOKIE_PATH,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
};

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
    }
  );

  app.post(
    "/login",
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
      const payload = parseWithSchema(authSchemas.loginInputSchema, request.body);
      const { refreshToken, ...tokens } = await service.login(payload);
      reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
      request.auditEvent = {
        entityType: "USUARIO",
        entityId: tokens.userId,
        action: "LOGIN"
      };
      return reply.send(tokens);
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
      const payload = parseWithSchema(authSchemas.activateInviteInputSchema, request.body);
      const { refreshToken, ...tokens } = await service.activateInternalInvite(payload);
      reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
      request.auditEvent = {
        entityType: "USUARIO",
        entityId: tokens.userId,
        action: "CREAR",
        newDataText: {
          source: "INTERNAL_INVITE_ACTIVATION"
        }
      };
      return reply.send(tokens);
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
      const payload = parseWithSchema(authSchemas.refreshInputSchema, request.body ?? {});
      const presentedToken = request.cookies[REFRESH_COOKIE] ?? payload.refreshToken;
      if (!presentedToken) {
        return reply.code(401).send({ message: "Refresh token requerido" });
      }
      const { refreshToken, ...tokens } = await service.refresh({ refreshToken: presentedToken });
      reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
      return reply.send(tokens);
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
      const payload = parseWithSchema(authSchemas.logoutInputSchema, request.body ?? {});
      const presentedToken = request.cookies[REFRESH_COOKIE] ?? payload.refreshToken;
      reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      if (!presentedToken) {
        return reply.code(204).send();
      }
      const userId = await service.logout({ refreshToken: presentedToken });
      if (userId) {
        request.auditEvent = {
          entityType: "USUARIO",
          entityId: userId,
          action: "LOGOUT"
        };
      }
      return reply.code(204).send();
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
    }
  );

  app.post(
    "/admin-reset-password",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "ADMINISTRACION",
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes"
        }
      }
    },
    async (request, reply) => {
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
      const summary = await service.getMembershipSummary(request.authUser!.id);
      return reply.send(summary);
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

      // Ítems de navegación dinámicos: programas del rol marcados como menú en
      // DB (route/icon/orden). Permite añadir entradas al menú sin tocar código.
      const programCodes = request.accessContext?.programs ?? [];
      const navPrograms =
        programCodes.length > 0
          ? await request.server.prisma.program.findMany({
              where: { key: { in: programCodes }, isNavItem: true, isActive: true, route: { not: null } },
              select: { key: true, displayName: true, route: true, icon: true, navOrder: true },
              orderBy: [{ navOrder: "asc" }, { displayName: "asc" }]
            })
          : [];

      return reply.send({
        ...user,
        baseRole: baseRoleKey,
        activeRole: request.accessContext?.activeRole,
        roleDisplayName: request.accessContext?.roleDisplayName,
        activeRoleRank: request.accessContext?.rank,
        programs: programCodes,
        permissions: request.accessContext?.permissions ?? [],
        navItems: navPrograms.map((program) => ({
          program: program.key,
          label: program.displayName,
          href: program.route,
          icon: program.icon,
          navOrder: program.navOrder
        }))
      });
    }
  );
};
