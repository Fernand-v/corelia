import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { ProjectService } from "./service.js";
import { projectSchemas } from "./schema.js";

export const projectsRouter: FastifyPluginAsync = async (app) => {
  const service = new ProjectService(app);

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(projectSchemas.createProjectInputSchema, request.body);
        const project = await service.createProject({
          ...payload,
          ownerId: request.authUser!.id,
          memberIds: payload.memberIds
        });

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: project.id,
          action: "CREAR",
          newDataText: {
            name: project.name,
            template: project.template
          }
        };

        return reply.code(201).send(project);
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
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request) => {
      return service.listProjects(request.authUser!.id);
    }
  );

  app.get(
    "/:projectId/members",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const members = await service.getProjectMembers(params.projectId, request.authUser!.id);
        return reply.send(members);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/:projectId/teams",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const result = await service.listLinkedTeams(request.authUser!.id, params.projectId);
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/:projectId/teams",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(projectSchemas.linkProjectTeamInputSchema, request.body);
        const result = await service.linkTeam(request.authUser!.id, {
          projectId: params.projectId,
          teamId: payload.teamId
        });

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: params.projectId,
          action: "ACTUALIZAR",
          reasonCatalogId: "PROJECT_TEAM_LINK",
          reason: "Vinculación de equipo a proyecto",
          newDataText: {
            teamId: payload.teamId,
            syncedCreated: result.syncedCreated,
            syncedUpdated: result.syncedUpdated
          }
        };

        return reply.code(201).send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/:projectId/teams/:teamId",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectTeamParamsSchema, request.params);
        const result = await service.unlinkTeam(request.authUser!.id, {
          projectId: params.projectId,
          teamId: params.teamId
        });

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: params.projectId,
          action: "ACTUALIZAR",
          reasonCatalogId: "PROJECT_TEAM_UNLINK",
          reason: "Desvinculación de equipo de proyecto",
          newDataText: {
            teamId: params.teamId,
            removedMembers: result.removedMembers
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.get(
    "/:projectId/stages",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const stages = await service.listStages(request.authUser!.id, params.projectId);
        return reply.send(stages);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/:projectId/stages",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(projectSchemas.createProjectStageInputSchema, request.body);
        const stage = await service.createStage(request.authUser!.id, {
          projectId: params.projectId,
          name: payload.name,
          color: payload.color
        });
        return reply.code(201).send(stage);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/stages/:stageId",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.stageIdParamsSchema, request.params);
        const payload = parseWithSchema(projectSchemas.updateProjectStageInputSchema, request.body);
        const stage = await service.updateStage(request.authUser!.id, params.stageId, payload);
        return reply.send(stage);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/stages/:stageId",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.stageIdParamsSchema, request.params);
        const result = await service.deleteStage(request.authUser!.id, params.stageId);
        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );

  app.patch(
    "/:projectId/planning",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(projectSchemas.updateProjectPlanningInputSchema, request.body);
        const project = await service.updateProjectPlanning(
          request.authUser!.id,
          params.projectId,
          payload
        );

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: params.projectId,
          action: "ACTUALIZAR",
          newDataText: {
            startDate: project.startDate?.toISOString() ?? null,
            estimatedEndDate: project.estimatedEndDate?.toISOString() ?? null
          }
        };

        return reply.send(project);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/assign-role",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const payload = parseWithSchema(projectSchemas.assignProjectRoleInputSchema, request.body);
        const member = await service.assignRole(payload);

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: payload.projectId,
          action: "CAMBIO_ROL",
          newDataText: {
            userId: payload.userId,
            roleId: payload.roleId,
            role: (member as { role?: string }).role ?? null
          }
        };

        return reply.send(member);
      } catch (error) {
        throw error;
      }
    }
  );

  app.post(
    "/:projectId/members",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(projectSchemas.upsertProjectMemberInputSchema, request.body);
        let resolvedRoleId = payload.roleId;

        if (!resolvedRoleId && payload.role) {
          const role = await app.prisma.role.findFirst({
            where: {
              OR: [{ key: payload.role }, { code: payload.role }]
            },
            select: {
              id: true
            }
          });

          if (!role) {
            return reply.code(400).send({ message: "Rol inválido para asignación en proyecto" });
          }

          resolvedRoleId = role.id;
        }

        if (!resolvedRoleId) {
          return reply.code(400).send({ message: "Debes enviar roleId o role" });
        }

        const member = await service.addProjectMember(request.authUser!.id, {
          projectId: params.projectId,
          userId: payload.userId,
          roleId: resolvedRoleId
        });

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: params.projectId,
          action: "CAMBIO_ROL",
          newDataText: {
            userId: payload.userId,
            roleId: resolvedRoleId,
            role: (member as { role?: string }).role ?? null
          }
        };

        return reply.send(member);
      } catch (error) {
        throw error;
      }
    }
  );

  app.delete(
    "/:projectId/members/:userId",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "PROYECTOS",
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectMemberParamsSchema, request.params);
        const result = await service.removeProjectMember(
          request.authUser!.id,
          params.projectId,
          params.userId
        );

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: params.projectId,
          action: "ACTUALIZAR",
          newDataText: {
            removedUserId: params.userId
          }
        };

        return reply.send(result);
      } catch (error) {
        throw error;
      }
    }
  );
};
