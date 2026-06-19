import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "../modules/projects/service.js";

const createMockApp = () =>
  ({
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          baseRole: {
            code: "ADMINISTRADOR"
          }
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
          role: {
            code: "LIDER_PROYECTO"
          }
        }),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({
          projectId: "p-1",
          userId: "u-2",
          role: {
            id: "role-collaborator",
            code: "COLABORADOR"
          }
        }),
        deleteMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      channel: {
        findMany: vi.fn().mockResolvedValue([])
      },
      channelMember: {
        createMany: vi.fn().mockResolvedValue({
          count: 0
        }),
        deleteMany: vi.fn().mockResolvedValue({
          count: 0
        })
      }
    },
    redis: {
      del: vi.fn().mockResolvedValue(1)
    }
  }) as unknown as ConstructorParameters<typeof ProjectService>[0];

describe("ProjectService member management", () => {
  it("adds member with role from project settings flow", async () => {
    const app = createMockApp();
    app.prisma.channel.findMany = vi.fn().mockResolvedValue([{ id: "c-1" }, { id: "c-2" }]);
    const service = new ProjectService(app);

    const member = await service.addProjectMember("u-admin", {
      projectId: "p-1",
      userId: "u-2",
      roleId: "role-collaborator"
    });

    expect(member).toMatchObject({
      projectId: "p-1",
      userId: "u-2",
      roleId: "role-collaborator",
      role: "COLABORADOR"
    });
    expect(app.prisma.projectMember.upsert).toHaveBeenCalledTimes(1);
    expect(app.prisma.channelMember.createMany).toHaveBeenCalledWith({
      data: [
        {
          channelId: "c-1",
          userId: "u-2"
        },
        {
          channelId: "c-2",
          userId: "u-2"
        }
      ],
      skipDuplicates: true
    });
  });

  it("removes member from project settings flow", async () => {
    const app = createMockApp();
    app.prisma.channel.findMany = vi.fn().mockResolvedValue([{ id: "c-1" }]);
    const service = new ProjectService(app);

    const result = await service.removeProjectMember("u-admin", "p-1", "u-2");

    expect(result).toEqual({ success: true });
    expect(app.prisma.projectMember.deleteMany).toHaveBeenCalledWith({
      where: {
        projectId: "p-1",
        userId: "u-2"
      }
    });
    expect(app.prisma.channelMember.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "u-2",
        channelId: {
          in: ["c-1"]
        }
      }
    });
  });

  it("lists project members with names and roles", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      {
        userId: "u-2",
        role: {
          id: "role-collaborator",
          code: "COLABORADOR"
        },
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
      roleId: "role-collaborator",
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
      baseRole: {
        code: "COLABORADOR"
      }
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
