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
          newData: {
            name: project.name,
            template: project.template
          }
        };

        return reply.code(201).send(project);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
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
        requiredPermission: "PROYECTO_LEER"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const members = await service.getProjectMembers(params.projectId, request.authUser!.id);
        return reply.send(members);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/assign-role",
    {
      config: {
        requiresAuth: true,
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
          newData: {
            userId: payload.userId,
            role: payload.role
          }
        };

        return reply.send(member);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/:projectId/members",
    {
      config: {
        requiresAuth: true,
        requiredPermission: "PROYECTO_GESTIONAR"
      }
    },
    async (request, reply) => {
      try {
        const params = parseWithSchema(projectSchemas.projectIdParamsSchema, request.params);
        const payload = parseWithSchema(projectSchemas.upsertProjectMemberInputSchema, request.body);
        const member = await service.addProjectMember(request.authUser!.id, {
          projectId: params.projectId,
          userId: payload.userId,
          role: payload.role
        });

        request.auditEvent = {
          entityType: "PROYECTO",
          entityId: params.projectId,
          action: "CAMBIO_ROL",
          newData: {
            userId: payload.userId,
            role: payload.role
          }
        };

        return reply.send(member);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );

  app.delete(
    "/:projectId/members/:userId",
    {
      config: {
        requiresAuth: true,
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
          newData: {
            removedUserId: params.userId
          }
        };

        return reply.send(result);
      } catch (error) {
        const status = (error as Error).name === "Forbidden" ? 403 : 400;
        return reply.code(status).send({ message: (error as Error).message });
      }
    }
  );
};
