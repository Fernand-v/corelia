import type { FastifyInstance } from "fastify";

export class ObjectiveService {
  constructor(private readonly app: FastifyInstance) {}

  async create(input: {
    scope: "EQUIPO" | "PROYECTO";
    teamId?: string | null;
    projectId?: string | null;
    title: string;
    description?: string | null;
    ownerId: string;
    targetDate: string;
    progressPct: number;
  }) {
    return this.app.prisma.objective.create({
      data: {
        scope: input.scope,
        teamId: input.teamId,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        ownerId: input.ownerId,
        targetDate: new Date(input.targetDate),
        progressPct: input.progressPct
      }
    });
  }

  async updateProgress(objectiveId: string, progressPct: number) {
    return this.app.prisma.objective.update({
      where: { id: objectiveId },
      data: { progressPct }
    });
  }

  async linkTask(objectiveId: string, taskId: string) {
    return this.app.prisma.objectiveTask.create({
      data: {
        objectiveId,
        taskId
      }
    });
  }

  async listForUser(userId: string) {
    const teamIds = await this.app.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true }
    });

    return this.app.prisma.objective.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { teamId: { in: teamIds.map((item) => item.teamId) } },
          { project: { members: { some: { userId } } } }
        ]
      },
      include: {
        tasks: true
      },
      orderBy: {
        targetDate: "asc"
      }
    });
  }
}
