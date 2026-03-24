import type { EntityType } from "@corelia/types";
import type { FastifyInstance } from "fastify";
import {
  buildDecisionTargetCreateData,
  buildDecisionTargetWhere,
  extractDecisionTarget,
  isEntityType
} from "../../lib/entity-target.js";

type DecisionTargetFields = {
  linkedUserId: string | null;
  linkedProjectId: string | null;
  linkedTaskId: string | null;
  linkedMeetingId: string | null;
  linkedMeetingAgreementId: string | null;
  linkedMessageId: string | null;
  linkedFileId: string | null;
  linkedFormRequestId: string | null;
  linkedAnnouncementId: string | null;
  linkedObjectiveId: string | null;
  linkedDecisionId: string | null;
  linkedAutomationRuleId: string | null;
  linkedExpenseId: string | null;
};

const stripDecisionTargetFields = <T extends DecisionTargetFields>(note: T) => {
  const {
    linkedUserId,
    linkedProjectId,
    linkedTaskId,
    linkedMeetingId,
    linkedMeetingAgreementId,
    linkedMessageId,
    linkedFileId,
    linkedFormRequestId,
    linkedAnnouncementId,
    linkedObjectiveId,
    linkedDecisionId,
    linkedAutomationRuleId,
    linkedExpenseId,
    ...rest
  } = note;

  return {
    rest,
    targetFields: {
      linkedUserId,
      linkedProjectId,
      linkedTaskId,
      linkedMeetingId,
      linkedMeetingAgreementId,
      linkedMessageId,
      linkedFileId,
      linkedFormRequestId,
      linkedAnnouncementId,
      linkedObjectiveId,
      linkedDecisionId,
      linkedAutomationRuleId,
      linkedExpenseId
    }
  };
};

export class DecisionService {
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
      return DecisionService.LEGACY_UNMAPPED_CODE;
    }

    return null;
  }

  private mapDecisionNoteOutput<T extends DecisionTargetFields>(note: T) {
    const { rest, targetFields } = stripDecisionTargetFields(note);
    const target = extractDecisionTarget(targetFields);

    if (!target) {
      throw new Error("La decisión no tiene entidad vinculada");
    }

    return {
      ...rest,
      linkedEntityType: target.linkedEntityType,
      linkedEntityId: target.linkedEntityId
    };
  }

  async create(input: {
    title: string;
    description: string;
    descriptionCatalogId?: string;
    linkedEntityType: EntityType;
    linkedEntityId: string;
    authorId: string;
  }) {
    const note = await this.app.prisma.decisionNote.create({
      data: {
        title: input.title,
        description: input.description,
        descriptionCatalogId: input.descriptionCatalogId ?? null,
        ...buildDecisionTargetCreateData(input.linkedEntityType, input.linkedEntityId),
        authorId: input.authorId
      }
    });

    return this.mapDecisionNoteOutput(note);
  }

  async list(input: { linkedEntityType?: string; linkedEntityId?: string }) {
    if (input.linkedEntityType && !isEntityType(input.linkedEntityType)) {
      throw new Error("Tipo de entidad vinculada inválido");
    }

    const linkedEntityType = input.linkedEntityType as EntityType | undefined;

    const notes = await this.app.prisma.decisionNote.findMany({
      where: buildDecisionTargetWhere({
        ...(linkedEntityType ? { linkedEntityType } : {}),
        ...(input.linkedEntityId ? { linkedEntityId: input.linkedEntityId } : {})
      }),
      orderBy: { createdAt: "desc" }
    });

    return notes.map((note) => this.mapDecisionNoteOutput(note));
  }
}
