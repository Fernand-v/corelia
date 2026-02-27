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
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      refreshToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn()
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
      .mockResolvedValueOnce({ baseRole: "ADMINISTRADOR" })
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
});
