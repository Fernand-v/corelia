import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "../modules/projects/service.js";

const createMockApp = () =>
  ({
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          baseRole: "ADMINISTRADOR"
        })
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "p-1",
          ownerId: "u-owner",
          name: "Proyecto Uno"
        }),
        create: vi.fn(),
        findMany: vi.fn()
      },
      projectMember: {
        findFirst: vi.fn().mockResolvedValue({
          role: "LIDER_PROYECTO"
        }),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({
          projectId: "p-1",
          userId: "u-2",
          role: "COLABORADOR"
        }),
        deleteMany: vi.fn().mockResolvedValue({
          count: 1
        })
      }
    }
  }) as unknown as ConstructorParameters<typeof ProjectService>[0];

describe("ProjectService member management", () => {
  it("adds member with role from project settings flow", async () => {
    const app = createMockApp();
    const service = new ProjectService(app);

    const member = await service.addProjectMember("u-admin", {
      projectId: "p-1",
      userId: "u-2",
      role: "COLABORADOR"
    });

    expect(member).toMatchObject({
      projectId: "p-1",
      userId: "u-2",
      role: "COLABORADOR"
    });
    expect(app.prisma.projectMember.upsert).toHaveBeenCalledTimes(1);
  });

  it("removes member from project settings flow", async () => {
    const app = createMockApp();
    const service = new ProjectService(app);

    const result = await service.removeProjectMember("u-admin", "p-1", "u-2");

    expect(result).toEqual({ success: true });
    expect(app.prisma.projectMember.deleteMany).toHaveBeenCalledWith({
      where: {
        projectId: "p-1",
        userId: "u-2"
      }
    });
  });

  it("lists project members with names and roles", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      {
        userId: "u-2",
        role: "COLABORADOR",
        joinedAt: new Date("2026-02-20T10:00:00.000Z"),
        user: {
          id: "u-2",
          firstName: "María",
          lastName: "López",
          email: "maria@corelia.local"
        }
      }
    ]);

    const service = new ProjectService(app);
    const result = await service.getProjectMembers("p-1", "u-admin");

    expect(result.projectName).toBe("Proyecto Uno");
    expect(result.members[0]).toMatchObject({
      userId: "u-2",
      fullName: "María López",
      email: "maria@corelia.local",
      role: "COLABORADOR"
    });
  });

  it("lists all projects for admin users", async () => {
    const app = createMockApp();
    app.prisma.project.findMany = vi.fn().mockResolvedValue([]);
    const service = new ProjectService(app);

    await service.listProjects("u-admin");

    expect(app.prisma.project.findMany).toHaveBeenCalledWith({
      include: {
        members: true
      }
    });
  });

  it("lists only owned/member projects for non-admin users", async () => {
    const app = createMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: "COLABORADOR"
    });
    app.prisma.project.findMany = vi.fn().mockResolvedValue([]);
    const service = new ProjectService(app);

    await service.listProjects("u-regular");

    expect(app.prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ ownerId: "u-regular" }, { members: { some: { userId: "u-regular" } } }]
      },
      include: {
        members: true
      }
    });
  });
});
