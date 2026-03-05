import { describe, expect, it, vi } from "vitest";
import { TaskService } from "../modules/tasks/service.js";

const createMockApp = () => {
  return {
    prisma: {
      availabilityBlock: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([])
      },
      workSchedule: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      task: {
        create: vi.fn().mockResolvedValue({ id: crypto.randomUUID(), title: "Task" }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: crypto.randomUUID(), status: "PENDIENTE" }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([])
      },
      taskDependency: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
      },
      projectMember: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([])
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([])
      },
      project: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      user: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      meetingParticipant: {
        findMany: vi.fn().mockResolvedValue([])
      },
      taskStatusHistory: {
        create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
      },
      taskReassignment: {
        create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
      },
      taskScheduleHistory: {
        create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
      },
      $transaction: vi.fn()
    }
  } as unknown as ConstructorParameters<typeof TaskService>[0];
};

describe("Task integration flows", () => {
  it("lists tasks in user scope", async () => {
    const app = createMockApp();
    const service = new TaskService(app);

    await service.listTasks(crypto.randomUUID());

    expect(app.prisma.task.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns project members with availability for assignment selectors", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const memberId = crypto.randomUUID();

    app.prisma.project.findUnique = vi.fn().mockResolvedValue({
      id: projectId,
      ownerId: actorId,
      members: [{ userId: actorId }]
    });
    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([
      {
        userId: memberId,
        role: "COLABORADOR",
        joinedAt: new Date(),
        user: {
          id: memberId,
          firstName: "Ana",
          lastName: "Pérez",
          workSchedule: {
            maxActiveTasks: 5
          }
        }
      }
    ]);

    const service = new TaskService(app);
    const members = await service.listProjectMembers(actorId, projectId);

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: memberId,
      fullName: "Ana Pérez",
      initials: "AP",
      availability: "DISPONIBLE"
    });
  });

  it("denies project member listing when actor has no scope on project", async () => {
    const app = createMockApp();
    const actorId = crypto.randomUUID();
    const projectId = crypto.randomUUID();

    app.prisma.project.findUnique = vi.fn().mockResolvedValue({
      id: projectId,
      ownerId: crypto.randomUUID(),
      members: []
    });
    app.prisma.user.findFirst = vi.fn().mockResolvedValue(null);

    const service = new TaskService(app);

    await expect(service.listProjectMembers(actorId, projectId)).rejects.toThrowError(
      "No tienes acceso a los miembros de este proyecto"
    );
  });

  it("creates task when assignee is available", async () => {
    const app = createMockApp();
    const service = new TaskService(app);

    const task = await service.createTask({
      projectId: crypto.randomUUID(),
      title: "Nueva tarea",
      description: "desc",
      assigneeId: crypto.randomUUID(),
      dueDate: new Date().toISOString(),
      status: "PENDIENTE",
      createdById: crypto.randomUUID(),
      confirmOutOfSchedule: true
    });

    expect(task).toHaveProperty("id");
    expect(app.prisma.task.create).toHaveBeenCalledTimes(1);
  });

  it("blocks assignment when user is on vacations", async () => {
    const app = createMockApp();
    app.prisma.availabilityBlock.findFirst = vi.fn().mockResolvedValue({ id: crypto.randomUUID() });

    const service = new TaskService(app);

    await expect(
      service.createTask({
        projectId: crypto.randomUUID(),
        title: "Tarea",
        assigneeId: crypto.randomUUID(),
        status: "PENDIENTE",
        createdById: crypto.randomUUID(),
        confirmOutOfSchedule: true
      })
    ).rejects.toThrowError("vacaciones o ausencia");
  });

  it("requires explicit confirmation for out-of-schedule assignment", async () => {
    const app = createMockApp();
    app.prisma.workSchedule.findUnique = vi.fn().mockResolvedValue({
      weekDays: [],
      startHour: "09:00",
      endHour: "18:00",
      maxActiveTasks: 10
    });

    const service = new TaskService(app);

    await expect(
      service.createTask({
        projectId: crypto.randomUUID(),
        title: "Tarea fuera de jornada",
        assigneeId: crypto.randomUUID(),
        status: "PENDIENTE",
        createdById: crypto.randomUUID(),
        confirmOutOfSchedule: false
      })
    ).rejects.toThrowError("Requiere confirmación explícita");
  });

  it("enforces max active tasks per assignee", async () => {
    const app = createMockApp();
    const now = new Date();
    app.prisma.workSchedule.findUnique = vi.fn().mockResolvedValue({
      weekDays: [now.getDay()],
      startHour: "00:00",
      endHour: "23:59",
      maxActiveTasks: 1
    });
    app.prisma.task.count = vi.fn().mockResolvedValue(1);

    const service = new TaskService(app);

    await expect(
      service.createTask({
        projectId: crypto.randomUUID(),
        title: "Sobrecarga",
        assigneeId: crypto.randomUUID(),
        status: "PENDIENTE",
        createdById: crypto.randomUUID(),
        confirmOutOfSchedule: true
      })
    ).rejects.toThrowError("límite de tareas activas");
  });

  it("changes status and stores task status history", async () => {
    const app = createMockApp();
    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      status: "PENDIENTE"
    });

    const service = new TaskService(app);

    await service.changeStatus({
      taskId: crypto.randomUUID(),
      status: "EN_REVISION",
      reason: "Inicio",
      changedById: crypto.randomUUID(),
      activeRole: "ADMINISTRADOR"
    });

    expect(app.prisma.taskStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it("allows moving task to review even when dependencies remain unresolved", async () => {
    const app = createMockApp();
    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      status: "PENDIENTE"
    });
    app.prisma.taskDependency.findMany = vi.fn().mockResolvedValue([{ dependsOnTaskId: crypto.randomUUID() }]);

    const service = new TaskService(app);

    const updated = await service.changeStatus({
      taskId: crypto.randomUUID(),
      status: "EN_REVISION",
      reason: "Inicio",
      changedById: crypto.randomUUID(),
      activeRole: "ADMINISTRADOR"
    });

    expect(updated).toHaveProperty("id");
  });

  it("rejects self dependency", async () => {
    const app = createMockApp();
    const service = new TaskService(app);
    const id = crypto.randomUUID();

    await expect(service.addDependency({ taskId: id, dependsOnTaskId: id })).rejects.toThrowError(
      "no puede depender de sí misma"
    );
  });

  it("returns canStart false when dependencies remain", async () => {
    const app = createMockApp();
    app.prisma.taskDependency.findMany = vi.fn().mockResolvedValue([{ dependsOnTaskId: crypto.randomUUID() }]);

    const service = new TaskService(app);
    const result = await service.canStart(crypto.randomUUID());

    expect(result.canStart).toBe(false);
    expect(result.unresolvedDependencies.length).toBe(1);
  });

  it("updates schedule when dates are valid", async () => {
    const app = createMockApp();
    const taskId = crypto.randomUUID();

    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: taskId,
      startDate: null,
      dueDate: null
    });
    app.prisma.$transaction = vi.fn().mockImplementation(async (cb) =>
      cb({
        task: {
          update: vi.fn().mockResolvedValue({
            id: taskId,
            startDate: new Date("2026-03-01T10:00:00.000Z"),
            dueDate: new Date("2026-03-02T10:00:00.000Z")
          })
        },
        taskScheduleHistory: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      })
    );

    const service = new TaskService(app);
    const updated = await service.updateSchedule({
      taskId,
      startDate: "2026-03-01T10:00:00.000Z",
      dueDate: "2026-03-02T10:00:00.000Z",
      reason: "Ajuste manual de prueba",
      changedById: crypto.randomUUID()
    });

    expect(updated).toHaveProperty("id", taskId);
    expect(app.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("finalizes task and activates next task in project flow", async () => {
    const app = createMockApp();
    const taskId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const nextTaskId = crypto.randomUUID();
    const assigneeId = crypto.randomUUID();

    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: taskId,
      projectId,
      title: "Tarea actual",
      status: "EN_REVISION",
      assigneeId
    });

    app.prisma.$transaction = vi.fn().mockImplementation(async (cb) =>
      cb({
        task: {
          update: vi
            .fn()
            .mockResolvedValueOnce({
              id: taskId,
              projectId,
              title: "Tarea actual",
              status: "COMPLETADA",
              assigneeId
            })
            .mockResolvedValueOnce({
              id: nextTaskId,
              projectId,
              title: "Siguiente tarea",
              status: "PENDIENTE",
              assigneeId
            }),
          findMany: vi.fn().mockResolvedValue([
            {
              id: nextTaskId,
              projectId,
              title: "Siguiente tarea",
              status: "PENDIENTE",
              dueDate: new Date("2026-03-10T10:00:00.000Z"),
              createdAt: new Date("2026-03-01T09:00:00.000Z"),
              assigneeId
            }
          ])
        },
        taskStatusHistory: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      })
    );

    app.prisma.projectMember.findMany = vi.fn().mockResolvedValue([{ userId: crypto.randomUUID() }]);

    const service = new TaskService(app);
    const result = await service.finalizeAndAdvance({
      taskId,
      changedById: assigneeId,
      activeRole: "COLABORADOR"
    });

    expect(result.completedTask.status).toBe("COMPLETADA");
    expect(result.nextTask?.status).toBe("PENDIENTE");
    expect(app.prisma.notification.create).toHaveBeenCalled();
  });

  it("forbids reassignment of completed task without reopen flag", async () => {
    const app = createMockApp();
    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      status: "COMPLETADA",
      assigneeId: crypto.randomUUID(),
      title: "Task completada",
      completedAt: new Date()
    });

    const service = new TaskService(app);

    await expect(
      service.reassign({
        taskId: crypto.randomUUID(),
        newAssigneeId: crypto.randomUUID(),
        reason: "Cambio",
        reopenIfCompleted: false,
        requestedById: crypto.randomUUID(),
        activeRole: "ADMINISTRADOR"
      })
    ).rejects.toThrowError("No se puede reasignar una tarea completada");
  });

  it("forbids collaborator direct reassignment", async () => {
    const app = createMockApp();
    const service = new TaskService(app);

    await expect(
      service.reassign({
        taskId: crypto.randomUUID(),
        newAssigneeId: crypto.randomUUID(),
        reason: "Cambio",
        reopenIfCompleted: true,
        requestedById: crypto.randomUUID(),
        activeRole: "COLABORADOR"
      })
    ).rejects.toThrowError("No tienes permiso para reasignar");
  });

  it("reassigns and reopens completed task with authorized role", async () => {
    const app = createMockApp();
    const previousAssigneeId = crypto.randomUUID();

    app.prisma.task.findUnique = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      status: "COMPLETADA",
      assigneeId: previousAssigneeId,
      title: "Task completada",
      completedAt: new Date()
    });

    app.prisma.$transaction = vi.fn().mockImplementation(async (cb) =>
      cb({
        task: {
          update: vi.fn().mockResolvedValue({ id: crypto.randomUUID(), status: "PENDIENTE" })
        },
        taskReassignment: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        },
        taskStatusHistory: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      })
    );

    const service = new TaskService(app);

    const task = await service.reassign({
      taskId: crypto.randomUUID(),
      newAssigneeId: crypto.randomUUID(),
      reason: "Cambio aprobado",
      reopenIfCompleted: true,
      requestedById: crypto.randomUUID(),
      activeRole: "ADMINISTRADOR"
    });

    expect(task.status).toBe("PENDIENTE");
    expect(app.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(app.prisma.notification.create).toHaveBeenCalledTimes(2);
  });
});
