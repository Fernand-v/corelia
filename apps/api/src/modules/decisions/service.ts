import type { FastifyInstance } from "fastify";

export class DecisionService {
  private static readonly LEGACY_UNMAPPED_CODE = "LEGACY_UNMAPPED";

  constructor(private readonly app: FastifyInstance) {}

  private normalizeLegacyCode(input: { code?: string | null; text?: string | null }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    if (input.text?.trim()) {
      return DecisionService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  async create(input: {
    title: string;
    description: string;
    descriptionCode?: string;
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
        descriptionCode: this.normalizeLegacyCode({
          code: input.descriptionCode,
          text: input.description
        }),
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
