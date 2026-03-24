import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { idSchema } from "@corelia/types";
import { parseWithSchema } from "../../lib/validate.js";
import { AdminService } from "./service.js";
import { adminSchemas } from "./schema.js";

const idParamsSchema = z.object({
  id: idSchema
});

const codeCatalogParamsSchema = z.object({
  domain: z.enum(["TASK", "PROJECT", "TEAM", "MEETING", "OBJECTIVE", "DECISION", "IDENTITY", "AUDIT"]),
  id: idSchema
});
const FRONTEND_SETTINGS_ENTITY_ID = "33333333-3333-4333-8333-333333333333";
const DATABASE_BACKUP_ENTITY_ID = "44444444-4444-4444-8444-444444444444";

export const adminRouter: FastifyPluginAsync = async (app) => {
  const service = new AdminService(app);

  app.get(
    "/users",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminUsersQuerySchema, request.query ?? {});
        return reply.send(
          await service.listUsers(request.authUser!.id, {
            search: query.search,
            role: query.role,
            teamId: query.teamId,
            state: query.state
          })
        );
      } catch (error) {
        throw error;
      }
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
        const payload = parseWithSchema(adminSchemas.adminCreateUserInputSchema, request.body);
        const created = await service.createUser(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: created.id,
          action: "CREAR",
          newDataText: {
            email: created.email,
            role: created.baseRole
          }
        };

        return reply.code(201).send(created);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/users/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminUpdateUserInputSchema, request.body);
        const updated = await service.updateUser(request.authUser!.id, params.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: payload as unknown as Record<string, unknown>
        };

        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/offboarding/preview",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminOffboardingPreviewInputSchema, request.body);
        const preview = await service.previewOffboarding(request.authUser!.id, payload.userId);
        return reply.send(preview);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/offboarding/execute",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminOffboardingExecuteInputSchema, request.body);
        const result = await service.executeOffboarding(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: payload.userId,
          action: "ACTUALIZAR",
          reason: payload.reason,
          newDataText: {
            primaryTransferToUserId: payload.primaryTransferToUserId,
            result
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/signup-requests",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminSignupRequestsQuerySchema, request.query ?? {});
        return reply.send(
          await service.listSignupRequests(request.authUser!.id, {
            status: query.status
          })
        );
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/signup-requests/:id/approve",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminApproveSignupRequestInputSchema, request.body ?? {});
        const result = await service.approveSignupRequest(request.authUser!.id, params.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          reasonCatalogId: "SIGNUP_REQUEST_APPROVE",
          newDataText: {
            status: result.status,
            inviteId: result.inviteId
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/signup-requests/:id/reject",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminRejectSignupRequestInputSchema, request.body);
        const result = await service.rejectSignupRequest(request.authUser!.id, params.id, payload.reason);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          reasonCatalogId: "SIGNUP_REQUEST_REJECT",
          reason: payload.reason,
          newDataText: {
            status: result.status
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/internal-invites",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const result = await service.listInternalInvites(request.authUser!.id);
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/internal-invites",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminCreateInternalInviteInputSchema, request.body);
        const invite = await service.createInternalInvite(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: invite.id,
          action: "CREAR",
          newDataText: {
            email: invite.email,
            role: invite.baseRole,
            teamId: invite.teamId
          }
        };

        return reply.code(201).send(invite);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/internal-invites/:id/revoke",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const result = await service.revokeInternalInvite(request.authUser!.id, params.id);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: {
            revokedAt: result.revokedAt
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/internal-invites/:id/resend",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminResendInternalInviteInputSchema, request.body ?? {});
        const result = await service.resendInternalInvite(
          request.authUser!.id,
          params.id,
          payload.expiresAt
        );

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: {
            expiresAt: result.expiresAt
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/guest-invites",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const result = await service.listGuestInvites(request.authUser!.id);
        return reply.send(result);
      } catch (error) {
        throw error;
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
        const payload = parseWithSchema(adminSchemas.adminCreateExternalInviteInputSchema, request.body);
        const invite = await service.createGuestInvite(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: invite.id,
          action: "CREAR",
          newDataText: {
            email: invite.email,
            resourceScopeType: invite.resourceScopeType,
            resourceScopeId: invite.resourceScopeId
          }
        };

        return reply.code(201).send(invite);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/guest-invites/:id/revoke",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const result = await service.revokeGuestInvite(request.authUser!.id, params.id);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: {
            revokedAt: result.revokedAt
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/guest-invites/:id/extend",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminExtendInviteInputSchema, request.body);
        const result = await service.extendGuestInvite(request.authUser!.id, params.id, payload.expiresAt);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: {
            expiresAt: result.expiresAt
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/teams",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const teams = await service.listTeams(request.authUser!.id);
        return reply.send(teams);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/teams",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminCreateTeamInputSchema, request.body);
        const team = await service.createTeam(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: team.id,
          action: "CREAR",
          newDataText: {
            name: team.name
          }
        };

        return reply.code(201).send(team);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/teams/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const team = await service.getTeam(request.authUser!.id, params.id);
        return reply.send(team);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/teams/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminUpdateTeamInputSchema, request.body);
        const result = await service.updateTeam(request.authUser!.id, params.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: payload as unknown as Record<string, unknown>
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/teams/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const result = await service.dissolveTeam(request.authUser!.id, params.id);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ELIMINAR"
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/frontend-settings",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.getFrontendSettings(request.authUser!.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/frontend-settings",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminUpdateFrontendSettingsInputSchema, request.body ?? {});
        const updated = await service.updateFrontendSettings(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: FRONTEND_SETTINGS_ENTITY_ID,
          action: "ACTUALIZAR",
          newDataText: payload as unknown as Record<string, unknown>
        };

        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/frontend-settings/reset",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const updated = await service.resetFrontendSettings(request.authUser!.id);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: FRONTEND_SETTINGS_ENTITY_ID,
          action: "ACTUALIZAR",
          reasonCatalogId: "FRONTEND_SETTINGS_RESET",
          reason: "Restauración de configuración visual por defecto",
          newDataText: {
            reset: true
          }
        };

        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/system-status",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.getSystemStatus(request.authUser!.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/system-status/check",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const result = await service.checkSystemStatus(request.authUser!.id);
        if (result.auditEvent) {
          request.auditEvent = result.auditEvent;
        }
        return reply.send({
          now: result.now,
          overallStatus: result.overallStatus,
          maintenance: result.maintenance,
          services: result.services,
          changed: result.changed,
          changedServices: result.changedServices,
          auditLogged: result.auditLogged,
          recentChanges: result.recentChanges
        });
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/roles",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.listRoles(request.authUser!.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/roles/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(adminSchemas.adminRoleIdParamsSchema, request.params);
        return reply.send(await service.getRole(request.authUser!.id, params.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/roles",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminCreateRoleInputSchema, request.body);
        const role = await service.createRole(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: role.id,
          action: "CREAR",
          newDataText: {
            roleId: role.id,
            role: role.code,
            displayName: role.displayName
          }
        };

        return reply.code(201).send(role);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/roles/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(adminSchemas.adminRoleIdParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminUpdateRoleInputSchema, request.body);
        const role = await service.updateRole(request.authUser!.id, params.id, payload);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: role.id,
          action: "ACTUALIZAR",
          newDataText: payload as unknown as Record<string, unknown>
        };

        return reply.send(role);
      } catch (error) {
        throw error;
      }
    }
  );

  app.put(
    "/roles/:id/permissions",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(adminSchemas.adminRoleIdParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminReplaceRolePermissionsInputSchema, request.body);
        const role = await service.replaceRolePermissions(
          request.authUser!.id,
          params.id,
          payload.permissionCodes
        );

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "CAMBIO_PERMISO",
          newDataText: {
            permissionCodes: payload.permissionCodes
          }
        };

        return reply.send(role);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/roles/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(adminSchemas.adminRoleIdParamsSchema, request.params);
        const result = await service.deleteRole(request.authUser!.id, params.id);

        request.auditEvent = {
          entityType: "USUARIO",
          entityId: params.id,
          action: "ELIMINAR"
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/permissions",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.listPermissions(request.authUser!.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/permission-categories",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.listPermissionCategories(request.authUser!.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/roles-matrix",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.getRolesMatrix(request.authUser!.id));
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/access",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminAccessByResourceQuerySchema, request.query ?? {});
        return reply.send(await service.getAccessByResource(request.authUser!.id, query));
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/code-catalogs",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminListCodeCatalogsQuerySchema, request.query ?? {});
        const result = await service.listCodeCatalogs(request.authUser!.id, query);
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/code-catalogs",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminCreateCodeCatalogInputSchema, request.body);
        const created = await service.createCodeCatalog(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: created.id,
          action: "CREAR",
          newDataText: {
            domain: payload.domain,
            field: payload.field,
            code: payload.code
          }
        };

        return reply.code(201).send(created);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/code-catalogs/:domain/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(codeCatalogParamsSchema, request.params);
        const payload = parseWithSchema(adminSchemas.adminUpdateCodeCatalogInputSchema, request.body);
        const updated = await service.updateCodeCatalog(
          request.authUser!.id,
          params.domain,
          params.id,
          payload
        );

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: {
            domain: params.domain,
            ...payload
          }
        };

        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/code-catalogs/:domain/:id",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(codeCatalogParamsSchema, request.params);
        const updated = await service.deactivateCodeCatalog(request.authUser!.id, params.domain, params.id);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: params.id,
          action: "ACTUALIZAR",
          newDataText: {
            domain: params.domain,
            isActive: false
          }
        };

        return reply.send(updated);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/audit-report",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminAuditReportQuerySchema, request.query ?? {});
        const result = await service.getAuditReport(request.authUser!.id, {
          from: query.from,
          to: query.to,
          page: query.page,
          pageSize: query.pageSize
        });
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/database-backup",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminDatabaseBackupInputSchema, request.body ?? {});
        const backup = await service.createDatabaseBackup(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: DATABASE_BACKUP_ENTITY_ID,
          action: "CREAR",
          reasonCatalogId: "DATABASE_BACKUP_EXPORT",
          reason: "Backup de base de datos generado desde panel administrador",
          newDataText: {
            fileName: backup.fileName
          }
        };

        reply.header("Content-Type", backup.contentType);
        reply.header("Content-Disposition", `attachment; filename="${backup.fileName}"`);
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Cache-Control", "no-store");
        return reply.send(backup.content);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/audit-report/export.csv",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminAuditReportExportQuerySchema, request.query ?? {});
        const result = await service.exportAuditReportCsv(request.authUser!.id, {
          from: query.from,
          to: query.to
        });
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header(
          "Content-Disposition",
          `attachment; filename="audit-report-${result.from.slice(0, 10)}-${result.to.slice(0, 10)}.csv"`
        );
        return reply.send(result.csv);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/maintenance/backfill-project-general-channels",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(
          adminSchemas.adminBackfillProjectChannelsInputSchema,
          request.body ?? {}
        );
        const result = await service.backfillProjectGeneralChannels(request.authUser!.id, payload);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: "22222222-2222-4222-8222-222222222222",
          action: "ACTUALIZAR",
          reasonCatalogId: "PROJECT_GENERAL_CHANNELS_BACKFILL",
          reason: payload.dryRun
            ? "Simulación de backfill de canales generales por proyecto"
            : "Backfill de canales generales por proyecto",
          newDataText: result as unknown as Record<string, unknown>
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/overview",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "USUARIO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.paginationSchema, request.query ?? {});
        return reply.send(
          await service.getOverview(request.authUser!.id, {
            page: query.page,
            pageSize: query.pageSize
          })
        );
      } catch (error) {
        throw error;
      }
    }
  );
};
