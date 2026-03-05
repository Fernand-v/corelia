import { describe, expect, it } from "vitest";
import type { Task } from "@corelia/types";
import {
  buildTaskReassignmentPayload,
  filterMyTasks,
  filterProjectTasks,
  mergeTaskIntoList,
  taskAssignmentVisibleFieldNames
} from "@/components/task-board-state";

const makeTask = (overrides: Partial<Task>): Task => ({
  id: "7a2b1ce4-fc80-4c14-a8df-b5b4f2b07401",
  projectId: "5cb60c77-63ea-45da-bbb6-f94818ad30b4",
  title: "Tarea base",
  description: null,
  assigneeId: null,
  status: "PENDIENTE",
  startDate: null,
  dueDate: null,
  blockedReason: null,
  blockingTaskId: null,
  createdById: "29e414ef-a532-4c65-bd92-a7ed1ef21f85",
  createdAt: "2026-02-27T09:00:00.000Z",
  updatedAt: "2026-02-27T09:00:00.000Z",
  ...overrides
});

describe("task board state", () => {
  it("creates task and shows it in board immediately without reload", () => {
    const projectId = "5cb60c77-63ea-45da-bbb6-f94818ad30b4";
    const existing = [
      makeTask({
        id: "25f9d1c7-9c84-40b7-a427-e6d360d0ea8f",
        projectId,
        title: "Anterior"
      })
    ];

    const created = makeTask({
      id: "f23c1f56-53c2-4ec4-ab6a-2e35d7535f71",
      projectId,
      title: "Nueva",
      createdAt: "2026-02-27T10:00:00.000Z",
      updatedAt: "2026-02-27T10:00:00.000Z"
    });

    const merged = mergeTaskIntoList(existing, created);
    const board = filterProjectTasks(merged, projectId);

    expect(board.map((task) => task.id)).toContain(created.id);
    expect(board[0]?.id).toBe(created.id);
  });

  it("shows task with assignee in My Tasks", () => {
    const userId = "6da5c4d8-aed6-4eac-aec7-438f6d72a4b4";
    const tasks = [
      makeTask({
        id: "cf7bbffe-95ca-4e65-b1ec-2c60a6facbf0",
        assigneeId: userId
      }),
      makeTask({
        id: "d18f7ff7-b4e5-42e5-b05f-8c9f4cb6f660",
        assigneeId: null
      })
    ];

    const myTasks = filterMyTasks(tasks, userId);
    expect(myTasks.map((task) => task.id)).toEqual(["cf7bbffe-95ca-4e65-b1ec-2c60a6facbf0"]);
  });

  it("does not show unassigned task in My Tasks but keeps it in project board", () => {
    const userId = "6da5c4d8-aed6-4eac-aec7-438f6d72a4b4";
    const projectId = "5cb60c77-63ea-45da-bbb6-f94818ad30b4";
    const unassigned = makeTask({
      id: "2cf9a57d-5254-4a53-a6b2-8a2771cba640",
      assigneeId: null,
      projectId
    });

    const tasks = [unassigned];
    const myTasks = filterMyTasks(tasks, userId);
    const boardTasks = filterProjectTasks(tasks, projectId);

    expect(myTasks).toHaveLength(0);
    expect(boardTasks.map((task) => task.id)).toEqual([unassigned.id]);
  });

  it("builds assignment payload with internal taskId and keeps taskId out of visible inputs", () => {
    const payload = buildTaskReassignmentPayload({
      taskId: "a8df15bb-9fff-42bf-b10f-f56d4bbf17c0",
      newAssigneeId: "3c7dd383-0267-4250-bf3c-72f4a95fd1b3",
      reason: "Asignación desde tarjeta"
    });

    expect(payload.taskId).toBe("a8df15bb-9fff-42bf-b10f-f56d4bbf17c0");
    expect(taskAssignmentVisibleFieldNames).not.toContain("taskId");
  });
});
