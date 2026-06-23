import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { testPrisma, resetDatabase } from "./db/client.js";
import { FakeRedis } from "./db/fake-redis.js";
import {
  loadMembershipRoleId,
  loadUserContext,
  invalidateMembershipCache
} from "../plugins/rbac.js";

const buildApp = () => {
  const redis = new FakeRedis();
  const app = { prisma: testPrisma, redis } as unknown as FastifyInstance;
  return { app, redis };
};

const seedRole = (key: string, scope: "GLOBAL" | "PROJECT" = "PROJECT") =>
  testPrisma.role.create({ data: { key, displayName: key, scope } });

const seedUser = (email: string, baseRoleId: string) =>
  testPrisma.user.create({
    data: { email, passwordHash: "x", firstName: "T", lastName: "U", baseRoleId }
  });

const seedProject = (name: string, ownerId: string) =>
  testPrisma.project.create({ data: { name, template: "SOFTWARE", ownerId } });

describe("RBAC role resolution (real DB)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("derives the project membership role only within that project (no cross-project leakage)", async () => {
    const baseRole = await seedRole("OBSERVADOR");
    const leadRole = await seedRole("LIDER_PROYECTO");
    const user = await seedUser("u@corelia.test", baseRole.id);
    const projectY = await seedProject("Proyecto Y", user.id);
    const projectX = await seedProject("Proyecto X", user.id);

    await testPrisma.projectMember.create({
      data: { projectId: projectY.id, userId: user.id, roleId: leadRole.id }
    });

    const { app } = buildApp();

    // En el proyecto donde es miembro: rol de la membresía.
    await expect(loadMembershipRoleId(app, user.id, projectY.id)).resolves.toBe(leadRole.id);
    // En otro proyecto: sin membresía → null (no hereda el rol del proyecto Y).
    await expect(loadMembershipRoleId(app, user.id, projectX.id)).resolves.toBeNull();
  });

  it("resolves the base role context for a user", async () => {
    const baseRole = await seedRole("ADMINISTRADOR", "GLOBAL");
    const user = await seedUser("admin@corelia.test", baseRole.id);

    const { app } = buildApp();
    const context = await loadUserContext(app, user.id);

    expect(context.baseRoleId).toBe(baseRole.id);
    expect(context.baseRoleKey).toBe("ADMINISTRADOR");
  });

  it("caches the membership lookup and re-reads the DB after invalidation", async () => {
    const baseRole = await seedRole("COLABORADOR");
    const roleA = await seedRole("COORDINADOR_EQUIPO");
    const user = await seedUser("c@corelia.test", baseRole.id);
    const project = await seedProject("Proyecto Z", user.id);
    const member = await testPrisma.projectMember.create({
      data: { projectId: project.id, userId: user.id, roleId: roleA.id }
    });

    const { app, redis } = buildApp();

    // Primera lectura: golpea DB y cachea.
    await expect(loadMembershipRoleId(app, user.id, project.id)).resolves.toBe(roleA.id);

    // Cambiamos el rol en DB directamente; la caché aún devuelve el anterior.
    const roleB = await seedRole("LIDER_PROYECTO");
    await testPrisma.projectMember.update({
      where: { id: member.id },
      data: { roleId: roleB.id }
    });
    await expect(loadMembershipRoleId(app, user.id, project.id)).resolves.toBe(roleA.id);

    // Tras invalidar, se relee de DB el nuevo rol.
    await invalidateMembershipCache(app, user.id, project.id);
    await expect(loadMembershipRoleId(app, user.id, project.id)).resolves.toBe(roleB.id);

    // Sanidad: la caché realmente guardó algo.
    expect(await redis.get(`rbac:member:${user.id}:${project.id}`)).toBe(roleB.id);
  });
});
