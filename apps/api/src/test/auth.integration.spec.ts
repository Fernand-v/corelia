import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../modules/auth/service.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

vi.mock("../config/env.js", () => ({
  env: {
    ACCESS_TOKEN_TTL_MINUTES: 15,
    REFRESH_TOKEN_TTL_DAYS: 30
  }
}));

vi.mock("../lib/password.js", () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
  hashPassword: vi.fn()
}));

const createMockApp = () => {
  return {
    prisma: {
      $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      project: {
        findMany: vi.fn().mockResolvedValue([])
      },
      projectMember: {
        findMany: vi.fn().mockResolvedValue([])
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([])
      },
      refreshToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn()
      },
      signupRequest: {
        findFirst: vi.fn(),
        create: vi.fn()
      }
    },
    jwt: {
      sign: vi.fn().mockResolvedValue("access-token")
    }
  } as unknown as ConstructorParameters<typeof AuthService>[0];
};

describe("Auth integration flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue("hashed-password");
  });

  it("login generates access and refresh token", async () => {
    const app = createMockApp();
    app.prisma.user.findFirst = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      email: "user@corelia.local",
      isActive: true,
      passwordHash: "any-hash"
    });
    app.prisma.refreshToken.create = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new AuthService(app);
    const result = await service.login({
      email: "user@corelia.local",
      password: "secretpass123"
    });

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken.length).toBeGreaterThan(20);
  });

  it("creates signup requests with normalized data", async () => {
    const app = createMockApp();
    app.prisma.user.findFirst = vi.fn().mockResolvedValue(null);
    app.prisma.signupRequest.findFirst = vi.fn().mockResolvedValue(null);
    app.prisma.signupRequest.create = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      status: "PENDIENTE",
      requestedAt: new Date("2026-03-09T12:00:00.000Z")
    });

    const service = new AuthService(app);
    const result = await service.createSignupRequest({
      email: "  NUEVO@CORELIA.local ",
      firstName: "  Ana ",
      lastName: " Pérez  ",
      message: "  Me interesa colaborar  "
    });

    expect(app.prisma.signupRequest.create).toHaveBeenCalledWith({
      data: {
        email: "nuevo@corelia.local",
        firstName: "Ana",
        lastName: "Pérez",
        message: "Me interesa colaborar"
      },
      select: {
        id: true,
        status: true,
        requestedAt: true
      }
    });
    expect(result.status).toBe("PENDIENTE");
    expect(result.submittedAt).toBe("2026-03-09T12:00:00.000Z");
  });

  it("rejects duplicate pending signup requests", async () => {
    const app = createMockApp();
    app.prisma.user.findFirst = vi.fn().mockResolvedValue(null);
    app.prisma.signupRequest.findFirst = vi.fn().mockResolvedValue({
      id: crypto.randomUUID()
    });

    const service = new AuthService(app);

    await expect(
      service.createSignupRequest({
        email: "user@corelia.local",
        firstName: "User",
        lastName: "Corelia"
      })
    ).rejects.toThrowError("Ya existe una solicitud pendiente para este email");

    expect(app.prisma.signupRequest.create).not.toHaveBeenCalled();
  });

  it("normalizes login email before querying users", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    app.prisma.user.findFirst = vi.fn().mockResolvedValue({
      id: userId,
      email: "admin@corelia.local",
      isActive: true,
      passwordHash: "any-hash"
    });
    app.prisma.refreshToken.create = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new AuthService(app);
    await service.login({
      email: "  ADMIN@corelia.local  ",
      password: "secretpass123"
    });

    expect(app.prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "admin@corelia.local",
          mode: "insensitive"
        }
      }
    });
  });

  it("refresh rotates token and revokes previous one", async () => {
    const app = createMockApp();
    app.prisma.refreshToken.findFirst = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      userId: crypto.randomUUID()
    });
    app.prisma.refreshToken.update = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });
    app.prisma.refreshToken.create = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      email: "user@corelia.local"
    });

    const service = new AuthService(app);
    const result = await service.refresh({ refreshToken: "valid-refresh-token" });

    expect(result.accessToken).toBe("access-token");
    expect(app.prisma.refreshToken.update).toHaveBeenCalledTimes(1);
    expect(app.prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it("logout revokes refresh token", async () => {
    const app = createMockApp();
    app.prisma.refreshToken.findFirst = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });
    app.prisma.refreshToken.update = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new AuthService(app);
    await service.logout({ refreshToken: "logout-token" });

    expect(app.prisma.refreshToken.update).toHaveBeenCalledTimes(1);
  });

  it("logout returns null when refresh token does not exist", async () => {
    const app = createMockApp();
    app.prisma.refreshToken.findFirst = vi.fn().mockResolvedValue(null);

    const service = new AuthService(app);
    const result = await service.logout({ refreshToken: "missing-token" });

    expect(result).toBeNull();
    expect(app.prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  it("changes password and revokes active refresh tokens", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();

    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: userId,
      isActive: true,
      passwordHash: "old-hash"
    });
    app.prisma.user.update = vi.fn().mockResolvedValue({ id: userId });
    app.prisma.refreshToken.updateMany = vi.fn().mockResolvedValue({ count: 2 });

    const service = new AuthService(app);
    const result = await service.changePassword(userId, {
      currentPassword: "old-password",
      newPassword: "new-password-123"
    });

    expect(result.userId).toBe(userId);
    expect(app.prisma.user.update).toHaveBeenCalledTimes(1);
    expect(app.prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rejects password change when current password is invalid", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();

    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: userId,
      isActive: true,
      passwordHash: "old-hash"
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const service = new AuthService(app);

    await expect(
      service.changePassword(userId, {
        currentPassword: "wrong-password",
        newPassword: "new-password-123"
      })
    ).rejects.toThrowError("La contraseña actual no es válida");
  });

  it("allows admin users to reset another user password", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const targetUserId = crypto.randomUUID();

    app.prisma.user.findUnique = vi
      .fn()
      .mockResolvedValueOnce({ baseRole: { code: "ADMINISTRADOR" } })
      .mockResolvedValueOnce({ id: targetUserId });
    app.prisma.user.update = vi.fn().mockResolvedValue({ id: targetUserId });
    app.prisma.refreshToken.updateMany = vi.fn().mockResolvedValue({ count: 1 });

    const service = new AuthService(app);
    const result = await service.adminResetPassword(actorId, {
      userId: targetUserId,
      newPassword: "AdminResetPass123!"
    });

    expect(result.userId).toBe(targetUserId);
    expect(app.prisma.user.update).toHaveBeenCalledTimes(1);
    expect(app.prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns aggregated membership summary for owned and joined projects", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const ownedProjectId = crypto.randomUUID();
    const joinedProjectId = crypto.randomUUID();

    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ id: userId });
    app.prisma.project.findMany = vi.fn().mockResolvedValue([
      { id: ownedProjectId, name: "Proyecto Alpha", template: "SOFTWARE" }
    ]);
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      {
        role: {
          id: crypto.randomUUID(),
          code: "COLABORADOR"
        },
        joinedAt: new Date("2026-03-01T10:00:00.000Z"),
        project: {
          id: joinedProjectId,
          name: "Proyecto Beta",
          template: "CONTENIDO",
          ownerId: crypto.randomUUID()
        }
      },
      {
        role: {
          id: crypto.randomUUID(),
          code: "OBSERVADOR"
        },
        joinedAt: new Date("2026-03-02T10:00:00.000Z"),
        project: {
          id: ownedProjectId,
          name: "Proyecto Alpha",
          template: "SOFTWARE",
          ownerId: userId
        }
      }
    ]);
    app.prisma.teamMember.findMany = vi.fn().mockResolvedValue([
      {
        createdAt: new Date("2026-03-03T10:00:00.000Z"),
        team: {
          id: crypto.randomUUID(),
          name: "Equipo Núcleo",
          description: "Core team"
        }
      }
    ]);

    const service = new AuthService(app);
    const summary = await service.getMembershipSummary(userId);

    expect(summary.userId).toBe(userId);
    expect(summary.projects).toHaveLength(2);
    expect(summary.projects.find((project) => project.id === ownedProjectId)?.isOwner).toBe(true);
    expect(summary.projects.find((project) => project.id === joinedProjectId)?.role).toBe("COLABORADOR");
    expect(summary.teams).toHaveLength(1);
    expect(summary.teams[0]?.name).toBe("Equipo Núcleo");
  });

  it("fails membership summary when user does not exist", async () => {
    const app = createMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue(null);

    const service = new AuthService(app);

    await expect(service.getMembershipSummary(crypto.randomUUID())).rejects.toThrowError("Usuario no encontrado");
  });
});
