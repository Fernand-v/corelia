import fp from "fastify-plugin";
import { type Permission, type SystemRole } from "@corelia/types";
import { getProjectIdFromRequest } from "../lib/http.js";
import { getMostRestrictiveRole, getPermissionsForRole } from "../lib/rbac.js";

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
      const membership = await app.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: request.authUser.id
        }
      });

      activeRole = membership?.role ?? "INVITADO_EXTERNO";
    } else {
      const memberships = await app.prisma.projectMember.findMany({
        where: { userId: request.authUser.id },
        select: { role: true }
      });

      const user = await app.prisma.user.findUnique({
        where: { id: request.authUser.id },
        select: { baseRole: true }
      });

      const candidateRoles = memberships.map((item) => item.role);
      if (user?.baseRole) {
        candidateRoles.push(user.baseRole);
      }

      activeRole = getMostRestrictiveRole(candidateRoles.length ? candidateRoles : ["INVITADO_EXTERNO"]);
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
