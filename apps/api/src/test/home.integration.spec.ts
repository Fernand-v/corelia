import { describe, expect, it, vi } from "vitest";
import { HomeService } from "../modules/home/service.js";

vi.mock("../config/env.js", () => ({
  env: {
    CORELIA_APP_URL: "http://localhost",
    ORGANIZATION_NAME: "Corelia Test"
  }
}));

vi.mock("../lib/frontend-settings.js", () => ({
  getFrontendSettings: vi.fn().mockResolvedValue({ organizationName: "Corelia Test" })
}));

vi.mock("../modules/status/service.js", () => ({
  StatusService: vi.fn().mockImplementation(() => ({
    getCurrent: vi.fn().mockResolvedValue(null)
  }))
}));

vi.mock("../modules/announcements/content.js", () => ({
  parseAnnouncementBody: vi.fn((body: string) => body)
}));

const PROJECT_IDS = ["p-1", "p-2", "p-3"];

const createMockApp = () =>
  ({
    prisma: {
      project: {
        findMany: vi.fn().mockResolvedValue(
          PROJECT_IDS.map((id) => ({ id, name: `Proyecto ${id}` }))
        ),
        findUnique: vi.fn()
      },
      task: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null)
      },
      objective: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0)
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-1",
          firstName: "Carlos",
          lastName: "López",
          baseRole: { key: "COLABORADOR", rank: 2, rolePermissions: [] }
        })
      },
      announcement: {
        findMany: vi.fn().mockResolvedValue([])
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([])
      },
      taskStatusHistory: {
        findMany: vi.fn().mockResolvedValue([])
      },
      taskReassignment: {
        findMany: vi.fn().mockResolvedValue([])
      },
      meeting: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      formRequest: {
        count: vi.fn().mockResolvedValue(0)
      },
      decision: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([])
      },
      projectMember: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([])
      },
      team: {
        findMany: vi.fn().mockResolvedValue([])
      },
      availabilityBlock: {
        findMany: vi.fn().mockResolvedValue([])
      }
    }
  }) as unknown as ConstructorParameters<typeof HomeService>[0];

describe("HomeService — batchComputeProjectProgress", () => {
  it("returns empty array when no projects provided", async () => {
    const app = createMockApp();
    const service = new HomeService(app);

    const result = await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<unknown[]>;
      }
    ).batchComputeProjectProgress([], "u-1");

    expect(result).toHaveLength(0);
    expect(app.prisma.task.findMany).not.toHaveBeenCalled();
  });

  it("issues only 2 queries for multiple projects (not N×6)", async () => {
    const app = createMockApp();
    app.prisma.task.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([]);
    const service = new HomeService(app);

    const projects = PROJECT_IDS.map((id) => ({ id, name: `Proyecto ${id}` }));
    await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<unknown[]>;
      }
    ).batchComputeProjectProgress(projects, "u-1");

    // Only 1 tasks query + 1 objectives query, not 6×N
    expect(app.prisma.task.findMany).toHaveBeenCalledTimes(1);
    expect(app.prisma.objective.findMany).toHaveBeenCalledTimes(1);
  });

  it("computes correct completion percentage", async () => {
    const app = createMockApp();
    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      { projectId: "p-1", status: "COMPLETADA", assigneeId: "u-1", dueDate: null },
      { projectId: "p-1", status: "COMPLETADA", assigneeId: "u-1", dueDate: null },
      { projectId: "p-1", status: "PENDIENTE", assigneeId: "u-1", dueDate: null }
    ]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([]);
    const service = new HomeService(app);

    const results = await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<{ projectId: string; completionPct: number; risk: boolean }[]>;
      }
    ).batchComputeProjectProgress([{ id: "p-1", name: "P1" }], "u-1");

    expect(results[0]!.completionPct).toBeCloseTo(66.67, 0);
    expect(results[0]!.risk).toBe(false);
  });

  it("flags risk when blocked percentage exceeds 20%", async () => {
    const app = createMockApp();
    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      { projectId: "p-1", status: "EN_REVISION", assigneeId: "u-1", dueDate: null },
      { projectId: "p-1", status: "EN_REVISION", assigneeId: "u-1", dueDate: null },
      { projectId: "p-1", status: "EN_REVISION", assigneeId: "u-1", dueDate: null },
      { projectId: "p-1", status: "PENDIENTE", assigneeId: "u-1", dueDate: null }
    ]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([]);
    const service = new HomeService(app);

    const results = await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<{ projectId: string; risk: boolean; blockedPct: number }[]>;
      }
    ).batchComputeProjectProgress([{ id: "p-1", name: "P1" }], "u-1");

    expect(results[0]!.blockedPct).toBe(75);
    expect(results[0]!.risk).toBe(true);
  });

  it("flags risk when there are overdue open tasks", async () => {
    const past = new Date(Date.now() - 86_400_000); // yesterday
    const app = createMockApp();
    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      { projectId: "p-1", status: "PENDIENTE", assigneeId: "u-1", dueDate: past }
    ]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([]);
    const service = new HomeService(app);

    const results = await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<{ risk: boolean; overdueOpenTasks: number }[]>;
      }
    ).batchComputeProjectProgress([{ id: "p-1", name: "P1" }], "u-1");

    expect(results[0]!.overdueOpenTasks).toBe(1);
    expect(results[0]!.risk).toBe(true);
  });

  it("assigns nextMilestone from the nearest upcoming objective", async () => {
    const future1 = new Date(Date.now() + 2 * 86_400_000);
    const future2 = new Date(Date.now() + 10 * 86_400_000);
    const app = createMockApp();
    app.prisma.task.findMany = vi.fn().mockResolvedValue([]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([
      { projectId: "p-1", title: "Hito cercano", targetDate: future1 },
      { projectId: "p-1", title: "Hito lejano", targetDate: future2 }
    ]);
    const service = new HomeService(app);

    const results = await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<{ nextMilestone: { title: string } | null }[]>;
      }
    ).batchComputeProjectProgress([{ id: "p-1", name: "P1" }], "u-1");

    // Should return the nearest milestone (first due to orderBy asc in query)
    expect(results[0]!.nextMilestone?.title).toBe("Hito cercano");
  });

  it("isolates task counts between multiple projects", async () => {
    const app = createMockApp();
    app.prisma.task.findMany = vi.fn().mockResolvedValue([
      { projectId: "p-1", status: "COMPLETADA", assigneeId: "u-1", dueDate: null },
      { projectId: "p-2", status: "PENDIENTE", assigneeId: "u-1", dueDate: null },
      { projectId: "p-2", status: "PENDIENTE", assigneeId: "u-1", dueDate: null }
    ]);
    app.prisma.objective.findMany = vi.fn().mockResolvedValue([]);
    const service = new HomeService(app);

    const results = await (
      service as unknown as {
        batchComputeProjectProgress: (
          projects: { id: string; name: string }[],
          userId: string
        ) => Promise<{ projectId: string; completionPct: number }[]>;
      }
    ).batchComputeProjectProgress(
      [
        { id: "p-1", name: "P1" },
        { id: "p-2", name: "P2" }
      ],
      "u-1"
    );

    expect(results[0]!.completionPct).toBe(100); // p-1: 1/1 completed
    expect(results[1]!.completionPct).toBe(0); // p-2: 0/2 completed
  });
});
