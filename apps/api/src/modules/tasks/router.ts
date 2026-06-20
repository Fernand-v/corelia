import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { TaskService } from "./service.js";
import { taskSchemas } from "./schema.js";

export const tasksRouter: FastifyPluginAsync = async (app) => {
  const service = new TaskService(app);

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(taskSchemas.taskListQuerySchema, request.query ?? {});
      return service.listTasks(request.authUser!.id, query);
    }
  );

  app.get(
    "/project-members",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_LEER"
      }
    },
    async (request, reply) => {
      const query = parseWithSchema(taskSchemas.projectMembersQuerySchema, request.query ?? {});
      const members = await service.listProjectMembers(request.authUser!.id, query.projectId);
      return reply.send(members);
    }
  );

  app.post(
    "/finalize-and-advance",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_CAMBIAR_ESTADO"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(taskSchemas.finalizeAndAdvanceInputSchema, request.body);
      const result = await service.finalizeAndAdvance({
        ...payload,
        changedById: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        activeRoleRank: request.accessContext!.rank,
        ...(request.accessContext?.projectId !== undefined
          ? { projectContextId: request.accessContext.projectId }
          : {})
      });

      request.auditEvent = {
        entityType: "TAREA",
        entityId: payload.taskId,
        action: "CAMBIO_ESTADO_TAREA",
        reason: payload.reason,
        newDataText: {
          completedTaskId: result.completedTask.id,
          nextTaskId: result.nextTask?.id ?? null
        }
      };

      return reply.send(result);
    }
  );

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(taskSchemas.createTaskInputSchema, request.body);
      const task = await service.createTask({
        ...payload,
        createdById: request.authUser!.id,
        confirmOutOfSchedule: payload.confirmOutOfSchedule ?? false
      });

      request.auditEvent = {
        entityType: "TAREA",
        entityId: task.id,
        action: "CREAR",
        newDataText: {
          title: task.title,
          projectId: task.projectId,
          assigneeId: task.assigneeId
        }
      };

      return reply.code(201).send(task);
    }
  );

  app.get(
    "/:taskId",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_LEER"
      }
    },
    async (request, reply) => {
      const params = parseWithSchema(taskSchemas.taskIdParamsSchema, request.params);
      const task = await service.getTask(params.taskId);
      if (!task) {
        return reply.code(404).send({ message: "Tarea no encontrada" });
      }
      return reply.send(task);
    }
  );

  app.patch(
    "/:taskId/schedule",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_GESTIONAR"
      }
    },
    async (request, reply) => {
      const params = parseWithSchema(taskSchemas.taskIdParamsSchema, request.params);
      const payload = parseWithSchema(taskSchemas.updateTaskScheduleInputSchema, request.body);
      const task = await service.updateSchedule({
        taskId: params.taskId,
        startDate: payload.startDate,
        dueDate: payload.dueDate,
        reason: payload.reason,
        reasonCatalogId: payload.reasonCatalogId,
        changedById: request.authUser!.id,
        activeRoleRank: request.accessContext!.rank,
        ...(request.accessContext?.projectId !== undefined
          ? { projectContextId: request.accessContext.projectId }
          : {})
      });

      request.auditEvent = {
        entityType: "TAREA",
        entityId: params.taskId,
        action: "ACTUALIZAR",
        reason: payload.reason,
        newDataText: {
          startDate: task.startDate,
          dueDate: task.dueDate
        }
      };

      return reply.send(task);
    }
  );

  app.post(
    "/activate",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_CAMBIAR_ESTADO"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(taskSchemas.activateTaskInputSchema, request.body);
      const task = await service.activateTask({
        taskId: payload.taskId,
        reason: payload.reason,
        reasonCatalogId: payload.reasonCatalogId,
        changedById: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        activeRoleRank: request.accessContext!.rank,
        ...(request.accessContext?.projectId !== undefined
          ? { projectContextId: request.accessContext.projectId }
          : {})
      });

      request.auditEvent = {
        entityType: "TAREA",
        entityId: payload.taskId,
        action: "CAMBIO_ESTADO_TAREA",
        reason: payload.reason,
        newDataText: {
          status: task.status,
          activatedManually: true
        }
      };

      return reply.send(task);
    }
  );

  app.post(
    "/status",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_CAMBIAR_ESTADO"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(taskSchemas.taskStatusTransitionInputSchema, request.body);
      const task = await service.changeStatus({
        ...payload,
        changedById: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        activeRoleRank: request.accessContext!.rank,
        ...(request.accessContext?.projectId !== undefined
          ? { projectContextId: request.accessContext.projectId }
          : {})
      });

      request.auditEvent = {
        entityType: "TAREA",
        entityId: payload.taskId,
        action: "CAMBIO_ESTADO_TAREA",
        reason: payload.reason,
        newDataText: {
          status: payload.status,
          blockingTaskId: payload.blockingTaskId,
          blockedReason: payload.blockedReason
        }
      };

      return reply.send(task);
    }
  );

  app.post(
    "/reassign",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_REASIGNAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(taskSchemas.taskReassignmentInputSchema, request.body);
      const task = await service.reassign({
        ...payload,
        requestedById: request.authUser!.id,
        activeRole: request.accessContext!.activeRole,
        activeRoleRank: request.accessContext!.rank,
        ...(request.accessContext?.projectId !== undefined
          ? { projectContextId: request.accessContext.projectId }
          : {})
      });

      request.auditEvent = {
        entityType: "TAREA",
        entityId: payload.taskId,
        action: "REASIGNAR_TAREA",
        reason: payload.reason,
        newDataText: {
          newAssigneeId: payload.newAssigneeId,
          reopenIfCompleted: payload.reopenIfCompleted
        }
      };

      return reply.send(task);
    }
  );

  app.post(
    "/dependencies",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_GESTIONAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(taskSchemas.taskDependencyInputSchema, request.body);
      const dependency = await service.addDependency(payload);
      return reply.code(201).send(dependency);
    }
  );

  app.get(
    "/:taskId/can-start",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TAREAS",
        requiredPermission: "TAREA_LEER"
      }
    },
    async (request) => {
      const params = parseWithSchema(taskSchemas.taskIdParamsSchema, request.params);
      return service.canStart(params.taskId);
    }
  );
};
