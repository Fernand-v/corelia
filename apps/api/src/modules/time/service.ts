import type { FastifyInstance } from "fastify";

export class TimeService {
  constructor(private readonly app: FastifyInstance) {}

  async createEntry(input: { taskId: string; userId: string; minutes: number; note?: string }) {
    return this.app.prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        minutes: input.minutes,
        note: input.note ?? null
      }
    });
  }

  async summary(input: { taskId?: string; projectId?: string; userId?: string }) {
    const where = {
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.projectId
        ? {
            task: {
              projectId: input.projectId
            }
          }
        : {})
    };

    const rows = await this.app.prisma.timeEntry.findMany({ where });
    const totalMinutes = rows.reduce((acc, item) => acc + item.minutes, 0);

    return {
      ...input,
      totalMinutes
    };
  }
}
