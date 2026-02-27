import type { FastifyInstance } from "fastify";

export class AuditService {
  constructor(private readonly app: FastifyInstance) {}

  async list(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.app.prisma.$transaction([
      this.app.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      this.app.prisma.auditLog.count()
    ]);

    return {
      items,
      page,
      pageSize,
      total
    };
  }
}
