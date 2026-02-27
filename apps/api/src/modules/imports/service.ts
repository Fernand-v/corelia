import type { FastifyInstance } from "fastify";

export class ImportService {
  constructor(private readonly app: FastifyInstance) {}

  async createJob(input: { source: "CSV" | "TRELLO_JSON" | "NOTION_CSV"; filename: string; createdById: string }) {
    return this.app.prisma.importJob.create({
      data: {
        source: input.source,
        filename: input.filename,
        createdById: input.createdById
      }
    });
  }

  async addErrors(input: { jobId: string; errors: Array<{ row: number; field: string; message: string }> }) {
    await this.app.prisma.importError.createMany({
      data: input.errors.map((error) => ({
        jobId: input.jobId,
        rowNumber: error.row,
        field: error.field,
        message: error.message
      }))
    });

    await this.app.prisma.importJob.update({
      where: { id: input.jobId },
      data: { success: false, finishedAt: new Date() }
    });

    return { success: true };
  }

  async completeJob(jobId: string) {
    return this.app.prisma.importJob.update({
      where: { id: jobId },
      data: {
        success: true,
        finishedAt: new Date()
      }
    });
  }

  async report(jobId: string) {
    const errors = await this.app.prisma.importError.findMany({
      where: { jobId },
      orderBy: [{ rowNumber: "asc" }, { field: "asc" }]
    });

    return {
      jobId,
      errors: errors.map((error) => ({
        row: error.rowNumber,
        field: error.field,
        message: error.message
      }))
    };
  }
}
