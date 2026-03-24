import fp from "fastify-plugin";

const CACHE_KEY = "maintenance:state:v1";
const CACHE_TTL_SECONDS = 10;

type MaintenanceState = {
  enabled: boolean;
  message: string | null;
};

export const maintenancePlugin = fp(async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const config = request.routeOptions.config as
      | { skipMaintenance?: boolean; requiresAuth?: boolean }
      | undefined;

    if (config?.skipMaintenance) {
      return;
    }

    let state: MaintenanceState | null = null;

    const cached = await app.redis.get(CACHE_KEY);
    if (cached) {
      state = JSON.parse(cached) as MaintenanceState;
    } else {
      const row = await app.prisma.maintenanceMode.findUnique({ where: { id: 1 } });
      state = row ? { enabled: row.enabled, message: row.message } : { enabled: false, message: null };
      await app.redis.set(CACHE_KEY, JSON.stringify(state), "EX", CACHE_TTL_SECONDS);
    }

    if (!state.enabled) {
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
