"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskStatus } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  allTasksQueryKey,
  filterMyTasks,
  filterUnassignedTasks,
  mergeTaskIntoList,
  taskBoardQueryKey
} from "@/components/task-board-state";
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

const createTaskFormSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal(""))
});

type CreateTaskForm = z.infer<typeof createTaskFormSchema>;

const statusColumns: Array<{ status: TaskStatus; label: string }> = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "PENDIENTE", label: "Pendiente" },
  { status: "EN_PROGRESO", label: "En progreso" },
  { status: "EN_REVISION", label: "En revisión" },
  { status: "BLOQUEADA", label: "Bloqueada" },
  { status: "COMPLETADA", label: "Completada" },
  { status: "CANCELADA", label: "Cancelada" }
];

const assignerRoles = new Set(["ADMINISTRADOR", "LIDER_PROYECTO", "COORDINADOR_EQUIPO"]);

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Sin fecha";
  }

  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const TaskBoard = ({
  initialProjectId = "",
  lockProjectSelection = false,
  showPersonalPanels = true
}: {
  initialProjectId?: string;
  lockProjectSelection?: boolean;
  showPersonalPanels?: boolean;
}) => {
  const session = useSession();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      dueDate: ""
    }
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiRequest<ProjectItem[]>("/projects")
  });

  useEffect(() => {
    if (lockProjectSelection) {
      return;
    }

    if (!selectedProjectId && projectsQuery.data && projectsQuery.data.length > 0) {
      setSelectedProjectId(projectsQuery.data[0]!.id);
    }
  }, [lockProjectSelection, projectsQuery.data, selectedProjectId]);

  useEffect(() => {
    if (!initialProjectId) {
      return;
    }
    setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  const tasksQuery = useQuery({
    queryKey: selectedProjectId ? taskBoardQueryKey(selectedProjectId) : ["tasks", "project", "none"],
    queryFn: () => apiRequest<Task[]>(`/tasks?projectId=${encodeURIComponent(selectedProjectId)}`),
    enabled: Boolean(selectedProjectId)
  });

  const allTasksQuery = useQuery({
    queryKey: allTasksQueryKey,
    queryFn: () => apiRequest<Task[]>("/tasks"),
    enabled: Boolean(session.data?.id)
  });

  const membersQuery = useQuery({
    queryKey: ["tasks", "project-members", selectedProjectId],
    queryFn: () =>
      apiRequest<ProjectMemberAvailability[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(selectedProjectId)}`
      ),
    enabled: Boolean(selectedProjectId)
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: {
      projectId: string;
      title: string;
      description?: string;
      assigneeId?: string;
      dueDate?: string;
      status: TaskStatus;
    }) =>
      apiRequest<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (createdTask) => {
      form.reset({
        title: "",
        description: "",
        assigneeId: "",
        dueDate: ""
      });

      queryClient.setQueryData<Task[]>(
        taskBoardQueryKey(createdTask.projectId),
        (current) => mergeTaskIntoList(current, createdTask)
      );
      queryClient.setQueryData<Task[]>(
        allTasksQueryKey,
        (current) => mergeTaskIntoList(current, createdTask)
      );

      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(createdTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
    }
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
      queryClient.setQueryData<Task[]>(
        taskBoardQueryKey(updatedTask.projectId),
        (current) => mergeTaskIntoList(current, updatedTask)
      );
      queryClient.setQueryData<Task[]>(
        allTasksQueryKey,
        (current) => mergeTaskIntoList(current, updatedTask)
      );

      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
    }
  });

  const activeRole = session.data?.activeRole ?? null;
  const canAssign = activeRole ? assignerRoles.has(activeRole) : false;
  const projectTasks = tasksQuery.data ?? [];
  const allTasks = allTasksQuery.data ?? [];
  const myTasks = filterMyTasks(allTasks, session.data?.id ?? null);
  const projectUnassignedTasks = filterUnassignedTasks(projectTasks);
  const projectMap = new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name]));

  const members = membersQuery.data ?? [];
  const membersById = new Map(members.map((member) => [member.userId, member]));
  const selectedProject = useMemo(
    () => projectsQuery.data?.find((project) => project.id === selectedProjectId) ?? null,
    [projectsQuery.data, selectedProjectId]
  );

  const projectTasksByStatus = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    return statusColumns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.status)
    }));
  }, [tasksQuery.data]);

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Proyectos</p>
          {projectsQuery.isLoading ? <p className="text-sm text-slate-500">Cargando proyectos...</p> : null}
          {projectsQuery.error ? <p className="text-sm text-red-600">{projectsQuery.error.message}</p> : null}
          {!lockProjectSelection ? (
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
                    <p className={`text-xs ${selected ? "text-slate-200" : "text-slate-600"}`}>
                      {project.template}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedProject ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{selectedProject.name}</p>
              <p className="text-xs text-slate-600">
                {selectedProject.description || "Sin descripción"}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Crear tarea</h2>

          <form
            className="space-y-2"
            onSubmit={form.handleSubmit((values) => {
              if (!selectedProjectId) {
                return;
              }

              const payload: {
                projectId: string;
                title: string;
                status: TaskStatus;
                description?: string;
                assigneeId?: string;
                dueDate?: string;
              } = {
                projectId: selectedProjectId,
                title: values.title.trim(),
                status: "BACKLOG"
              };

              if (values.description?.trim()) {
                payload.description = values.description.trim();
              }

              if (values.assigneeId) {
                payload.assigneeId = values.assigneeId;
              }

              if (values.dueDate) {
                payload.dueDate = new Date(values.dueDate).toISOString();
              }

              createTaskMutation.mutate({
                ...payload
              });
            })}
          >
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Título"
              {...form.register("title")}
            />
            <textarea
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Descripción"
              rows={4}
              {...form.register("description")}
            />

            <label className="text-xs text-slate-600" htmlFor="create-task-assignee">
              Responsable (opcional)
            </label>
            <select
              id="create-task-assignee"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              {...form.register("assigneeId")}
            >
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName} · {member.availability}
                </option>
              ))}
            </select>

            <input className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" type="datetime-local" {...form.register("dueDate")} />

            {createTaskMutation.error ? (
              <p className="text-sm text-red-600">{createTaskMutation.error.message}</p>
            ) : null}

            <Button
              className="w-full"
              type="submit"
              disabled={createTaskMutation.isPending || !selectedProjectId}
            >
              {createTaskMutation.isPending ? "Guardando..." : "Guardar tarea"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Tablero del proyecto</h2>

          {tasksQuery.isLoading ? <p className="text-sm text-slate-500">Cargando tareas...</p> : null}
          {tasksQuery.error ? <p className="text-sm text-red-600">{tasksQuery.error.message}</p> : null}

          {!selectedProjectId ? (
            <p className="text-sm text-slate-600">Selecciona un proyecto para ver su tablero.</p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-4">
              {projectTasksByStatus.map((column) => (
                <div key={column.status} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {column.label} ({column.tasks.length})
                  </h3>
                  <ul className="space-y-2">
                    {column.tasks.map((task) => (
                      <li key={task.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{task.title}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(task.dueDate)}</p>
                          </div>
                          <Link
                            href={`/tasks/${task.id}` as Route}
                            className="text-xs font-medium text-blue-700 hover:underline"
                          >
                            Detalle
                          </Link>
                        </div>

                        {task.assigneeId ? (
                          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                            Responsable: {membersById.get(task.assigneeId)?.fullName ?? "Asignado"}
                          </p>
                        ) : (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                            Sin asignar
                          </p>
                        )}

                        {canAssign ? (
                          <TaskAssigneeSelector
                            task={task}
                            members={members}
                            isPending={assignTaskMutation.isPending && assignTaskMutation.variables?.taskId === task.id}
                            onAssign={(payload) => assignTaskMutation.mutate(payload)}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showPersonalPanels ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Mis Tareas</h2>
            <p className="text-xs text-slate-500">Solo tareas con responsable asignado a tu usuario.</p>

            {allTasksQuery.isLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
            {allTasksQuery.error ? <p className="text-sm text-red-600">{allTasksQuery.error.message}</p> : null}

            {myTasks.length === 0 ? (
              <p className="text-sm text-slate-600">No tienes tareas asignadas.</p>
            ) : (
              <ul className="space-y-2">
                {myTasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-600">
                          {projectMap.get(task.projectId) ?? "Proyecto"} · {task.status}
                        </p>
                      </div>
                      <Link href={`/tasks/${task.id}` as Route} className="text-xs text-blue-700 hover:underline">
                        Ver detalle
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canAssign ? (
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Pendientes de asignación</h2>
              <p className="text-xs text-slate-500">
                Tareas sin responsable del proyecto activo (no aparecen en Mis Tareas hasta asignarse).
              </p>

              {projectUnassignedTasks.length === 0 ? (
                <p className="text-sm text-slate-600">No hay tareas sin asignar en este proyecto.</p>
              ) : (
                <ul className="space-y-2">
                  {projectUnassignedTasks.map((task) => (
                    <li key={task.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      <TaskAssigneeSelector
                        task={task}
                        members={members}
                        isPending={assignTaskMutation.isPending && assignTaskMutation.variables?.taskId === task.id}
                        onAssign={(payload) => assignTaskMutation.mutate(payload)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
