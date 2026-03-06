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

export const adminRouter: FastifyPluginAsync = async (app) => {
  const service = new AdminService(app);

  app.get(
    "/users",
    {
      config: {
        requiresAuth: true
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
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/users",
    {
      config: {
        requiresAuth: true
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
          newData: {
            email: created.email,
            role: created.baseRole
          }
        };

        return reply.code(201).send(created);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/users/:id",
    {
      config: {
        requiresAuth: true
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
          newData: payload as unknown as Record<string, unknown>
        };

        return reply.send(updated);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/offboarding/preview",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(adminSchemas.adminOffboardingPreviewInputSchema, request.body);
        const preview = await service.previewOffboarding(request.authUser!.id, payload.userId);
        return reply.send(preview);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/offboarding/execute",
    {
      config: {
        requiresAuth: true
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
          newData: {
            primaryTransferToUserId: payload.primaryTransferToUserId,
            result
          }
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/internal-invites",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const result = await service.listInternalInvites(request.authUser!.id);
        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/internal-invites",
    {
      config: {
        requiresAuth: true
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
          newData: {
            email: invite.email,
            role: invite.baseRole,
            teamId: invite.teamId
          }
        };

        return reply.code(201).send(invite);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/internal-invites/:id/revoke",
    {
      config: {
        requiresAuth: true
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
          newData: {
            revokedAt: result.revokedAt
          }
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/internal-invites/:id/resend",
    {
      config: {
        requiresAuth: true
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
          newData: {
            expiresAt: result.expiresAt
          }
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/guest-invites",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const result = await service.listGuestInvites(request.authUser!.id);
        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/guest-invites",
    {
      config: {
        requiresAuth: true
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
          newData: {
            email: invite.email,
            resourceType: invite.resourceType,
            resourceId: invite.resourceId
          }
        };

        return reply.code(201).send(invite);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/guest-invites/:id/revoke",
    {
      config: {
        requiresAuth: true
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
          newData: {
            revokedAt: result.revokedAt
          }
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/guest-invites/:id/extend",
    {
      config: {
        requiresAuth: true
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
          newData: {
            expiresAt: result.expiresAt
          }
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/teams",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const teams = await service.listTeams(request.authUser!.id);
        return reply.send(teams);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/teams",
    {
      config: {
        requiresAuth: true
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
          newData: {
            name: team.name
          }
        };

        return reply.code(201).send(team);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/teams/:id",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(idParamsSchema, request.params);
        const team = await service.getTeam(request.authUser!.id, params.id);
        return reply.send(team);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/teams/:id",
    {
      config: {
        requiresAuth: true
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
          newData: payload as unknown as Record<string, unknown>
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.delete(
    "/teams/:id",
    {
      config: {
        requiresAuth: true
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
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/frontend-settings",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.getFrontendSettings(request.authUser!.id));
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/frontend-settings",
    {
      config: {
        requiresAuth: true
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
          newData: payload as unknown as Record<string, unknown>
        };

        return reply.send(updated);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/frontend-settings/reset",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const updated = await service.resetFrontendSettings(request.authUser!.id);

        request.auditEvent = {
          entityType: "AUTOMATIZACION",
          entityId: FRONTEND_SETTINGS_ENTITY_ID,
          action: "ACTUALIZAR",
          reasonCode: "FRONTEND_SETTINGS_RESET",
          reason: "Restauración de configuración visual por defecto",
          newData: {
            reset: true
          }
        };

        return reply.send(updated);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/system-status",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.getSystemStatus(request.authUser!.id));
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/system-status/check",
    {
      config: {
        requiresAuth: true
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
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/roles-matrix",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        return reply.send(await service.getRolesMatrix(request.authUser!.id));
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/access",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminAccessByResourceQuerySchema, request.query ?? {});
        return reply.send(await service.getAccessByResource(request.authUser!.id, query));
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/code-catalogs",
    {
      config: {
        requiresAuth: true
      }
    },
    async (request, reply) => {
      try {
        const query = parseWithSchema(adminSchemas.adminListCodeCatalogsQuerySchema, request.query ?? {});
        const result = await service.listCodeCatalogs(request.authUser!.id, query);
        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/code-catalogs",
    {
      config: {
        requiresAuth: true
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
          newData: {
            domain: payload.domain,
            field: payload.field,
            code: payload.code
          }
        };

        return reply.code(201).send(created);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/code-catalogs/:domain/:id",
    {
      config: {
        requiresAuth: true
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
          newData: {
            domain: params.domain,
            ...payload
          }
        };

        return reply.send(updated);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.delete(
    "/code-catalogs/:domain/:id",
    {
      config: {
        requiresAuth: true
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
          newData: {
            domain: params.domain,
            isActive: false
          }
        };

        return reply.send(updated);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/audit-report",
    {
      config: {
        requiresAuth: true
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
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/audit-report/export.csv",
    {
      config: {
        requiresAuth: true
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
          `attachment; filename=\"audit-report-${result.from.slice(0, 10)}-${result.to.slice(0, 10)}.csv\"`
        );
        return reply.send(result.csv);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/maintenance/backfill-project-general-channels",
    {
      config: {
        requiresAuth: true
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
          reasonCode: "PROJECT_GENERAL_CHANNELS_BACKFILL",
          reason: payload.dryRun
            ? "Simulación de backfill de canales generales por proyecto"
            : "Backfill de canales generales por proyecto",
          newData: result as unknown as Record<string, unknown>
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/overview",
    {
      config: {
        requiresAuth: true
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
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );
};
