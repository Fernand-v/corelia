import { beforeEach, describe, expect, it, vi } from "vitest";
import { testPrisma, resetDatabase } from "./db/client.js";
import { createOpaqueToken, hashOpaqueToken } from "../lib/tokens.js";

vi.mock("../config/env.js", () => ({
  env: {
    ACCESS_TOKEN_TTL_MINUTES: 15,
    REFRESH_TOKEN_TTL_DAYS: 30
  }
}));

import { AuthService } from "../modules/auth/service.js";

type App = ConstructorParameters<typeof AuthService>[0];

const buildApp = () =>
  ({
    prisma: testPrisma,
    jwt: { sign: vi.fn().mockResolvedValue("access-token") }
  }) as unknown as App;

const seedUser = async () => {
  const role = await testPrisma.role.create({
    data: { key: "COLABORADOR", displayName: "Colaborador", scope: "PROJECT" }
  });
  return testPrisma.user.create({
    data: {
      email: "user@corelia.test",
      passwordHash: "x",
      firstName: "Test",
      lastName: "User",
      baseRoleId: role.id
    }
  });
};

const seedRefreshToken = async (userId: string) => {
  const token = createOpaqueToken();
  await testPrisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
  return token;
};

describe("AuthService.refresh (real DB)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rotates the refresh token: revokes the old one and chains the new one", async () => {
    const user = await seedUser();
    const oldToken = await seedRefreshToken(user.id);
    const oldRow = await testPrisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });

    const service = new AuthService(buildApp());
    const result = await service.refresh({ refreshToken: oldToken });

    expect(result.refreshToken).not.toBe(oldToken);
    expect(result.userId).toBe(user.id);

    const refreshedOld = await testPrisma.refreshToken.findUniqueOrThrow({ where: { id: oldRow.id } });
    expect(refreshedOld.revokedAt).not.toBeNull();

    const newRow = await testPrisma.refreshToken.findFirstOrThrow({
      where: { tokenHash: hashOpaqueToken(result.refreshToken) }
    });
    expect(newRow.rotatedFromId).toBe(oldRow.id);
    expect(newRow.revokedAt).toBeNull();
  });

  it("rejects reuse of an already-rotated (revoked) token", async () => {
    const user = await seedUser();
    const oldToken = await seedRefreshToken(user.id);
    const service = new AuthService(buildApp());

    await service.refresh({ refreshToken: oldToken });

    await expect(service.refresh({ refreshToken: oldToken })).rejects.toThrow(/inválido/);
  });

  it("rejects an expired token", async () => {
    const user = await seedUser();
    const token = createOpaqueToken();
    await testPrisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() - 1000)
      }
    });
    const service = new AuthService(buildApp());

    await expect(service.refresh({ refreshToken: token })).rejects.toThrow(/inválido/);
  });
});
