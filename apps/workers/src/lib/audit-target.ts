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
} as const satisfies Record<EntityType, keyof Prisma.AuditLogUncheckedCreateInput>;

type AuditTargetField = (typeof AUDIT_TARGET_FIELD_BY_ENTITY_TYPE)[EntityType];

export const buildAuditTargetCreateData = (
  entityType: EntityType,
  entityId: string
): Pick<Prisma.AuditLogUncheckedCreateInput, AuditTargetField> => {
  const field = AUDIT_TARGET_FIELD_BY_ENTITY_TYPE[entityType];
  return { [field]: entityId } as Pick<Prisma.AuditLogUncheckedCreateInput, AuditTargetField>;
};
