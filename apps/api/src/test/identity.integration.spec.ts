import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../modules/identity/service.js";

const createMockApp = () => {
  return {
    prisma: {
      projectMember: {
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({
          id: crypto.randomUUID(),
          code: "INVITADO_EXTERNO"
        })
      },
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn()
      },
      onboardingChecklist: {
        create: vi.fn(),
        findUnique: vi.fn()
      },
      onboardingRun: {
        create: vi.fn(),
        update: vi.fn()
      },
      onboardingRunStep: {
        update: vi.fn(),
        count: vi.fn()
      },
      task: {
        updateMany: vi.fn()
      },
      offboardingRecord: {
        create: vi.fn()
      },
      guestInvite: {
        create: vi.fn()
      },
      personProfile: {
        findMany: vi.fn()
      },
      teamMember: {
        findMany: vi.fn()
      },
      team: {
        findMany: vi.fn().mockResolvedValue([])
      },
      meetingParticipant: {
        findMany: vi.fn().mockResolvedValue([])
      },
      $transaction: vi.fn()
    },
    jwt: {
      sign: vi.fn().mockResolvedValue("signed")
    }
  } as unknown as ConstructorParameters<typeof IdentityService>[0];
};

describe("Identity integration flows", () => {
  it("returns empty presence when user ids list is empty", async () => {
    const app = createMockApp();
    const service = new IdentityService(app);
    const result = await service.getPresenceForUsers([]);

    expect(result.items).toEqual([]);
  });

  it("resolves presence using redis pipeline and meeting state", async () => {
    const app = createMockApp();
    const onlineUserId = crypto.randomUUID();
    const inMeetingUserId = crypto.randomUUID();
    const offlineUserId = crypto.randomUUID();

    Object.assign(app as { redis?: unknown }, {
      redis: {
        pipeline: () => ({
          scard: vi.fn(),
          exec: vi.fn().mockResolvedValue([
            [null, 2],
            [null, 0],
            [null, 0]
          ])
        })
      }
    });

    app.prisma.meetingParticipant.findMany = vi
      .fn()
      .mockResolvedValue([{ userId: inMeetingUserId }]);

    const service = new IdentityService(app);
    const result = await service.getPresenceForUsers([onlineUserId, inMeetingUserId, offlineUserId]);

    expect(result.items).toEqual([
      { userId: onlineUserId, status: "EN_LINEA" },
      { userId: inMeetingUserId, status: "EN_REUNION" },
      { userId: offlineUserId, status: "DESCONECTADO" }
    ]);
  });

  it("resolves presence using redis scard fallback when pipeline is unavailable", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();

    Object.assign(app as { redis?: unknown }, {
      redis: {
        scard: vi.fn().mockResolvedValue(1)
      }
    });
    app.prisma.meetingParticipant.findMany = vi.fn().mockResolvedValue([]);

    const service = new IdentityService(app);
    const result = await service.getPresenceForUsers([userId]);

    expect(result.items).toEqual([{ userId, status: "EN_LINEA" }]);
  });

  it("returns project role when project context is provided", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({
      role: { id: crypto.randomUUID(), code: "LIDER_PROYECTO" }
    });

    const service = new IdentityService(app);
    const result = await service.resolveActiveRole(crypto.randomUUID(), crypto.randomUUID());

    expect(result.role).toBe("LIDER_PROYECTO");
    expect(result.permissions.length).toBeGreaterThan(0);
  });

  it("uses most restrictive role out of project context", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      { role: { id: crypto.randomUUID(), code: "LIDER_PROYECTO" } },
      { role: { id: crypto.randomUUID(), code: "COLABORADOR" } }
    ]);
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: { id: crypto.randomUUID(), code: "ADMINISTRADOR" }
    });

    const service = new IdentityService(app);
    const result = await service.resolveActiveRole(crypto.randomUUID());

    expect(result.role).toBe("COLABORADOR");
  });

  it("offboarding transfers active tasks and deactivates user", async () => {
    const app = createMockApp();
    app.prisma.$transaction = vi.fn().mockImplementation(async (cb) =>
      cb({
        task: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 })
        },
        user: {
          update: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        },
        offboardingRecord: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      })
    );

    const service = new IdentityService(app);
    const result = await service.offboard({
      userId: crypto.randomUUID(),
      transferToUserId: crypto.randomUUID(),
      reason: "Salida",
      archiveHistory: true
    });

    expect(result.success).toBe(true);
  });

  it("onboarding run starts and completes steps", async () => {
    const app = createMockApp();
    const checklistId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    app.prisma.onboardingChecklist.findUnique = vi.fn().mockResolvedValue({
      id: checklistId,
      items: [{ stepKey: "ASIGNAR_ROL" }]
    });
    app.prisma.onboardingRun.create = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      userId,
      steps: [{ stepKey: "ASIGNAR_ROL", completed: false }]
    });
    app.prisma.onboardingRunStep.update = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      stepKey: "ASIGNAR_ROL",
      completed: true
    });
    app.prisma.onboardingRunStep.count = vi.fn().mockResolvedValue(0);
    app.prisma.onboardingRun.update = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      completedAt: new Date()
    });

    const service = new IdentityService(app);
    const run = await service.startOnboardingRun({ checklistId, userId });
    await service.completeOnboardingStep({ runId: run.id, stepKey: "ASIGNAR_ROL" });

    expect(app.prisma.onboardingRun.create).toHaveBeenCalledTimes(1);
    expect(app.prisma.onboardingRun.update).toHaveBeenCalledTimes(1);
  });

  it("keeps onboarding run open when pending steps remain", async () => {
    const app = createMockApp();
    app.prisma.onboardingRunStep.update = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      stepKey: "PASO",
      completed: true
    });
    app.prisma.onboardingRunStep.count = vi.fn().mockResolvedValue(2);

    const service = new IdentityService(app);
    await service.completeOnboardingStep({ runId: crypto.randomUUID(), stepKey: "PASO" });

    expect(app.prisma.onboardingRun.update).not.toHaveBeenCalled();
  });

  it("fails onboarding run startup when checklist does not exist", async () => {
    const app = createMockApp();
    app.prisma.onboardingChecklist.findUnique = vi.fn().mockResolvedValue(null);

    const service = new IdentityService(app);

    await expect(
      service.startOnboardingRun({ checklistId: crypto.randomUUID(), userId: crypto.randomUUID() })
    ).rejects.toThrowError("Checklist no encontrado");
  });

  it("creates onboarding checklist template", async () => {
    const app = createMockApp();
    app.prisma.onboardingChecklist.create = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      name: "Base",
      items: [{ stepKey: "ASIGNAR_ROL" }]
    });

    const service = new IdentityService(app);
    const checklist = await service.createOnboardingChecklist({
      name: "Base",
      items: [{ key: "ASIGNAR_ROL", label: "Asignar rol", required: true, order: 0 }]
    });

    expect(checklist.name).toBe("Base");
    expect(app.prisma.onboardingChecklist.create).toHaveBeenCalledTimes(1);
  });

  it("creates guest invite with temporary token", async () => {
    const app = createMockApp();
    app.prisma.guestInvite.create = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      email: "guest@external.com"
    });

    const service = new IdentityService(app);
    const invite = await service.createGuestInvite({
      email: "guest@external.com",
      resourceScopeType: "PROYECTO",
      resourceScopeId: crypto.randomUUID(),
      expiresAt: new Date().toISOString(),
      createdById: crypto.randomUUID()
    });

    expect(invite.email).toBe("guest@external.com");
    expect(app.prisma.guestInvite.create).toHaveBeenCalledTimes(1);
  });

  it("lists all teams when actor is admin", async () => {
    const app = createMockApp();
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({
      baseRole: { code: "ADMINISTRADOR" }
    });
    app.prisma.team.findMany = vi.fn().mockResolvedValue([{ id: crypto.randomUUID(), name: "Plataforma" }]);

    const service = new IdentityService(app);
    const result = await service.listTeamsForUser(crypto.randomUUID());

    expect(result.total).toBe(1);
    expect(result.items[0]?.name).toBe("Plataforma");
  });

  it("rejects offboarding when transfer user matches source user", async () => {
    const app = createMockApp();
    const userId = crypto.randomUUID();
    const service = new IdentityService(app);

    await expect(
      service.offboard({
        userId,
        transferToUserId: userId,
        reason: "invalid",
        archiveHistory: false
      })
    ).rejects.toThrowError("No se puede transferir al mismo usuario");
  });

  it("returns directory profiles", async () => {
    const app = createMockApp();
    app.prisma.user.findMany = vi.fn().mockResolvedValue([
      {
        id: crypto.randomUUID(),
        firstName: "Ana",
        lastName: "Suarez",
        email: "ana@corelia.local",
        baseRole: {
          code: "COLABORADOR"
        },
        personProfile: {
          skills: ["typescript"],
          internalContactEmail: "ana@corelia.local",
          internalPhone: "123"
        },
        teamMemberships: [{ team: { name: "Producto" } }],
        workSchedule: {
          timezone: "UTC",
          weekDays: [1, 2, 3, 4, 5],
          startHour: "09:00",
          endHour: "18:00"
        }
      }
    ]);

    const service = new IdentityService(app);
    const directory = await service.getDirectory();

    expect(directory).toHaveLength(1);
    expect(directory[0]?.teamName).toBe("Producto");
  });
});
