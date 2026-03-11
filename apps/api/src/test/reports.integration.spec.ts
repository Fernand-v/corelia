import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsService } from "../modules/reports/service.js";

const createMockApp = () =>
  ({
    prisma: {
      project: {
        findMany: vi.fn().mockResolvedValue([])
      },
      team: {
        findMany: vi.fn().mockResolvedValue([])
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([])
      },
      projectTeamLink: {
        findMany: vi.fn().mockResolvedValue([])
      },
      task: {
        findMany: vi.fn().mockResolvedValue([])
      },
      timeEntry: {
        findMany: vi.fn().mockResolvedValue([])
      },
      projectDetail: {
        findMany: vi.fn().mockResolvedValue([])
      },
      workSchedule: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ firstName: "Ana", lastName: "Gomez" })
      }
    }
  }) as unknown as ConstructorParameters<typeof ReportsService>[0];

const now = new Date("2026-03-06T12:00:00.000Z");

describe("ReportsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    "COLABORADOR",
    "COORDINADOR_EQUIPO",
    "LIDER_PROYECTO",
    "ADMINISTRADOR"
  ] as const)("returns executive report for allowed role %s", async (role) => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const teamId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    app.prisma.project.findMany = vi.fn().mockResolvedValue([{ id: projectId, name: "Proyecto A" }]);
    app.prisma.teamMember.findMany = vi.fn().mockResolvedValue([{ userId: actorId, teamId, team: { id: teamId, name: "Equipo A" } }]);
    app.prisma.projectTeamLink.findMany = vi.fn().mockImplementation(async (args?: { include?: { project?: unknown; team?: unknown } }) => {
      if (args?.include?.project) {
        return [{ projectId, teamId, project: { id: projectId, name: "Proyecto A" } }];
      }
      if (args?.include?.team) {
        return [{ projectId, teamId, team: { id: teamId, name: "Equipo A" } }];
      }
      return [{ projectId, teamId }];
    });
    app.prisma.team.findMany = vi.fn().mockImplementation(async (args?: { include?: { members?: unknown } }) => {
      if (args?.include?.members) {
        return [
          {
            id: teamId,
            name: "Equipo A",
            members: [
              {
                userId,
                user: {
                  id: userId,
                  firstName: "Luz",
                  lastName: "Perez",
                  workSchedule: { maxActiveTasks: 5 }
                }
              }
            ]
          }
        ];
      }
      return [{ id: teamId, name: "Equipo A" }];
    });
    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      {
        id: crypto.randomUUID(),
        projectId,
        assigneeId: role === "COLABORADOR" ? actorId : userId,
        createdById: actorId,
        status: "COMPLETADA",
        dueDate: new Date("2026-03-05T12:00:00.000Z"),
        completedAt: new Date("2026-03-05T10:00:00.000Z"),
        pendingActivatedAt: new Date("2026-03-01T08:00:00.000Z"),
        startDate: new Date("2026-03-01T08:00:00.000Z"),
        createdAt: new Date("2026-03-01T08:00:00.000Z")
      }
    ]);
    app.prisma.timeEntry.findMany = vi.fn().mockResolvedValue([
      {
        minutes: 120,
        loggedAt: new Date("2026-03-05T09:00:00.000Z")
      }
    ]);

    const service = new ReportsService(app);
    const report = await service.getExecutiveReport({
      actorId,
      activeRole: role,
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-06T23:59:59.999Z"
    });

    expect(report.role).toBe(role);
    expect(report.blocks.productivity.tasksCreated).toBeGreaterThanOrEqual(0);
    expect(report.blocks.sla.evaluated).toBeGreaterThanOrEqual(0);
  });

  it("denies reports for unsupported roles", async () => {
    const app = createMockApp();
    const service = new ReportsService(app);

    await expect(
      service.getExecutiveReport({
        actorId: crypto.randomUUID(),
        activeRole: "OBSERVADOR"
      })
    ).rejects.toMatchObject({
      name: "Forbidden"
    });
  });

  it("denies project filter out of scope", async () => {
    const app = createMockApp();
    app.prisma.project.findMany = vi.fn().mockResolvedValue([
      { id: crypto.randomUUID(), name: "Permitido" }
    ]);

    const service = new ReportsService(app);

    await expect(
      service.getExecutiveReport({
        actorId: crypto.randomUUID(),
        activeRole: "COLABORADOR",
        projectId: crypto.randomUUID()
      })
    ).rejects.toMatchObject({
      name: "Forbidden"
    });
  });

  it("restricts collaborator data to own tasks", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    app.prisma.project.findMany = vi.fn().mockResolvedValue([{ id: projectId, name: "Proyecto A" }]);
    app.prisma.task.findMany = vi.fn().mockImplementation(async (args?: { where?: { OR?: Array<{ assigneeId?: string; createdById?: string }> } }) => {
      const allTasks = [
        {
          id: crypto.randomUUID(),
          projectId,
          assigneeId: actorId,
          createdById: actorId,
          status: "COMPLETADA",
          dueDate: new Date("2026-03-03T12:00:00.000Z"),
          completedAt: new Date("2026-03-03T11:00:00.000Z"),
          pendingActivatedAt: new Date("2026-03-01T08:00:00.000Z"),
          startDate: new Date("2026-03-01T08:00:00.000Z"),
          createdAt: new Date("2026-03-01T08:00:00.000Z")
        },
        {
          id: crypto.randomUUID(),
          projectId,
          assigneeId: otherUserId,
          createdById: otherUserId,
          status: "COMPLETADA",
          dueDate: new Date("2026-03-03T12:00:00.000Z"),
          completedAt: new Date("2026-03-03T11:00:00.000Z"),
          pendingActivatedAt: new Date("2026-03-01T08:00:00.000Z"),
          startDate: new Date("2026-03-01T08:00:00.000Z"),
          createdAt: new Date("2026-03-01T08:00:00.000Z")
        }
      ];

      const clauses = args?.where?.OR ?? [];
      if (clauses.length === 0) {
        return allTasks;
      }
      return allTasks.filter((task) =>
        clauses.some((clause) => clause.assigneeId === task.assigneeId || clause.createdById === task.createdById)
      );
    });

    const service = new ReportsService(app);
    const report = await service.getExecutiveReport({
      actorId,
      activeRole: "COLABORADOR",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-06T23:59:59.999Z"
    });

    expect(app.prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ assigneeId: actorId }, { createdById: actorId }]
        })
      })
    );
    expect(report.blocks.progressByClient[0]?.totalTasks ?? 0).toBe(1);
  });

  it("computes SLA using on-time, late and overdue-open rules", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    app.prisma.project.findMany = vi.fn().mockResolvedValue([{ id: projectId, name: "Proyecto A" }]);
    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      {
        id: crypto.randomUUID(),
        projectId,
        assigneeId: actorId,
        createdById: actorId,
        status: "COMPLETADA",
        dueDate: new Date("2026-03-03T12:00:00.000Z"),
        completedAt: new Date("2026-03-03T11:00:00.000Z"),
        pendingActivatedAt: new Date("2026-03-01T08:00:00.000Z"),
        startDate: new Date("2026-03-01T08:00:00.000Z"),
        createdAt: new Date("2026-03-01T08:00:00.000Z")
      },
      {
        id: crypto.randomUUID(),
        projectId,
        assigneeId: actorId,
        createdById: actorId,
        status: "COMPLETADA",
        dueDate: new Date("2026-03-04T12:00:00.000Z"),
        completedAt: new Date("2026-03-04T14:00:00.000Z"),
        pendingActivatedAt: new Date("2026-03-02T08:00:00.000Z"),
        startDate: new Date("2026-03-02T08:00:00.000Z"),
        createdAt: new Date("2026-03-02T08:00:00.000Z")
      },
      {
        id: crypto.randomUUID(),
        projectId,
        assigneeId: actorId,
        createdById: actorId,
        status: "PENDIENTE",
        dueDate: new Date("2026-03-05T12:00:00.000Z"),
        completedAt: null,
        pendingActivatedAt: null,
        startDate: null,
        createdAt: new Date("2026-03-02T08:00:00.000Z")
      }
    ]);

    const service = new ReportsService(app);
    const report = await service.getExecutiveReport({
      actorId,
      activeRole: "COLABORADOR",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-06T23:59:59.999Z"
    });

    expect(report.blocks.sla.evaluated).toBe(3);
    expect(report.blocks.sla.onTime).toBe(1);
    expect(report.blocks.sla.breached).toBe(2);
  });

  it("exports xlsx and pdf with non-empty buffers", async () => {
    vi.useRealTimers();
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    app.prisma.project.findMany = vi.fn().mockResolvedValue([{ id: projectId, name: "Proyecto A" }]);
    app.prisma.task.findMany = vi.fn().mockResolvedValue([]);

    const service = new ReportsService(app);
    const input = {
      actorId,
      activeRole: "COLABORADOR" as const,
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-06T23:59:59.999Z"
    };

    try {
      const xlsx = await service.exportExecutiveXlsx(input);
      const pdf = await service.exportExecutivePdf(input);

      expect(xlsx.buffer.length).toBeGreaterThan(0);
      expect(xlsx.buffer.subarray(0, 2).toString()).toBe("PK");
      expect(pdf.buffer.length).toBeGreaterThan(0);
      expect(pdf.buffer.subarray(0, 4).toString()).toBe("%PDF");
    } finally {
      vi.useFakeTimers();
      vi.setSystemTime(now);
    }
  });
});
