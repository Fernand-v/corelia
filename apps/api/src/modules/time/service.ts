import type { FastifyInstance } from "fastify";

export class TimeService {
  constructor(private readonly app: FastifyInstance) {}

  private forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  private async resolveTaskProjectId(taskId: string): Promise<string> {
    const task = await this.app.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    return task.projectId;
  }

  private async assertProjectAccess(input: {
    actorId: string;
    projectId: string;
    activeRoleRank: number;
  }): Promise<void> {
    if (input.activeRoleRank >= 5) {
      return;
    }

    const [project, membership] = await Promise.all([
      this.app.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { ownerId: true }
      }),
      this.app.prisma.projectMember.findFirst({
        where: {
          projectId: input.projectId,
          userId: input.actorId
        },
        select: { userId: true }
      })
    ]);

    if (!project || (project.ownerId !== input.actorId && !membership)) {
      throw this.forbidden("No tienes acceso al proyecto de la tarea");
    }
  }

  async createEntry(input: {
    taskId: string;
    userId: string;
    minutes: number;
    note?: string;
    activeRoleRank: number;
  }) {
    const projectId = await this.resolveTaskProjectId(input.taskId);
    await this.assertProjectAccess({
      actorId: input.userId,
      projectId,
      activeRoleRank: input.activeRoleRank
    });

    return this.app.prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        minutes: input.minutes,
        note: input.note ?? null
      }
    });
  }

  async summary(input: {
    actorId: string;
    activeRoleRank: number;
    projectContextId?: string | null;
    taskId?: string;
    projectId?: string;
    userId?: string;
  }) {
    let projectId = input.projectId;

    if (input.taskId) {
      const taskProjectId = await this.resolveTaskProjectId(input.taskId);
      if (projectId && projectId !== taskProjectId) {
        throw this.forbidden("La tarea no pertenece al proyecto indicado");
      }
      projectId = taskProjectId;
    }

    if (projectId) {
      await this.assertProjectAccess({
        actorId: input.actorId,
        projectId,
        activeRoleRank: input.activeRoleRank
      });
    }

    const canViewOtherUsers =
      input.activeRoleRank >= 5 ||
      Boolean(projectId && input.activeRoleRank >= 3 && input.projectContextId === projectId);
    const userId = canViewOtherUsers ? input.userId : (input.userId ?? input.actorId);

    if (!canViewOtherUsers && userId !== input.actorId) {
      throw this.forbidden("No puedes consultar horas de otro usuario");
    }

    const where = {
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(userId ? { userId } : {}),
      ...(projectId
        ? {
            task: {
              projectId
            }
          }
        : {})
    };

    const result = await this.app.prisma.timeEntry.aggregate({
      where,
      _sum: {
        minutes: true
      }
    });

    return {
      taskId: input.taskId,
      projectId,
      userId,
      totalMinutes: result._sum.minutes ?? 0
    };
  }
}
