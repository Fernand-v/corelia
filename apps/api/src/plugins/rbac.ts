import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { type Permission, type ProgramCode, type RoleCode } from "@corelia/types";
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

const buildRoleCacheKey = (roleId: string, version: number) => `rbac:role:${roleId}:v${version}`;

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
      | { requiresAuth?: boolean; requiredProgram?: ProgramCode; requiredPermission?: Permission }
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

    if (config?.requiredPermission && !roleContext.permissions.includes(config.requiredPermission)) {
      return reply.code(403).send({ message: "Forbidden" });
    }
  });
});
