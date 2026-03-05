import fp from "fastify-plugin";

export const auditPlugin = fp(async (app) => {
  app.addHook("onResponse", async (request, reply) => {
    const statusCode = reply.statusCode;

    if (!request.auditEvent || statusCode >= 400) {
      return;
    }

    await app.prisma.auditLog.create({
      data: {
        entityType: request.auditEvent.entityType,
        entityId: request.auditEvent.entityId,
        action: request.auditEvent.action,
        userId: request.authUser?.id,
        previousData: request.auditEvent.previousData as never,
        newData: request.auditEvent.newData as never,
        reason: request.auditEvent.reason,
        reasonCode:
          request.auditEvent.reasonCode ??
          (request.auditEvent.reason ? "LEGACY_UNMAPPED" : null)
      }
    });
  });
});
