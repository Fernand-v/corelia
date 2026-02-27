import type { FastifyInstance } from "fastify";

export class DecisionService {
  constructor(private readonly app: FastifyInstance) {}

  async create(input: {
    title: string;
    description: string;
    linkedEntityType:
      | "USUARIO"
      | "PROYECTO"
      | "TAREA"
      | "MENSAJE"
      | "ARCHIVO"
      | "SOLICITUD"
      | "ANUNCIO"
      | "OBJETIVO"
      | "DECISION"
      | "AUTOMATIZACION";
    linkedEntityId: string;
    authorId: string;
  }) {
    return this.app.prisma.decisionNote.create({
      data: {
        title: input.title,
        description: input.description,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
        authorId: input.authorId
      }
    });
  }

  async list(input: { linkedEntityType?: string; linkedEntityId?: string }) {
    return this.app.prisma.decisionNote.findMany({
      where: {
        ...(input.linkedEntityType ? { linkedEntityType: input.linkedEntityType as never } : {}),
        ...(input.linkedEntityId ? { linkedEntityId: input.linkedEntityId } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
