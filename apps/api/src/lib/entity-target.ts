import type { Prisma } from "@prisma/client";
import type { EntityType } from "@corelia/types";

const AUDIT_TARGET_FIELD_BY_ENTITY_TYPE = {
  USUARIO: "targetUserId",
  PROYECTO: "targetProjectId",
  TAREA: "targetTaskId",
  REUNION: "targetMeetingId",
  ACUERDO_REUNION: "targetMeetingAgreementId",
  MENSAJE: "targetMessageId",
  ARCHIVO: "targetFileId",
  SOLICITUD: "targetFormRequestId",
  ANUNCIO: "targetAnnouncementId",
  OBJETIVO: "targetObjectiveId",
  DECISION: "targetDecisionId",
  AUTOMATIZACION: "targetAutomationRuleId",
  GASTO: "targetExpenseId"
} as const satisfies Record<EntityType, string>;

const DECISION_TARGET_FIELD_BY_ENTITY_TYPE = {
  USUARIO: "linkedUserId",
  PROYECTO: "linkedProjectId",
  TAREA: "linkedTaskId",
  REUNION: "linkedMeetingId",
  ACUERDO_REUNION: "linkedMeetingAgreementId",
  MENSAJE: "linkedMessageId",
  ARCHIVO: "linkedFileId",
  SOLICITUD: "linkedFormRequestId",
  ANUNCIO: "linkedAnnouncementId",
  OBJETIVO: "linkedObjectiveId",
  DECISION: "linkedDecisionId",
  AUTOMATIZACION: "linkedAutomationRuleId",
  GASTO: "linkedExpenseId"
} as const satisfies Record<EntityType, string>;

type AuditTargetField = (typeof AUDIT_TARGET_FIELD_BY_ENTITY_TYPE)[EntityType];
type DecisionTargetField = (typeof DECISION_TARGET_FIELD_BY_ENTITY_TYPE)[EntityType];

type AuditTargetRecord = Record<AuditTargetField, string | null | undefined>;
type DecisionTargetRecord = Record<DecisionTargetField, string | null | undefined>;

const ENTITY_TYPES = Object.keys(AUDIT_TARGET_FIELD_BY_ENTITY_TYPE) as EntityType[];
const DECISION_TARGET_FIELDS = Object.values(
  DECISION_TARGET_FIELD_BY_ENTITY_TYPE
) as DecisionTargetField[];

export const isEntityType = (value: string): value is EntityType =>
  ENTITY_TYPES.includes(value as EntityType);

export const mapEntityTypeToAuditTargetField = (entityType: EntityType): AuditTargetField =>
  AUDIT_TARGET_FIELD_BY_ENTITY_TYPE[entityType];

export const mapEntityTypeToDecisionTargetField = (entityType: EntityType): DecisionTargetField =>
  DECISION_TARGET_FIELD_BY_ENTITY_TYPE[entityType];

export const buildAuditTargetCreateData = (
  entityType: EntityType,
  entityId: string
): Pick<Prisma.AuditLogUncheckedCreateInput, AuditTargetField> => {
  const field = mapEntityTypeToAuditTargetField(entityType);
  return { [field]: entityId } as Pick<Prisma.AuditLogUncheckedCreateInput, AuditTargetField>;
};

export const buildAuditTargetWhere = (
  entityType: EntityType,
  entityId?: string
): Prisma.AuditLogWhereInput => {
  const field = mapEntityTypeToAuditTargetField(entityType);
  return entityId
    ? ({ [field]: entityId } as Prisma.AuditLogWhereInput)
    : ({ [field]: { not: null } } as Prisma.AuditLogWhereInput);
};

export const extractAuditTarget = (
  entry: Pick<AuditTargetRecord, AuditTargetField>
): { entityType: EntityType; entityId: string } | null => {
  for (const entityType of ENTITY_TYPES) {
    const field = AUDIT_TARGET_FIELD_BY_ENTITY_TYPE[entityType];
    const value = entry[field];
    if (value) {
      return {
        entityType,
        entityId: value
      };
    }
  }

  return null;
};

export const buildDecisionTargetCreateData = (
  entityType: EntityType,
  entityId: string
): Pick<Prisma.DecisionNoteUncheckedCreateInput, DecisionTargetField> => {
  const field = mapEntityTypeToDecisionTargetField(entityType);
  return { [field]: entityId } as Pick<Prisma.DecisionNoteUncheckedCreateInput, DecisionTargetField>;
};

export const buildDecisionTargetWhere = (input: {
  linkedEntityType?: EntityType;
  linkedEntityId?: string;
}): Prisma.DecisionNoteWhereInput => {
  if (input.linkedEntityType && input.linkedEntityId) {
    const field = mapEntityTypeToDecisionTargetField(input.linkedEntityType);
    return { [field]: input.linkedEntityId } as Prisma.DecisionNoteWhereInput;
  }

  if (input.linkedEntityType) {
    const field = mapEntityTypeToDecisionTargetField(input.linkedEntityType);
    return { [field]: { not: null } } as Prisma.DecisionNoteWhereInput;
  }

  if (input.linkedEntityId) {
    return {
      OR: DECISION_TARGET_FIELDS.map((field) =>
        ({ [field]: input.linkedEntityId } as Prisma.DecisionNoteWhereInput)
      )
    };
  }

  return {};
};

export const extractDecisionTarget = (
  entry: Pick<DecisionTargetRecord, DecisionTargetField>
): { linkedEntityType: EntityType; linkedEntityId: string } | null => {
  for (const entityType of ENTITY_TYPES) {
    const field = DECISION_TARGET_FIELD_BY_ENTITY_TYPE[entityType];
    const value = entry[field];
    if (value) {
      return {
        linkedEntityType: entityType,
        linkedEntityId: value
      };
    }
  }

  return null;
};
