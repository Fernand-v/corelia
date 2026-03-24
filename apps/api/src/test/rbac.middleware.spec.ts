import { beforeEach, describe, expect, it, vi } from "vitest";

// We test the middleware logic by capturing the preHandler hook
// and invoking it with mock request/reply objects.

type HookFn = (request: unknown, reply: unknown) => Promise<void>;

const buildMockApp = () => {
  const hooks: Record<string, HookFn> = {};
  const guestRole = { id: "role-guest" };
  const adminRole = { id: "role-admin", key: "ADMINISTRADOR" };

  const app = {
    addHook: (name: string, fn: HookFn) => {
      hooks[name] = fn;
    },
    redis: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK")
    },
    prisma: {
      role: {
        findUnique: vi.fn((args: { where: { key?: string; id?: string } }) => {
          if (args.where.key === "INVITADO_EXTERNO") return Promise.resolve(guestRole);
          if (args.where.id === "role-guest") {
            return Promise.resolve({ id: "role-guest", key: "INVITADO_EXTERNO", rank: 0, rolePermissions: [] });
          }
          if (args.where.id === "role-admin") {
            return Promise.resolve({
              id: "role-admin",
              key: "ADMINISTRADOR",
              rank: 5,
              rolePermissions: [{ permission: { key: "PROYECTO_LEER" } }, { permission: { key: "ARCHIVO_SUBIR" } }]
            });
          }
          if (args.where.id === "role-member") {
            return Promise.resolve({
              id: "role-member",
              key: "COLABORADOR",
              rank: 2,
              rolePermissions: [{ permission: { key: "PROYECTO_LEER" } }]
            });
          }
          return Promise.resolve(null);
        })
      },
      user: {
        findUnique: vi.fn()
      },
      projectMember: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    }
  };

  return { app, hooks, guestRole, adminRole };
};

const loadPlugin = async (app: ReturnType<typeof buildMockApp>["app"]) => {
  // Dynamically import to reset the cached guest role between tests
  const { rbacPlugin } = await import("../plugins/rbac.js");
  await (rbacPlugin as unknown as (app: unknown) => Promise<void>)(app);
  return app;
};

const buildRequest = (overrides: Record<string, unknown> = {}) => ({
  routeOptions: { config: { requiresAuth: true, requiredPermission: undefined } },
  authUser: { id: "user-1" },
  accessContext: undefined as unknown,
  headers: {} as Record<string, string>,
  query: {} as Record<string, string>,
  ...overrides
});

const buildReply = () => {
  const reply = { code: vi.fn(), send: vi.fn() };
  reply.code.mockReturnValue(reply);
  return reply;
};

describe("rbacPlugin — preHandler middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // reset cached guest role between tests
  });

  it("skips auth check when requiresAuth is false", async () => {
    const { app, hooks } = buildMockApp();
    await loadPlugin(app);
    const preHandler = hooks["preHandler"];

    const request = buildRequest({
      routeOptions: { config: { requiresAuth: false } }
    });
    const reply = buildReply();

    await preHandler!(request, reply);

    expect(app.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("skips auth check when no authUser present", async () => {
    const { app, hooks } = buildMockApp();
    await loadPlugin(app);

    const request = buildRequest({ authUser: undefined });
    const reply = buildReply();

    await hooks["preHandler"]!(request, reply);
    expect(app.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("uses guest role when user has no baseRole in DB", async () => {
    const { app, hooks } = buildMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    await loadPlugin(app);

    const request = buildRequest();
    const reply = buildReply();

    await hooks["preHandler"]!(request, reply);

    const ctx = (request as { accessContext: { activeRole: string } }).accessContext;
    expect(ctx.activeRole).toBe("INVITADO_EXTERNO");
  });

  it("uses user base role when no project context", async () => {
    const { app, hooks } = buildMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRoleId: "role-admin",
      baseRole: { key: "ADMINISTRADOR" }
    });
    // Redis miss → load from DB
    app.redis.get = vi.fn().mockResolvedValue(null);
    await loadPlugin(app);

    const request = buildRequest();
    const reply = buildReply();

    await hooks["preHandler"]!(request, reply);

    const ctx = (request as { accessContext: { activeRole: string } }).accessContext;
    expect(ctx.activeRole).toBe("ADMINISTRADOR");
  });

  it("uses project member role when user is project member", async () => {
    const { app, hooks } = buildMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRoleId: "role-guest",
      baseRole: { key: "INVITADO_EXTERNO" }
    });
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({ roleId: "role-member" });
    app.redis.get = vi.fn().mockResolvedValue(null);
    await loadPlugin(app);

    const request = buildRequest({
      routeOptions: {
        config: { requiresAuth: true },
        url: "/projects/p-1/tasks"
      },
      headers: { "x-project-id": "project-1" }
    });
    const reply = buildReply();

    await hooks["preHandler"]!(request, reply);

    // Should have queried projectMember for this user
    expect(app.prisma.projectMember.findFirst).toHaveBeenCalled();
  });

  it("admin bypasses project role — keeps own base role", async () => {
    const { app, hooks } = buildMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRoleId: "role-admin",
      baseRole: { key: "ADMINISTRADOR" }
    });
    // Even if member role exists, admin should keep own role
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({ roleId: "role-member" });
    app.redis.get = vi.fn().mockResolvedValue(null);
    await loadPlugin(app);

    const request = buildRequest({
      headers: { "x-project-id": "project-1" }
    });
    const reply = buildReply();

    await hooks["preHandler"]!(request, reply);

    const ctx = (request as { accessContext: { activeRole: string } }).accessContext;
    expect(ctx.activeRole).toBe("ADMINISTRADOR");
  });

  it("returns 403 when required permission is missing", async () => {
    const { app, hooks } = buildMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRoleId: "role-member",
      baseRole: { key: "COLABORADOR" }
    });
    app.redis.get = vi.fn().mockResolvedValue(null);
    await loadPlugin(app);

    const request = buildRequest({
      routeOptions: { config: { requiresAuth: true, requiredPermission: "ARCHIVO_SUBIR" } }
    });
    const reply = buildReply();

    await hooks["preHandler"]!(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ message: "Forbidden" });
  });

  it("uses cached role from Redis without hitting Prisma role table", async () => {
    const { app, hooks } = buildMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRoleId: "role-admin",
      baseRole: { key: "ADMINISTRADOR" }
    });
    // Redis has cached role
    app.redis.get = vi.fn().mockResolvedValue(
      JSON.stringify({ roleId: "role-admin", role: "ADMINISTRADOR", rank: 5, permissions: ["PROYECTO_LEER"] })
    );
    await loadPlugin(app);

    const request = buildRequest();
    const reply = buildReply();
    await hooks["preHandler"]!(request, reply);

    // Prisma role.findUnique should NOT be called (Redis hit)
    const roleCalls = (app.prisma.role.findUnique as ReturnType<typeof vi.fn>).mock.calls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call: any[]) => call[0]?.where?.id !== undefined
    );
    expect(roleCalls).toHaveLength(0);
  });
});
