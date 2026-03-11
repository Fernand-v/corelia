import fp from "fastify-plugin";
import { buildAuditTargetCreateData } from "../lib/entity-target.js";

const serializeAuditPayload = (
  value: Record<string, unknown> | null | undefined
): string | null => {
  if (!value) {
    return null;
  }

  return JSON.stringify(value);
};

export const auditPlugin = fp(async (app) => {
  app.addHook("onResponse", async (request, reply) => {
    const statusCode = reply.statusCode;

    if (!request.auditEvent || statusCode >= 400) {
      return;
    }

    await app.prisma.auditLog.create({
      data: {
        ...buildAuditTargetCreateData(
          request.auditEvent.entityType,
          request.auditEvent.entityId
        ),
        action: request.auditEvent.action,
        userId: request.authUser?.id ?? null,
        previousDataText: serializeAuditPayload(request.auditEvent.previousDataText),
        newDataText: serializeAuditPayload(request.auditEvent.newDataText),
        reason: request.auditEvent.reason ?? null,
        reasonCatalogId:
          request.auditEvent.reasonCatalogId ??
          (request.auditEvent.reason ? "LEGACY_UNMAPPED" : null)
      }
    });
  });
});
