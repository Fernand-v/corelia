"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { getTaskStatusBadgeStyle, useFrontendSettings } from "@/lib/frontend-settings";
import { useSession } from "@/lib/session";
import { allTasksQueryKey, mergeTaskIntoList, taskBoardQueryKey } from "@/components/task-board-state";
import { TaskAssigneeSelector, type ProjectMemberOption } from "@/components/task-assignee-selector";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  template: string;
};

type ProjectMemberAvailability = ProjectMemberOption & {
  role: string;
  activeTasks: number;
  maxActiveTasks: number;
};

const allowedRoles = new Set(["ADMINISTRADOR", "LIDER_PROYECTO", "COORDINADOR_EQUIPO"]);

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Sin fecha";
  }

  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const TaskManagementBoard = ({ initialProjectId = "" }: { initialProjectId?: string }) => {
  const session = useSession();
  const { settings: frontendSettings } = useFrontendSettings();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const activeRole = session.data?.activeRole ?? null;
  const authorized = activeRole ? allowedRoles.has(activeRole) : false;

  const projectsQuery = useQuery({
    queryKey: ["projects", "task-management"],
    queryFn: () => apiRequest<ProjectItem[]>("/projects")
  });

  const tasksQuery = useQuery({
    queryKey: ["task-management", "tasks", selectedProjectId],
    queryFn: () => apiRequest<Task[]>(`/tasks?projectId=${encodeURIComponent(selectedProjectId)}`),
    enabled: Boolean(selectedProjectId && authorized)
  });

  const membersQuery = useQuery({
    queryKey: ["task-management", "members", selectedProjectId],
    queryFn: () =>
      apiRequest<ProjectMemberAvailability[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(selectedProjectId)}`
      ),
    enabled: Boolean(selectedProjectId && authorized)
  });

  const taskDetailQuery = useQuery({
    queryKey: ["task-management", "task-detail", expandedTaskId],
    queryFn: () => apiRequest<Task>(`/tasks/${expandedTaskId}`),
    enabled: Boolean(expandedTaskId)
  });

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
      queryClient.setQueryData(["task-management", "task-detail", updatedTask.id], updatedTask);
      queryClient.setQueryData<Task[]>(taskBoardQueryKey(updatedTask.projectId), (current) =>
        mergeTaskIntoList(current, updatedTask)
      );
      queryClient.setQueryData<Task[]>(allTasksQueryKey, (current) => mergeTaskIntoList(current, updatedTask));
      await queryClient.invalidateQueries({ queryKey: ["task-management", "tasks", updatedTask.projectId] });
      await queryClient.invalidateQueries({ queryKey: ["task-management", "task-detail", updatedTask.id] });
      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
    }
  });

  const activateTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; reason: string }) =>
      apiRequest<Task>("/tasks/activate", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (updatedTask) => {
      queryClient.setQueryData<Task[]>(taskBoardQueryKey(updatedTask.projectId), (current) =>
        mergeTaskIntoList(current, updatedTask)
      );
      queryClient.setQueryData<Task[]>(allTasksQueryKey, (current) => mergeTaskIntoList(current, updatedTask));
      await queryClient.invalidateQueries({ queryKey: ["task-management", "tasks", updatedTask.projectId] });
      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
    }
  });

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter && task.status !== statusFilter) {
        return false;
      }

      if (assigneeFilter && task.assigneeId !== assigneeFilter) {
        return false;
      }

      if (overdueOnly) {
        if (!task.dueDate) {
          return false;
        }
        if (new Date(task.dueDate).getTime() >= Date.now()) {
          return false;
        }
      }

      return true;
    });
  }, [assigneeFilter, overdueOnly, statusFilter, tasks]);

  if (!authorized) {
    return (
      <Card>
        <p className="text-sm text-red-600">No tienes permisos para usar Gestión de Tareas.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h1 className="text-xl font-semibold text-slate-900">Gestión de Tareas</h1>
        <p className="text-sm text-slate-600">Reasignación y auditoría breve de tareas del proyecto.</p>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {projectsQuery.data?.map((project) => {
            const selected = project.id === selectedProjectId;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`rounded-xl border px-3 py-2 text-left ${
                  selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold">{project.name}</p>
                <p className={`text-xs ${selected ? "text-slate-200" : "text-slate-600"}`}>{project.template}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="grid gap-2 lg:grid-cols-4">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="COMPLETADA">Completada</option>
          </select>

          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
          >
            <option value="">Todos los responsables</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.fullName}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
            Solo vencidas
          </label>

          <Button
            type="button"
            className="h-10"
            onClick={() => {
              setStatusFilter("");
              setAssigneeFilter("");
              setOverdueOnly(false);
            }}
          >
            Limpiar filtros
          </Button>
        </div>

        {tasksQuery.isLoading ? <p className="text-sm text-slate-500">Cargando tareas...</p> : null}
        {tasksQuery.error ? <p className="text-sm text-red-600">{tasksQuery.error.message}</p> : null}

        <ul className="space-y-3">
          {filteredTasks.map((task) => (
            <li key={task.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-600">
                    Estado:{" "}
                    <span
                      className="inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                      style={getTaskStatusBadgeStyle(task.status, frontendSettings.taskStatusColors)}
                    >
                      {task.status}
                    </span>{" "}
                    · Desde: {formatDateTime(task.startDate)} · Hasta: {formatDateTime(task.dueDate)}
                  </p>
                </div>
                <Link href={`/tasks/${task.id}` as Route} className="text-xs font-medium text-blue-700 hover:underline">
                  Detalle
                </Link>
              </div>

              <TaskAssigneeSelector
                task={task}
                members={members}
                isPending={assignTaskMutation.isPending && assignTaskMutation.variables?.taskId === task.id}
                onAssign={(payload) => assignTaskMutation.mutate(payload)}
              />

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-8 px-3 text-xs"
                  disabled={
                    activateTaskMutation.isPending ||
                    task.status === "PENDIENTE"
                  }
                  onClick={() =>
                    activateTaskMutation.mutate({
                      taskId: task.id,
                      reason: "Activación manual desde Gestión de Tareas"
                    })
                  }
                >
                  {activateTaskMutation.isPending && activateTaskMutation.variables?.taskId === task.id
                    ? "Activando..."
                    : "Activar"}
                </Button>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">Historial breve de reasignaciones</p>
                  <button
                    type="button"
                    className="text-xs text-blue-700 hover:underline"
                    onClick={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                  >
                    {expandedTaskId === task.id ? "Ocultar" : "Ver"}
                  </button>
                </div>

                {expandedTaskId === task.id ? (
                  taskDetailQuery.isLoading ? (
                    <p className="text-xs text-slate-500">Cargando historial...</p>
                  ) : taskDetailQuery.error ? (
                    <p className="text-xs text-red-600">{taskDetailQuery.error.message}</p>
                  ) : (taskDetailQuery.data as any)?.reassignments?.length ? (
                    <ul className="space-y-1 text-xs text-slate-700">
                      {(taskDetailQuery.data as any).reassignments.slice(0, 5).map((item: any) => (
                        <li key={item.id}>
                          {formatDateTime(item.reassignedAt)} · motivo: {item.reason}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Sin reasignaciones registradas.</p>
                  )
                ) : (
                  <p className="text-xs text-slate-500">Presiona “Ver” para revisar movimientos recientes.</p>
                )}
              </div>
            </li>
          ))}

          {filteredTasks.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              No hay tareas que coincidan con los filtros actuales.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
};
