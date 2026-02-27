import fp from "fastify-plugin";

export const maintenancePlugin = fp(async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const config = request.routeOptions.config as
      | { skipMaintenance?: boolean; requiresAuth?: boolean }
      | undefined;

    if (config?.skipMaintenance) {
      return;
    }

    const state = await app.prisma.maintenanceMode.findUnique({ where: { id: 1 } });
    if (!state?.enabled) {
      return;
    }

    const role = request.accessContext?.activeRole;
    if (role === "ADMINISTRADOR") {
      return;
    }

    return reply.code(503).send({
      message: state.message ?? "Corelia está en mantenimiento"
    });
  });
});
