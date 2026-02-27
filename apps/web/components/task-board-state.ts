import type { Task } from "@corelia/types";

export const taskBoardQueryKey = (projectId: string) =>
  ["tasks", "project", projectId] as const;

export const allTasksQueryKey = ["tasks", "all"] as const;

export const mergeTaskIntoList = (tasks: Task[] | undefined, task: Task): Task[] => {
  const current = tasks ?? [];
  const next = [task, ...current.filter((item) => item.id !== task.id)];
  return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const filterProjectTasks = (tasks: Task[] | undefined, projectId: string | null): Task[] => {
  if (!tasks || !projectId) {
    return [];
  }
  return tasks.filter((task) => task.projectId === projectId);
};

export const filterMyTasks = (tasks: Task[] | undefined, currentUserId: string | null): Task[] => {
  if (!tasks || !currentUserId) {
    return [];
  }

  return tasks.filter((task) => task.assigneeId === currentUserId);
};

export const filterUnassignedTasks = (tasks: Task[] | undefined): Task[] => {
  if (!tasks) {
    return [];
  }

  return tasks.filter((task) => task.assigneeId === null);
};

export const buildTaskReassignmentPayload = (input: {
  taskId: string;
  newAssigneeId: string;
  reason: string;
}) => ({
  taskId: input.taskId,
  newAssigneeId: input.newAssigneeId,
  reason: input.reason,
  reopenIfCompleted: false
});

export const taskAssignmentVisibleFieldNames = ["assigneeSelector", "reason"] as const;
