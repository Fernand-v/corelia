import fp from "fastify-plugin";
import { type Permission, type SystemRole } from "@corelia/types";
import { getProjectIdFromRequest } from "../lib/http.js";
import { getPermissionsForRole } from "../lib/rbac.js";

export const rbacPlugin = fp(async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const config = request.routeOptions.config as
      | { requiresAuth?: boolean; requiredPermission?: Permission }
      | undefined;

    if (config?.requiresAuth === false || !request.authUser) {
      return;
    }

    const projectId = getProjectIdFromRequest(request);
    let activeRole: SystemRole;

    if (projectId) {
      const [membership, user] = await Promise.all([
        app.prisma.projectMember.findFirst({
          where: {
            projectId,
            userId: request.authUser.id
          }
        }),
        app.prisma.user.findUnique({
          where: { id: request.authUser.id },
          select: { baseRole: true }
        })
      ]);

      if (user?.baseRole === "ADMINISTRADOR") {
        activeRole = "ADMINISTRADOR";
      } else {
        activeRole = membership?.role ?? "INVITADO_EXTERNO";
      }
    } else {
      const user = await app.prisma.user.findUnique({
        where: {
          id: request.authUser.id
        },
        select: { baseRole: true }
      });

      activeRole = user?.baseRole ?? "INVITADO_EXTERNO";
    }

    const permissions = getPermissionsForRole(activeRole);

    request.accessContext = {
      projectId: projectId ?? null,
      activeRole,
      permissions
    };

    if (config?.requiredPermission && !permissions.includes(config.requiredPermission)) {
      return reply.code(403).send({ message: "Forbidden" });
    }
  });
});
