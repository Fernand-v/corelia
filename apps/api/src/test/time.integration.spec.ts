import { describe, expect, it, vi } from "vitest";
import { TimeService } from "../modules/time/service.js";

const createMockApp = () =>
  ({
    prisma: {
      task: {
        findUnique: vi.fn()
      },
      project: {
        findUnique: vi.fn()
      },
      projectMember: {
        findFirst: vi.fn()
      },
      timeEntry: {
        create: vi.fn(),
        aggregate: vi.fn()
      }
    }
  }) as unknown as ConstructorParameters<typeof TimeService>[0];

describe("TimeService", () => {
  it("rejects time entries for tasks outside the actor project scope", async () => {
    const app = createMockApp();
    app.prisma.task.findUnique = vi.fn().mockResolvedValue({ projectId: "project-1" });
    app.prisma.project.findUnique = vi.fn().mockResolvedValue({ ownerId: "owner-1" });
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue(null);

    const service = new TimeService(app);

    await expect(
      service.createEntry({
        taskId: crypto.randomUUID(),
        userId: "user-1",
        minutes: 30,
        activeRoleRank: 2
      })
    ).rejects.toThrowError("No tienes acceso al proyecto de la tarea");

    expect(app.prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it("aggregates own visible time entries without loading rows", async () => {
    const app = createMockApp();
    app.prisma.task.findUnique = vi.fn().mockResolvedValue({ projectId: "project-1" });
    app.prisma.project.findUnique = vi.fn().mockResolvedValue({ ownerId: "owner-1" });
    app.prisma.projectMember.findFirst = vi.fn().mockResolvedValue({ userId: "user-1" });
    app.prisma.timeEntry.aggregate = vi.fn().mockResolvedValue({ _sum: { minutes: 75 } });

    const service = new TimeService(app);
    const result = await service.summary({
      actorId: "user-1",
      activeRoleRank: 2,
      taskId: crypto.randomUUID()
    });

    expect(result.totalMinutes).toBe(75);
    expect(app.prisma.timeEntry.aggregate).toHaveBeenCalledWith({
      where: {
        taskId: expect.any(String),
        userId: "user-1",
        task: {
          projectId: "project-1"
        }
      },
      _sum: {
        minutes: true
      }
    });
  });
});
