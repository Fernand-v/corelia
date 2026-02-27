import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../modules/identity/service.js";

const createMockApp = () => {
  return {
    prisma: {
      projectMember: {
        findFirst: vi.fn(),
        findMany: vi.fn()
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
      $transaction: vi.fn()
    },
    jwt: {
      sign: vi.fn().mockResolvedValue("signed")
    }
  } as unknown as ConstructorParameters<typeof IdentityService>[0];
};

describe("Identity integration flows", () => {
  it("returns project role when project context is provided", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({ role: "LIDER_PROYECTO" });

    const service = new IdentityService(app);
    const result = await service.resolveActiveRole(crypto.randomUUID(), crypto.randomUUID());

    expect(result.role).toBe("LIDER_PROYECTO");
    expect(result.permissions.length).toBeGreaterThan(0);
  });

  it("uses most restrictive role out of project context", async () => {
    const app = createMockApp();
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      { role: "LIDER_PROYECTO" },
      { role: "COLABORADOR" }
    ]);
    app.prisma.user.findUnique = vi.fn().mockResolvedValue({ baseRole: "ADMINISTRADOR" });

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
      resourceType: "PROYECTO",
      resourceId: crypto.randomUUID(),
      expiresAt: new Date().toISOString(),
      createdById: crypto.randomUUID()
    });

    expect(invite.email).toBe("guest@external.com");
    expect(app.prisma.guestInvite.create).toHaveBeenCalledTimes(1);
  });

  it("returns directory profiles", async () => {
    const app = createMockApp();
    app.prisma.user.findMany = vi.fn().mockResolvedValue([
      {
        id: crypto.randomUUID(),
        firstName: "Ana",
        lastName: "Suarez",
        email: "ana@corelia.local",
        baseRole: "COLABORADOR",
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
