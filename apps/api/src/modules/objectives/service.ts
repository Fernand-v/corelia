import type { FastifyInstance } from "fastify";

export class ObjectiveService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";

  constructor(private readonly app: FastifyInstance) {}

  private normalizeLegacyCode(input: {
    code?: string | null | undefined;
    text?: string | null | undefined;
  }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return ObjectiveService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  async create(input: {
    scope: "EQUIPO" | "PROYECTO";
    teamId?: string | null;
    projectId?: string | null;
    title: string;
    description?: string | null;
    descriptionCatalogId?: string;
    ownerId: string;
    targetDate: string;
    progressPct: number;
  }) {
    return this.app.prisma.objective.create({
      data: {
        scope: input.scope,
        teamId: input.teamId ?? null,
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description ?? null,
        descriptionCatalogId: this.normalizeLegacyCode({
          code: input.descriptionCatalogId,
          text: input.description ?? null
        }),
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
