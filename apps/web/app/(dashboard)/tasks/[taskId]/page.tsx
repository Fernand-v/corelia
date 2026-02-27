"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@corelia/types";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { TaskAssigneeSelector, type ProjectMemberOption } from "@/components/task-assignee-selector";
import { allTasksQueryKey, mergeTaskIntoList, taskBoardQueryKey } from "@/components/task-board-state";

type ProjectMemberAvailability = ProjectMemberOption & {
  role: string;
  activeTasks: number;
  maxActiveTasks: number;
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Sin fecha";
  }

  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const queryClient = useQueryClient();
  const [showSelector, setShowSelector] = useState(false);

  const taskId = params.taskId;

  const taskQuery = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => apiRequest<Task>(`/tasks/${taskId}`),
    enabled: Boolean(taskId)
  });

  const membersQuery = useQuery({
    queryKey: ["tasks", "project-members", taskQuery.data?.projectId],
    queryFn: () =>
      apiRequest<ProjectMemberAvailability[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(taskQuery.data!.projectId)}`
      ),
    enabled: Boolean(taskQuery.data?.projectId)
  });

  const members = membersQuery.data ?? [];
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members]
  );

  const assignTaskMutation = useMutation({
    mutationFn: (payload: {
      taskId: string;
      newAssigneeId: string;
      reason: string;
      reopenIfCompleted: boolean;
    }) =>
      apiRequest<Task>("/tasks/reassign", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (updatedTask) => {
      queryClient.setQueryData(["task-detail", updatedTask.id], updatedTask);
      queryClient.setQueryData<Task[]>(
        taskBoardQueryKey(updatedTask.projectId),
        (current) => mergeTaskIntoList(current, updatedTask)
      );
      queryClient.setQueryData<Task[]>(
        allTasksQueryKey,
        (current) => mergeTaskIntoList(current, updatedTask)
      );

      await queryClient.invalidateQueries({ queryKey: ["task-detail", updatedTask.id] });
      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
      setShowSelector(false);
    }
  });

  if (taskQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <Card>
          <p className="text-sm text-slate-600">Cargando tarea...</p>
        </Card>
      </main>
    );
  }

  if (taskQuery.error || !taskQuery.data) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
        <Card>
          <p className="text-sm text-red-600">
            {taskQuery.error?.message ?? "No se pudo cargar la tarea"}
          </p>
        </Card>
      </main>
    );
  }

  const task = taskQuery.data;
  const assignee = task.assigneeId ? membersById.get(task.assigneeId) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <Card className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Detalle de tarea</p>
          <h1 className="text-2xl font-semibold text-slate-900">{task.title}</h1>
          <p className="text-sm text-slate-600">
            Estado: {task.status} · Fecha límite: {formatDateTime(task.dueDate)}
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Descripción</p>
          <p className="mt-1 text-sm text-slate-700">{task.description ?? "Sin descripción"}</p>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <button
            type="button"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setShowSelector((current) => !current)}
          >
            Responsable: {assignee?.fullName ?? "Sin asignar"} (clic para {showSelector ? "ocultar" : "editar"})
          </button>

          {showSelector ? (
            <>
              {membersQuery.isLoading ? <p className="text-sm text-slate-600">Cargando miembros...</p> : null}
              {membersQuery.error ? <p className="text-sm text-red-600">{membersQuery.error.message}</p> : null}
              <TaskAssigneeSelector
                task={task}
                members={members}
                isPending={assignTaskMutation.isPending}
                onAssign={(payload) => assignTaskMutation.mutate(payload)}
              />
            </>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
