import type { FastifyInstance } from "fastify";
import { extractAuditTarget } from "../../lib/entity-target.js";

type AuditTargetFields = {
  targetUserId: string | null;
  targetProjectId: string | null;
  targetTaskId: string | null;
  targetMeetingId: string | null;
  targetMeetingAgreementId: string | null;
  targetMessageId: string | null;
  targetFileId: string | null;
  targetFormRequestId: string | null;
  targetAnnouncementId: string | null;
  targetObjectiveId: string | null;
  targetDecisionId: string | null;
  targetAutomationRuleId: string | null;
  targetExpenseId: string | null;
};

const stripAuditTargetFields = <T extends AuditTargetFields>(item: T) => {
  const {
    targetUserId,
    targetProjectId,
    targetTaskId,
    targetMeetingId,
    targetMeetingAgreementId,
    targetMessageId,
    targetFileId,
    targetFormRequestId,
    targetAnnouncementId,
    targetObjectiveId,
    targetDecisionId,
    targetAutomationRuleId,
    targetExpenseId,
    ...rest
  } = item;

  return {
    rest,
    targetFields: {
      targetUserId,
      targetProjectId,
      targetTaskId,
      targetMeetingId,
      targetMeetingAgreementId,
      targetMessageId,
      targetFileId,
      targetFormRequestId,
      targetAnnouncementId,
      targetObjectiveId,
      targetDecisionId,
      targetAutomationRuleId,
      targetExpenseId
    }
  };
};

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

    const normalizedItems = items
      .map((item) => {
        const { rest, targetFields } = stripAuditTargetFields(item);
        const target = extractAuditTarget(targetFields);
        if (!target) {
          return null;
        }

        return {
          ...rest,
          entityType: target.entityType,
          entityId: target.entityId
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      items: normalizedItems,
      page,
      pageSize,
      total
    };
  }
}
