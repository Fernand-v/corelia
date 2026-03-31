import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { type Permission } from "@corelia/types";
import { getProjectIdFromRequest } from "../lib/http.js";
import { isAdminRole } from "../lib/rbac.js";

type CachedRoleContext = {
  roleId: string;
  role: string;
  displayName: string;
  rank: number;
  permissions: Permission[];
};

const ROLE_CACHE_TTL_SECONDS = 300;

const buildRoleCacheKey = (roleId: string) => `rbac:role:${roleId}:v1`;

const parseCachedRoleContext = (raw: string | null): CachedRoleContext | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedRoleContext;
    if (
      typeof parsed.roleId !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.rank !== "number" ||
      !Array.isArray(parsed.permissions)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const loadRoleContext = async (
  app: FastifyInstance,
  roleId: string
): Promise<CachedRoleContext> => {
  const cacheKey = buildRoleCacheKey(roleId);
  const cached = parseCachedRoleContext(await app.redis.get(cacheKey));

  if (cached) {
    return cached;
  }

  const role = await app.prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      key: true,
      displayName: true,
      rank: true,
      rolePermissions: {
        select: {
          permission: {
            select: {
              key: true
            }
          }
        }
      }
    }
  });

  if (!role) {
    throw new Error("Rol no encontrado");
  }

  const payload: CachedRoleContext = {
    roleId: role.id,
    role: role.key,
    displayName: role.displayName,
    rank: role.rank,
    permissions: role.rolePermissions.map((entry) => entry.permission.key as Permission)
  };

  await app.redis.set(cacheKey, JSON.stringify(payload), "EX", ROLE_CACHE_TTL_SECONDS);

  return payload;
};

// Cached in process memory — INVITADO_EXTERNO never changes at runtime
let cachedGuestRoleId: string | null = null;

const getGuestRole = async (app: FastifyInstance) => {
  if (cachedGuestRoleId) {
    return { id: cachedGuestRoleId };
  }

  const guestRole = await app.prisma.role.findUnique({
    where: {
      key: "INVITADO_EXTERNO"
    },
    select: {
      id: true
    }
  });

  if (!guestRole) {
    throw new Error("Rol base INVITADO_EXTERNO no configurado");
  }

  cachedGuestRoleId = guestRole.id;
  return guestRole;
};

export const rbacPlugin = fp(async (app) => {
  // Warm up guest role cache on startup
  app.addHook("onReady", async () => {
    await getGuestRole(app);
  });

  app.addHook("preHandler", async (request, reply) => {
    const config = request.routeOptions.config as
      | { requiresAuth?: boolean; requiredPermission?: Permission }
      | undefined;

    if (config?.requiresAuth === false || !request.authUser) {
      return;
    }

    const projectId = getProjectIdFromRequest(request);

    const user = await app.prisma.user.findUnique({
      where: { id: request.authUser.id },
      select: {
        baseRoleId: true,
        baseRole: {
          select: {
            key: true
          }
        }
      }
    });

    const guestRole = await getGuestRole(app);

    let activeRoleId = user?.baseRoleId ?? guestRole.id;

    if (projectId) {
      const membership = await app.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: request.authUser.id
        },
        select: {
          roleId: true
        }
      });

      if (membership?.roleId) {
        activeRoleId = membership.roleId;
      } else {
        activeRoleId = guestRole.id;
      }

      if (isAdminRole(user?.baseRole.key)) {
        activeRoleId = user!.baseRoleId;
      }
    }

    const roleContext = await loadRoleContext(app, activeRoleId);

    request.accessContext = {
      projectId: projectId ?? null,
      activeRoleId: roleContext.roleId,
      activeRole: roleContext.role,
      roleDisplayName: roleContext.displayName,
      rank: roleContext.rank,
      permissions: roleContext.permissions
    };

    if (config?.requiredPermission && !roleContext.permissions.includes(config.requiredPermission)) {
      return reply.code(403).send({ message: "Forbidden" });
    }
  });
});
