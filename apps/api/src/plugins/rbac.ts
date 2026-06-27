import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import {
  permissionKey,
  type ActionCode,
  type Permission,
  type ProgramCode,
  type ResourceCode,
  type RoleCode
} from "@corelia/types";
import { getProjectIdFromRequest } from "../lib/http.js";
import { isAdminRole } from "../lib/rbac.js";

type CachedRoleContext = {
  roleId: string;
  role: RoleCode;
  displayName: string;
  rank: number;
  programs: ProgramCode[];
  permissions: Permission[];
};

const ROLE_CACHE_TTL_SECONDS = 300;
const RBAC_CACHE_VERSION_KEY = "rbac:version";
const RBAC_CACHE_DEFAULT_VERSION = 1;

// TTL corto para el contexto de usuario y la membresía: actúa como backstop si
// se pierde una invalidación explícita. Los puntos que mutan baseRole/membresías
// llaman a invalidateUserAccessCache / invalidateMembershipCache.
const USER_CONTEXT_TTL_SECONDS = 30;
const MEMBERSHIP_TTL_SECONDS = 30;
const NO_MEMBERSHIP = "__none__";

const buildRoleCacheKey = (roleId: string, version: number) => `rbac:role:${roleId}:v${version}`;
const buildUserContextKey = (userId: string) => `rbac:userctx:${userId}`;
const buildMembershipKey = (userId: string, projectId: string) => `rbac:member:${userId}:${projectId}`;

type UserContext = { baseRoleId: string | null; baseRoleKey: string | null };

export const loadUserContext = async (app: FastifyInstance, userId: string): Promise<UserContext> => {
  const cacheKey = buildUserContextKey(userId);
  const cached = await app.redis.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as UserContext;
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // cache corrupto → recargar de DB
    }
  }

  const user = await app.prisma.user.findUnique({
    where: { id: userId },
    select: {
      baseRoleId: true,
      baseRole: { select: { key: true } }
    }
  });

  const context: UserContext = {
    baseRoleId: user?.baseRoleId ?? null,
    baseRoleKey: user?.baseRole?.key ?? null
  };

  await app.redis.set(cacheKey, JSON.stringify(context), "EX", USER_CONTEXT_TTL_SECONDS);
  return context;
};

export const loadMembershipRoleId = async (
  app: FastifyInstance,
  userId: string,
  projectId: string
): Promise<string | null> => {
  const cacheKey = buildMembershipKey(userId, projectId);
  const cached = await app.redis.get(cacheKey);
  if (cached) {
    return cached === NO_MEMBERSHIP ? null : cached;
  }

  const membership = await app.prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { roleId: true }
  });

  const roleId = membership?.roleId ?? null;
  await app.redis.set(cacheKey, roleId ?? NO_MEMBERSHIP, "EX", MEMBERSHIP_TTL_SECONDS);
  return roleId;
};

/** Invalida el contexto de rol base cacheado de un usuario. */
export const invalidateUserAccessCache = async (app: FastifyInstance, userId: string): Promise<void> => {
  await app.redis.del(buildUserContextKey(userId));
};

/** Invalida la membresía cacheada de un usuario en un proyecto. */
export const invalidateMembershipCache = async (
  app: FastifyInstance,
  userId: string,
  projectId: string
): Promise<void> => {
  await app.redis.del(buildMembershipKey(userId, projectId));
};

const parseCachedRoleContext = (raw: string | null): CachedRoleContext | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      roleId?: unknown;
      role?: unknown;
      displayName?: unknown;
      rank?: unknown;
      programs?: unknown;
      permissions?: unknown;
    };
    if (
      typeof parsed.roleId !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.rank !== "number" ||
      !Array.isArray(parsed.permissions) ||
      !parsed.permissions.every((permission) => typeof permission === "string")
    ) {
      return null;
    }

    const rawPrograms = Array.isArray(parsed.programs) ? parsed.programs : [];
    const programs = rawPrograms.filter((program): program is ProgramCode => typeof program === "string");

    return {
      roleId: parsed.roleId,
      role: parsed.role as RoleCode,
      displayName: parsed.displayName,
      rank: parsed.rank,
      programs,
      permissions: parsed.permissions as Permission[]
    };
  } catch {
    return null;
  }
};

const getRbacCacheVersion = async (app: FastifyInstance): Promise<number> => {
  const raw = await app.redis.get(RBAC_CACHE_VERSION_KEY);
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  await app.redis.set(RBAC_CACHE_VERSION_KEY, String(RBAC_CACHE_DEFAULT_VERSION));
  return RBAC_CACHE_DEFAULT_VERSION;
};

const loadRoleContext = async (
  app: FastifyInstance,
  roleId: string,
  cacheVersion: number
): Promise<CachedRoleContext> => {
  const cacheKey = buildRoleCacheKey(roleId, cacheVersion);
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
      programRoles: {
        where: {
          program: {
            isActive: true
          }
        },
        select: {
          program: {
            select: {
              key: true
            }
          }
        }
      },
      rolePermissions: {
        where: {
          permission: {
            isActive: true
          }
        },
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
    role: role.key as RoleCode,
    displayName: role.displayName,
    rank: role.rank,
    programs: [...new Set(role.programRoles.map((entry) => entry.program.key as ProgramCode))],
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
    await getRbacCacheVersion(app);
  });

  app.addHook("preHandler", async (request, reply) => {
    const config = request.routeOptions.config as
      | {
          requiresAuth?: boolean;
          requiredProgram?: ProgramCode;
          requiredResource?: ResourceCode;
          requiredAction?: ActionCode;
        }
      | undefined;

    if (config?.requiresAuth === false || !request.authUser) {
      return;
    }

    const projectId = getProjectIdFromRequest(request);

    const user = await loadUserContext(app, request.authUser.id);

    const guestRole = await getGuestRole(app);

    let activeRoleId = user.baseRoleId ?? guestRole.id;

    if (projectId) {
      const membershipRoleId = await loadMembershipRoleId(app, request.authUser.id, projectId);

      activeRoleId = membershipRoleId ?? guestRole.id;

      if (isAdminRole(user.baseRoleKey) && user.baseRoleId) {
        activeRoleId = user.baseRoleId;
      }
    }

    const cacheVersion = await getRbacCacheVersion(app);
    const roleContext = await loadRoleContext(app, activeRoleId, cacheVersion);

    request.accessContext = {
      projectId: projectId ?? null,
      activeRoleId: roleContext.roleId,
      activeRole: roleContext.role,
      roleDisplayName: roleContext.displayName,
      rank: roleContext.rank,
      programs: roleContext.programs,
      permissions: roleContext.permissions
    };

    if (config?.requiredProgram && !roleContext.programs.includes(config.requiredProgram)) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    // La key canónica de un permiso es `${recurso}_${acción}`, por lo que el
    // guard la reconstruye sin necesidad de un índice adicional.
    if (config?.requiredResource && config?.requiredAction) {
      const requiredPermission = permissionKey(config.requiredResource, config.requiredAction) as Permission;
      if (!roleContext.permissions.includes(requiredPermission)) {
        return reply.code(403).send({ message: "Forbidden" });
      }
    }
  });
});
