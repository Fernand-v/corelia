import { describe, expect, it, vi } from "vitest";
import { AdminUsersService } from "../modules/admin/services/users.js";

const createMockApp = () => {
  const tx = {
    user: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        id: "u-target",
        firstName: "Ana",
        lastName: "López",
        email: "ana@corelia.local",
        isActive: true,
        baseRole: {
          id: "role-collaborator",
          key: "COLABORADOR"
        },
        teamMemberships: []
      })
    },
    teamMember: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({})
    },
    workSchedule: {
      upsert: vi.fn().mockResolvedValue({})
    },
    task: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    fileObject: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    projectMember: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    offboardingRecord: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  const app = {
    prisma: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      user: {
        findUnique: vi.fn().mockResolvedValue({
          baseRole: {
            key: "ADMINISTRADOR",
            code: "ADMINISTRADOR"
          }
        }),
        findMany: vi.fn().mockResolvedValue([{ id: "u-transfer" }])
      },
      task: {
        findMany: vi.fn().mockResolvedValue([])
      },
      projectMember: {
        findMany: vi.fn().mockResolvedValue([])
      },
      fileObject: {
        findMany: vi.fn().mockResolvedValue([])
      }
    },
    redis: {
      del: vi.fn().mockResolvedValue(1)
    }
  };

  return {
    app: app as unknown as ConstructorParameters<typeof AdminUsersService>[0],
    rawApp: app,
    tx
  };
};

const createTeamSync = () =>
  ({
    handleTeamMembershipAdded: vi.fn(),
    handleTeamMembershipRemoved: vi.fn()
  }) as unknown as ConstructorParameters<typeof AdminUsersService>[1];

describe("AdminUsersService RBAC cache invalidation", () => {
  it("invalidates user access cache when base role changes", async () => {
    const { app, rawApp } = createMockApp();
    const service = new AdminUsersService(app, createTeamSync());

    await service.updateUser("u-admin", "u-target", {
      baseRole: "COLABORADOR"
    });

    expect(rawApp.redis.del).toHaveBeenCalledWith("rbac:userctx:u-target");
  });

  it("does not invalidate user access cache for profile-only edits", async () => {
    const { app, rawApp } = createMockApp();
    const service = new AdminUsersService(app, createTeamSync());

    await service.updateUser("u-admin", "u-target", {
      firstName: "Anita"
    });

    expect(rawApp.redis.del).not.toHaveBeenCalled();
  });

  it("invalidates user and transferred leadership membership caches after offboarding", async () => {
    const { app, rawApp } = createMockApp();
    rawApp.prisma.projectMember.findMany.mockResolvedValue([
      {
        projectId: "p-1",
        role: {
          key: "LIDER_PROYECTO"
        }
      }
    ]);
    const service = new AdminUsersService(app, createTeamSync());

    await service.executeOffboarding("u-admin", {
      userId: "u-target",
      primaryTransferToUserId: "u-transfer",
      reason: "Cambio de equipo",
      archiveHistory: false,
      taskTransfers: [],
      leadershipTransfers: [
        {
          projectId: "p-1",
          role: "LIDER_PROYECTO",
          toUserId: "u-transfer"
        }
      ],
      documentTransfers: []
    });

    expect(rawApp.redis.del).toHaveBeenCalledWith("rbac:userctx:u-target");
    expect(rawApp.redis.del).toHaveBeenCalledWith("rbac:member:u-target:p-1");
    expect(rawApp.redis.del).toHaveBeenCalledWith("rbac:member:u-transfer:p-1");
  });
});
