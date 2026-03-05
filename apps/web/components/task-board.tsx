"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import Link from "next/link";
import type { Route } from "next";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectStage, Task, TaskStatus } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";
import { allTasksQueryKey, filterMyTasks, mergeTaskIntoList, taskBoardQueryKey } from "@/components/task-board-state";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  template: string;
};

type ProjectMemberAvailability = {
  userId: string;
  fullName: string;
  initials: string;
  availability: "DISPONIBLE" | "OCUPADO" | "EN_REUNION" | "AUSENTE";
  role: string;
  activeTasks: number;
  maxActiveTasks: number;
};

type ViewMode = "cards" | "gantt";

type GanttDraftRange = {
  startMs: number;
  endMs: number;
};

type TaskDetail = Task & {
  stage?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  statusHistory?: Array<{
    id: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    reason: string;
    changedAt: string;
    changedBy?: { id: string; firstName: string; lastName: string } | null;
  }>;
  reassignments?: Array<{
    id: string;
    reason: string;
    reassignedAt: string;
    previousAssigneeId: string | null;
    newAssigneeId: string;
    reassignedBy?: { id: string; firstName: string; lastName: string } | null;
  }>;
  scheduleHistory?: Array<{
    id: string;
    previousStartDate: string | null;
    previousDueDate: string | null;
    newStartDate: string | null;
    newDueDate: string | null;
    reason: string;
    changedAt: string;
    changedBy?: { id: string; firstName: string; lastName: string } | null;
  }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STAGE_COLOR = "#4F7CFF";
const NO_STAGE_COLOR = "#64748B";
const GANTT_STATUS_COLORS: Record<TaskStatus, string> = {
  PENDIENTE: "#F59E0B",
  EN_REVISION: "#2563EB",
  COMPLETADA: "#16A34A"
};

const createTaskFormSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(4000).optional(),
    stageId: z.string().uuid().optional().or(z.literal("")),
    assigneeId: z.string().uuid().optional().or(z.literal("")),
    startDate: z.string().optional().or(z.literal("")),
    dueDate: z.string().optional().or(z.literal(""))
  })
  .superRefine((value, ctx) => {
    if (!value.startDate || !value.dueDate) {
      return;
    }

    const startAt = new Date(value.startDate).getTime();
    const endAt = new Date(value.dueDate).getTime();
    if (startAt > endAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha desde no puede ser mayor que la fecha hasta.",
        path: ["dueDate"]
      });
    }
  });

type CreateTaskForm = z.infer<typeof createTaskFormSchema>;

const createStageFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido. Usa formato #RRGGBB.")
});

type CreateStageForm = z.infer<typeof createStageFormSchema>;

const statusColumns: Array<{ status: TaskStatus; label: string }> = [
  { status: "PENDIENTE", label: "Pendiente" },
  { status: "EN_REVISION", label: "En revisión" },
  { status: "COMPLETADA", label: "Completada" }
];

const ganttEditorRoles = new Set(["ADMINISTRADOR", "LIDER_PROYECTO"]);
const taskFlowManagerRoles = new Set(["ADMINISTRADOR", "LIDER_PROYECTO", "COORDINADOR_EQUIPO"]);

const statusPriority: Record<TaskStatus, number> = {
  PENDIENTE: 0,
  EN_REVISION: 1,
  COMPLETADA: 2
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

const formatDateShort = (value: string | null) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
};

const formatRemaining = (task: Task): { label: string; tone: string } => {
  if (!task.dueDate) {
    return {
      label: "Sin fecha límite",
      tone: "text-slate-600 border-slate-200 bg-slate-50"
    };
  }

  const now = Date.now();
  const due = new Date(task.dueDate).getTime();
  const diff = due - now;
  const absMinutes = Math.floor(Math.abs(diff) / (60 * 1000));
  const days = Math.floor(absMinutes / (60 * 24));
  const hours = Math.floor((absMinutes % (60 * 24)) / 60);

  if (diff < 0) {
    return {
      label: `Venció hace ${days}d ${hours}h`,
      tone: "text-red-700 border-red-200 bg-red-50"
    };
  }

  if (days <= 1) {
    return {
      label: `Por vencer: ${days}d ${hours}h`,
      tone: "text-amber-700 border-amber-200 bg-amber-50"
    };
  }

  return {
    label: `Faltan ${days}d ${hours}h`,
    tone: "text-emerald-700 border-emerald-200 bg-emerald-50"
  };
};

const statusTone = (task: Task) => {
  if (task.status === "COMPLETADA") {
    return "text-emerald-700 border-emerald-200 bg-emerald-50";
  }
  if (task.status === "EN_REVISION") {
    return "text-blue-700 border-blue-200 bg-blue-50";
  }
  return "text-amber-700 border-amber-200 bg-amber-50";
};

const isVisibleInMyTasks = (task: Task) => {
  if (task.status === "COMPLETADA") {
    return false;
  }
  if (task.status === "EN_REVISION") {
    return true;
  }
  return task.pendingActivatedAt !== null;
};

const normalizeTaskRange = (task: Task): GanttDraftRange => {
  const createdAt = new Date(task.createdAt).getTime();
  const startMs = task.startDate
    ? new Date(task.startDate).getTime()
    : task.dueDate
      ? new Date(task.dueDate).getTime() - DAY_MS
      : createdAt;
  const dueMs = task.dueDate ? new Date(task.dueDate).getTime() : startMs + DAY_MS;
  const endMs = Math.max(dueMs, startMs + DAY_MS);
  return {
    startMs,
    endMs
  };
};

const formatTimelineDate = (ms: number) =>
  new Date(ms).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit"
  });

const hexToRgba = (hex: string, alpha: number) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    return `rgba(79, 124, 255, ${alpha})`;
  }

  const value = match[1] ?? "4F7CFF";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
  const [ganttDrafts, setGanttDrafts] = useState<Record<string, GanttDraftRange>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStageModalOpen, setCreateStageModalOpen] = useState(false);
  const [selectedHistoryTaskId, setSelectedHistoryTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const dragStateRef = useRef<
    | {
        taskId: string;
        mode: "move" | "resize-start" | "resize-end";
        originX: number;
        originStartMs: number;
        originEndMs: number;
        timelineStartMs: number;
        timelineEndMs: number;
        rowWidth: number;
      }
    | null
  >(null);

  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      stageId: "",
      assigneeId: "",
      startDate: "",
      dueDate: ""
    }
  });

  const stageForm = useForm<CreateStageForm>({
    resolver: zodResolver(createStageFormSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_STAGE_COLOR
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
    queryKey: selectedProjectId
      ? [...taskBoardQueryKey(selectedProjectId), dateFromFilter || null, dateToFilter || null]
      : ["tasks", "project", "none"],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("projectId", selectedProjectId);
      if (dateFromFilter) {
        params.set("dateFrom", new Date(dateFromFilter).toISOString());
      }
      if (dateToFilter) {
        params.set("dateTo", new Date(dateToFilter).toISOString());
      }
      return apiRequest<Task[]>(`/tasks?${params.toString()}`);
    },
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

  const stagesQuery = useQuery({
    queryKey: ["project-stages", selectedProjectId],
    queryFn: () => apiRequest<ProjectStage[]>(`/projects/${selectedProjectId}/stages`),
    enabled: Boolean(selectedProjectId)
  });

  const taskHistoryQuery = useQuery({
    queryKey: ["task-detail", selectedHistoryTaskId],
    queryFn: () => apiRequest<TaskDetail>(`/tasks/${selectedHistoryTaskId}`),
    enabled: Boolean(selectedHistoryTaskId)
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: {
      projectId: string;
      title: string;
      description?: string;
      stageId?: string;
      assigneeId?: string;
      startDate?: string;
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
        stageId: "",
        assigneeId: "",
        startDate: "",
        dueDate: ""
      });
      setCreateModalOpen(false);
      setTaskFeedback("Tarea creada correctamente.");

      queryClient.setQueryData<Task[]>(taskBoardQueryKey(createdTask.projectId), (current) =>
        mergeTaskIntoList(current, createdTask)
      );
      queryClient.setQueryData<Task[]>(allTasksQueryKey, (current) => mergeTaskIntoList(current, createdTask));

      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(createdTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
    }
  });

  const createStageMutation = useMutation({
    mutationFn: (payload: {
      projectId: string;
      name: string;
      color: string;
    }) =>
      apiRequest<ProjectStage>(`/projects/${payload.projectId}/stages`, {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          color: payload.color
        })
      }),
    onSuccess: async (stage) => {
      stageForm.reset({
        name: "",
        color: stage.color ?? DEFAULT_STAGE_COLOR
      });
      setCreateStageModalOpen(false);
      setTaskFeedback(`Etapa "${stage.name}" creada correctamente.`);
      await queryClient.invalidateQueries({ queryKey: ["project-stages", stage.projectId] });
    }
  });

  const updateScheduleMutation = useMutation({
    mutationFn: (payload: {
      taskId: string;
      startDate: string | null;
      dueDate: string | null;
      reason: string;
    }) =>
      apiRequest<Task>(`/tasks/${payload.taskId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({
          startDate: payload.startDate,
          dueDate: payload.dueDate,
          reason: payload.reason
        })
      }),
    onSuccess: async (updatedTask) => {
      setTaskFeedback(`Cronograma actualizado para "${updatedTask.title}".`);
      setGanttDrafts((current) => {
        const next = { ...current };
        delete next[updatedTask.id];
        return next;
      });
      queryClient.setQueryData<Task[]>(taskBoardQueryKey(updatedTask.projectId), (current) =>
        mergeTaskIntoList(current, updatedTask)
      );
      queryClient.setQueryData<Task[]>(allTasksQueryKey, (current) => mergeTaskIntoList(current, updatedTask));
      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
      if (selectedHistoryTaskId === updatedTask.id) {
        await queryClient.invalidateQueries({ queryKey: ["task-detail", updatedTask.id] });
      }
    }
  });

  const changeStatusMutation = useMutation({
    mutationFn: (payload: { taskId: string; status: TaskStatus; reason: string }) =>
      apiRequest<Task>("/tasks/status", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (updatedTask, variables) => {
      queryClient.setQueryData<Task[]>(taskBoardQueryKey(updatedTask.projectId), (current) =>
        mergeTaskIntoList(current, updatedTask)
      );
      queryClient.setQueryData<Task[]>(allTasksQueryKey, (current) => mergeTaskIntoList(current, updatedTask));
      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
      if (selectedHistoryTaskId === updatedTask.id) {
        await queryClient.invalidateQueries({ queryKey: ["task-detail", updatedTask.id] });
      }

      if (variables.status === "EN_REVISION") {
        setTaskFeedback(`"${updatedTask.title}" se envió a revisión.`);
      } else if (variables.status === "COMPLETADA") {
        setTaskFeedback(`"${updatedTask.title}" fue aprobada como completada.`);
      } else {
        setTaskFeedback(`"${updatedTask.title}" volvió a pendiente.`);
      }
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
      await queryClient.invalidateQueries({ queryKey: taskBoardQueryKey(updatedTask.projectId) });
      await queryClient.invalidateQueries({ queryKey: allTasksQueryKey });
      if (selectedHistoryTaskId === updatedTask.id) {
        await queryClient.invalidateQueries({ queryKey: ["task-detail", updatedTask.id] });
      }
      setTaskFeedback(`"${updatedTask.title}" quedó activa en pendiente.`);
    }
  });

  const activeRole = session.data?.activeRole ?? null;
  const canEditGantt = activeRole ? ganttEditorRoles.has(activeRole) : false;
  const canManageStages = canEditGantt;
  const canManageTaskFlow = activeRole ? taskFlowManagerRoles.has(activeRole) : false;

  const projectTasks = tasksQuery.data ?? [];
  const allTasks = allTasksQuery.data ?? [];
  const myTasks = filterMyTasks(allTasks, session.data?.id ?? null)
    .filter(isVisibleInMyTasks)
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) {
        return aDue - bDue;
      }
      return (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
    });
  const managementTasks = useMemo(() => {
    return [...projectTasks].sort((a, b) => {
      const statusSort = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (statusSort !== 0) {
        return statusSort;
      }
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) {
        return aDue - bDue;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [projectTasks]);

  const projectMap = new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name]));

  const members = membersQuery.data ?? [];
  const membersById = new Map(members.map((member) => [member.userId, member]));
  const stages = stagesQuery.data ?? [];
  const stagesById = new Map(stages.map((stage) => [stage.id, stage]));

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

  const ganttTasks = useMemo(() => {
    return [...projectTasks].sort((a, b) => {
      const aRange = normalizeTaskRange(a);
      const bRange = normalizeTaskRange(b);
      if (aRange.startMs !== bRange.startMs) {
        return aRange.startMs - bRange.startMs;
      }
      if (aRange.endMs !== bRange.endMs) {
        return aRange.endMs - bRange.endMs;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [projectTasks]);

  const ganttGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        stageName: string;
        stageColor: string;
        tasks: Task[];
      }
    >();

    for (const task of ganttTasks) {
      const stage = task.stageId ? stagesById.get(task.stageId) : null;
      const groupId = task.stageId ?? `none:${task.projectId}`;
      const bucket = grouped.get(groupId) ?? {
        stageName: stage?.name ?? task.stageName ?? "Sin etapa",
        stageColor: stage?.color ?? task.stageColor ?? NO_STAGE_COLOR,
        tasks: []
      };
      bucket.tasks.push(task);
      grouped.set(groupId, bucket);
    }

    return Array.from(grouped.values());
  }, [ganttTasks, stagesById]);

  const timelineBounds = useMemo(() => {
    if (ganttTasks.length === 0) {
      const now = Date.now();
      return {
        startMs: now - DAY_MS * 2,
        endMs: now + DAY_MS * 14
      };
    }

    const ranges = ganttTasks.map((task) => ganttDrafts[task.id] ?? normalizeTaskRange(task));
    const minStart = Math.min(...ranges.map((range) => range.startMs));
    const maxEnd = Math.max(...ranges.map((range) => range.endMs));
    const paddedStart = minStart - DAY_MS;
    const paddedEnd = Math.max(maxEnd + DAY_MS, paddedStart + DAY_MS * 7);

    return {
      startMs: paddedStart,
      endMs: paddedEnd
    };
  }, [ganttDrafts, ganttTasks]);

  const timelineDays = Math.max(1, Math.ceil((timelineBounds.endMs - timelineBounds.startMs) / DAY_MS));
  const timelineWidthPx = Math.max(960, timelineDays * 44);

  const stopDrag = useCallback(
    (commit: boolean) => {
      const drag = dragStateRef.current;
      dragStateRef.current = null;
      if (!drag || !commit) {
        return;
      }

      const nextRange = ganttDrafts[drag.taskId];
      if (!nextRange) {
        return;
      }

      if (nextRange.startMs === drag.originStartMs && nextRange.endMs === drag.originEndMs) {
        setGanttDrafts((current) => {
          const copy = { ...current };
          delete copy[drag.taskId];
          return copy;
        });
        return;
      }

      updateScheduleMutation.mutate({
        taskId: drag.taskId,
        startDate: new Date(nextRange.startMs).toISOString(),
        dueDate: new Date(nextRange.endMs).toISOString(),
        reason: "Ajuste desde vista Gantt"
      });
    },
    [ganttDrafts, updateScheduleMutation]
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) {
        return;
      }

      const totalMs = drag.timelineEndMs - drag.timelineStartMs;
      const deltaPx = event.clientX - drag.originX;
      const deltaMs = (deltaPx / Math.max(1, drag.rowWidth)) * totalMs;
      const snappedDeltaMs = Math.round(deltaMs / DAY_MS) * DAY_MS;

      let nextStartMs = drag.originStartMs;
      let nextEndMs = drag.originEndMs;

      if (drag.mode === "move") {
        nextStartMs = drag.originStartMs + snappedDeltaMs;
        nextEndMs = drag.originEndMs + snappedDeltaMs;
      } else if (drag.mode === "resize-start") {
        nextStartMs = Math.min(drag.originStartMs + snappedDeltaMs, drag.originEndMs - DAY_MS);
      } else {
        nextEndMs = Math.max(drag.originEndMs + snappedDeltaMs, drag.originStartMs + DAY_MS);
      }

      setGanttDrafts((current) => ({
        ...current,
        [drag.taskId]: {
          startMs: nextStartMs,
          endMs: nextEndMs
        }
      }));
    };

    const onUp = () => {
      stopDrag(true);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [stopDrag]);

  const startDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      mode: "move" | "resize-start" | "resize-end",
      task: Task,
      row: HTMLElement
    ) => {
      if (!canEditGantt) {
        return;
      }

      const rect = row.getBoundingClientRect();
      const currentRange = ganttDrafts[task.id] ?? normalizeTaskRange(task);
      dragStateRef.current = {
        taskId: task.id,
        mode,
        originX: event.clientX,
        originStartMs: currentRange.startMs,
        originEndMs: currentRange.endMs,
        timelineStartMs: timelineBounds.startMs,
        timelineEndMs: timelineBounds.endMs,
        rowWidth: rect.width
      };

      setGanttDrafts((current) => ({
        ...current,
        [task.id]: currentRange
      }));
    },
    [canEditGantt, ganttDrafts, timelineBounds.endMs, timelineBounds.startMs]
  );

  const hoveredTask = hoveredTaskId ? projectTasks.find((task) => task.id === hoveredTaskId) ?? null : null;
  const historyTask = taskHistoryQuery.data ?? null;
  const stageColorValue = stageForm.watch("color") || DEFAULT_STAGE_COLOR;

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!lockProjectSelection ? (
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="h-10 min-w-[220px] rounded-xl border border-slate-300 px-3 text-sm"
                aria-label="Proyecto"
              >
                <option value="">Selecciona proyecto</option>
                {projectsQuery.data?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {selectedProject?.name ?? "Proyecto"}
              </span>
            )}

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-700"
                }`}
                onClick={() => setViewMode("cards")}
              >
                Tarjetas
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  viewMode === "gantt" ? "bg-slate-900 text-white" : "text-slate-700"
                }`}
                onClick={() => setViewMode("gantt")}
              >
                Gantt
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManageStages ? (
              <Button
                type="button"
                className="h-10 px-4 text-sm"
                disabled={!selectedProjectId}
                onClick={() => {
                  stageForm.reset({
                    name: "",
                    color: DEFAULT_STAGE_COLOR
                  });
                  setCreateStageModalOpen(true);
                }}
              >
                Nueva etapa
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-10 px-4 text-sm"
              disabled={!selectedProjectId}
              onClick={() => setCreateModalOpen(true)}
            >
              Nueva tarea
            </Button>
            {viewMode === "gantt" && !canEditGantt ? (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                Solo lectura
              </span>
            ) : null}
          </div>
        </div>

        {!lockProjectSelection && projectsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Cargando proyectos...</p>
        ) : null}
        {!lockProjectSelection && projectsQuery.error ? (
          <p className="text-sm text-red-600">{projectsQuery.error.message}</p>
        ) : null}

        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            type="datetime-local"
            value={dateFromFilter}
            onChange={(event) => setDateFromFilter(event.target.value)}
            aria-label="Filtrar desde"
          />
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            type="datetime-local"
            value={dateToFilter}
            onChange={(event) => setDateToFilter(event.target.value)}
            aria-label="Filtrar hasta"
          />
          <Button
            type="button"
            className="h-10 px-4 text-sm"
            onClick={() => {
              setDateFromFilter("");
              setDateToFilter("");
            }}
          >
            Limpiar
          </Button>
        </div>

        {taskFeedback ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{taskFeedback}</p>
        ) : null}

        {tasksQuery.isLoading ? <p className="text-sm text-slate-500">Cargando tareas...</p> : null}
        {tasksQuery.error ? <p className="text-sm text-red-600">{tasksQuery.error.message}</p> : null}

        {!selectedProjectId ? (
          <p className="text-sm text-slate-600">Selecciona un proyecto para ver su tablero.</p>
        ) : viewMode === "cards" ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {projectTasksByStatus.map((column) => (
              <div key={column.status} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {column.label} ({column.tasks.length})
                </h3>
                <ul className="space-y-2">
                  {column.tasks.map((task) => {
                    const stage = task.stageId ? stagesById.get(task.stageId) : null;
                    const stageName = stage?.name ?? task.stageName ?? "Sin etapa";
                    const stageColor = stage?.color ?? task.stageColor ?? NO_STAGE_COLOR;
                    return (
                      <li key={task.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900">{task.title}</p>
                            <p
                              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-slate-700"
                              style={{
                                borderColor: hexToRgba(stageColor, 0.35),
                                backgroundColor: hexToRgba(stageColor, 0.12)
                              }}
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                              Etapa: {stageName}
                            </p>
                            <p className="text-xs text-slate-500">Desde: {formatDateTime(task.startDate)}</p>
                            <p className="text-xs text-slate-500">Hasta: {formatDateTime(task.dueDate)}</p>
                          </div>
                          <Link href={`/tasks/${task.id}` as Route} className="text-xs font-medium text-blue-700 hover:underline">
                            Detalle
                          </Link>
                        </div>

                        <p className={`inline-flex rounded-lg border px-2 py-1 text-[11px] ${statusTone(task)}`}>
                          {task.status}
                        </p>

                        {task.assigneeId ? (
                          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                            Responsable: {membersById.get(task.assigneeId)?.fullName ?? task.assigneeName ?? "Asignado"}
                          </p>
                        ) : (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                            Sin asignar
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
              <span className="font-semibold text-slate-900">Estados:</span>
              {statusColumns.map((column) => (
                <span key={`legend-${column.status}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: GANTT_STATUS_COLORS[column.status] }}
                  />
                  {column.label}
                </span>
              ))}
            </div>

            {hoveredTask ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                {(() => {
                  const stage = hoveredTask.stageId ? stagesById.get(hoveredTask.stageId) : null;
                  const stageName = stage?.name ?? hoveredTask.stageName ?? "Sin etapa";
                  const stageColor = stage?.color ?? hoveredTask.stageColor ?? NO_STAGE_COLOR;
                  return (
                    <p
                      className="mb-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-slate-700"
                      style={{
                        borderColor: hexToRgba(stageColor, 0.35),
                        backgroundColor: hexToRgba(stageColor, 0.12)
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                      Etapa: {stageName}
                    </p>
                  );
                })()}
                <p className="font-semibold text-slate-900">{hoveredTask.title}</p>
                <p>Creó: {hoveredTask.createdByName ?? hoveredTask.createdById}</p>
                <p>Asignado: {hoveredTask.assigneeName ?? "Sin asignar"}</p>
                <p>
                  Desde: {formatDateTime(hoveredTask.startDate)} · Hasta: {formatDateTime(hoveredTask.dueDate)}
                </p>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <div className="min-w-[1200px]">
                <div className="grid" style={{ gridTemplateColumns: `460px ${timelineWidthPx}px` }}>
                  <div className="sticky left-0 z-10 grid grid-cols-[110px_1fr_110px_80px_80px_90px] border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <div className="px-2 py-2">Etapa</div>
                    <div className="px-2 py-2">Tarea</div>
                    <div className="px-2 py-2">Responsable</div>
                    <div className="px-2 py-2">Inicio</div>
                    <div className="px-2 py-2">Fin</div>
                    <div className="px-2 py-2">Estado</div>
                  </div>

                  <div className="grid border-b border-slate-200 bg-white text-[11px] text-slate-500" style={{ gridTemplateColumns: `repeat(${timelineDays}, minmax(0, 1fr))` }}>
                    {Array.from({ length: timelineDays }).map((_, index) => (
                      <div key={index} className="border-l border-slate-200 px-1 py-2 text-center">
                        {formatTimelineDate(timelineBounds.startMs + DAY_MS * index)}
                      </div>
                    ))}
                  </div>

                  {ganttGroups.map((group) => (
                    <div key={`${group.stageName}-${group.stageColor}`} className="contents">
                      <div
                        className="sticky left-0 z-[9] border-b border-slate-200 bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-700"
                        style={{
                          boxShadow: `inset 4px 0 0 ${group.stageColor}`
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.stageColor }} />
                          {group.stageName}
                        </span>
                      </div>
                      <div className="border-b border-slate-200 bg-slate-100" />

                      {group.tasks.map((task) => {
                        const range = ganttDrafts[task.id] ?? normalizeTaskRange(task);
                        const leftPct =
                          ((range.startMs - timelineBounds.startMs) /
                            (timelineBounds.endMs - timelineBounds.startMs)) *
                          100;
                        const widthPct =
                          ((range.endMs - range.startMs) / (timelineBounds.endMs - timelineBounds.startMs)) *
                          100;
                        const statusColor = GANTT_STATUS_COLORS[task.status] ?? "#64748B";

                        const hoverLabel = [
                          `Tarea: ${task.title}`,
                          `Etapa: ${group.stageName}`,
                          `Creó: ${task.createdByName ?? task.createdById}`,
                          `Asignado: ${task.assigneeName ?? "Sin asignar"}`,
                          `Estado: ${task.status}`,
                          `Desde: ${formatDateTime(task.startDate)}`,
                          `Hasta: ${formatDateTime(task.dueDate)}`
                        ].join("\n");

                        return (
                          <div key={task.id} className="contents">
                            <div className="sticky left-0 z-[8] grid grid-cols-[110px_1fr_110px_80px_80px_90px] items-center border-b border-slate-200 bg-white text-xs text-slate-700">
                              <div className="truncate px-2 py-2">
                                <span
                                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
                                  style={{
                                    borderColor: hexToRgba(group.stageColor, 0.35),
                                    backgroundColor: hexToRgba(group.stageColor, 0.12)
                                  }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: group.stageColor }} />
                                  {group.stageName}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="truncate px-2 py-2 text-left font-medium text-slate-900 hover:text-blue-700"
                                onClick={() => setSelectedHistoryTaskId(task.id)}
                              >
                                {task.title}
                              </button>
                              <div className="truncate px-2 py-2">{task.assigneeName ?? "Sin asignar"}</div>
                              <div className="px-2 py-2">{formatDateShort(task.startDate)}</div>
                              <div className="px-2 py-2">{formatDateShort(task.dueDate)}</div>
                              <div className="px-2 py-2">{task.status}</div>
                            </div>

                            <div
                              className="relative h-11 border-b border-slate-200 bg-white"
                              onMouseEnter={() => setHoveredTaskId(task.id)}
                              onMouseLeave={() => setHoveredTaskId((current) => (current === task.id ? null : current))}
                            >
                              <div
                                className="pointer-events-none absolute inset-0 grid"
                                style={{ gridTemplateColumns: `repeat(${timelineDays}, minmax(0, 1fr))` }}
                              >
                                {Array.from({ length: timelineDays }).map((_, index) => (
                                  <div key={index} className="border-l border-slate-100" />
                                ))}
                              </div>

                              <div
                                title={hoverLabel}
                                className={`absolute top-1.5 h-8 rounded-md border px-2 text-xs leading-8 text-slate-900 ${
                                  canEditGantt ? "cursor-grab" : ""
                                }`}
                                style={{
                                  left: `${Math.max(0, leftPct)}%`,
                                  width: `${Math.max(2, widthPct)}%`,
                                  borderColor: hexToRgba(statusColor, 0.55),
                                  backgroundColor: hexToRgba(statusColor, canEditGantt ? 0.2 : 0.12),
                                  boxShadow: `inset 3px 0 0 ${group.stageColor}`
                                }}
                                onClick={() => setSelectedHistoryTaskId(task.id)}
                                onPointerDown={(event) => {
                                  const row = event.currentTarget.parentElement;
                                  if (!row) {
                                    return;
                                  }
                                  startDrag(event, "move", task, row);
                                }}
                              >
                                <span className="truncate">{task.title}</span>
                                {canEditGantt ? (
                                  <>
                                    <div
                                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-md"
                                      style={{ backgroundColor: hexToRgba(statusColor, 0.65) }}
                                      onPointerDown={(event) => {
                                        event.stopPropagation();
                                        const row = event.currentTarget.parentElement?.parentElement;
                                        if (!row) {
                                          return;
                                        }
                                        startDrag(
                                          event as unknown as ReactPointerEvent<HTMLDivElement>,
                                          "resize-start",
                                          task,
                                          row
                                        );
                                      }}
                                    />
                                    <div
                                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md"
                                      style={{ backgroundColor: hexToRgba(statusColor, 0.65) }}
                                      onPointerDown={(event) => {
                                        event.stopPropagation();
                                        const row = event.currentTarget.parentElement?.parentElement;
                                        if (!row) {
                                          return;
                                        }
                                        startDrag(
                                          event as unknown as ReactPointerEvent<HTMLDivElement>,
                                          "resize-end",
                                          task,
                                          row
                                        );
                                      }}
                                    />
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {showPersonalPanels ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Mis tareas pendientes</h2>

          {allTasksQuery.isLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
          {allTasksQuery.error ? <p className="text-sm text-red-600">{allTasksQuery.error.message}</p> : null}

          {myTasks.length === 0 ? (
            <p className="text-sm text-slate-600">No tienes tareas pendientes asignadas.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {myTasks.map((task) => {
                const remaining = formatRemaining(task);
                const stage = task.stageId ? stagesById.get(task.stageId) : null;
                const stageName = stage?.name ?? task.stageName ?? "Sin etapa";
                const stageColor = stage?.color ?? task.stageColor ?? NO_STAGE_COLOR;
                return (
                  <li key={task.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-600">{projectMap.get(task.projectId) ?? "Proyecto"}</p>
                      <p
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-slate-700"
                        style={{
                          borderColor: hexToRgba(stageColor, 0.35),
                          backgroundColor: hexToRgba(stageColor, 0.12)
                        }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                        Etapa: {stageName}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span className={`rounded-lg border px-2 py-1 ${statusTone(task)}`}>{task.status}</span>
                      <span className={`rounded-lg border px-2 py-1 ${remaining.tone}`}>{remaining.label}</span>
                    </div>

                    <div className="text-xs text-slate-500">
                      <p>Desde: {formatDateTime(task.startDate)}</p>
                      <p>Hasta: {formatDateTime(task.dueDate)}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/tasks/${task.id}` as Route} className="text-xs text-blue-700 hover:underline">
                        Ver detalle
                      </Link>
                      {task.status === "PENDIENTE" ? (
                        <Button
                          type="button"
                          className="h-8 rounded-lg px-3 text-xs"
                          onClick={() =>
                            changeStatusMutation.mutate({
                              taskId: task.id,
                              status: "EN_REVISION",
                              reason: "Enviada a revisión desde Mis tareas"
                            })
                          }
                          disabled={changeStatusMutation.isPending}
                        >
                          {changeStatusMutation.isPending ? "Enviando..." : "Enviar a revisión"}
                        </Button>
                      ) : canManageTaskFlow ? (
                        <Button
                          type="button"
                          className="h-8 rounded-lg px-3 text-xs"
                          onClick={() =>
                            changeStatusMutation.mutate({
                              taskId: task.id,
                              status: "COMPLETADA",
                              reason: "Aprobada por responsable de gestión"
                            })
                          }
                          disabled={changeStatusMutation.isPending}
                        >
                          {changeStatusMutation.isPending ? "Aprobando..." : "Aprobar"}
                        </Button>
                      ) : (
                        <span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                          Pendiente de aprobación
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {canManageTaskFlow ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Gestión unificada</h2>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              Acciones de aprobación y reapertura
            </span>
          </div>

          {!selectedProjectId ? (
            <p className="text-sm text-slate-600">Selecciona un proyecto para gestionar actividades.</p>
          ) : managementTasks.length === 0 ? (
            <p className="text-sm text-slate-600">No hay actividades para gestionar en este proyecto.</p>
          ) : (
            <ul className="space-y-2">
              {managementTasks.map((task) => {
                const isActivablePending = task.status === "PENDIENTE" && task.pendingActivatedAt === null;
                return (
                  <li key={`manage-${task.id}`} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-600">
                          Estado: {task.status} · Desde: {formatDateTime(task.startDate)} · Hasta:{" "}
                          {formatDateTime(task.dueDate)}
                        </p>
                        {isActivablePending ? (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                            Pendiente no activa (oculta para el asignado hasta activación)
                          </p>
                        ) : null}
                      </div>
                      <Link href={`/tasks/${task.id}` as Route} className="text-xs font-medium text-blue-700 hover:underline">
                        Detalle
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {task.status === "EN_REVISION" ? (
                        <>
                          <Button
                            type="button"
                            className="h-8 rounded-lg px-3 text-xs"
                            disabled={changeStatusMutation.isPending}
                            onClick={() =>
                              changeStatusMutation.mutate({
                                taskId: task.id,
                                status: "COMPLETADA",
                                reason: "Aprobada desde gestión unificada"
                              })
                            }
                          >
                            Aprobar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-8 rounded-lg px-3 text-xs"
                            disabled={changeStatusMutation.isPending}
                            onClick={() =>
                              changeStatusMutation.mutate({
                                taskId: task.id,
                                status: "PENDIENTE",
                                reason: "Devuelta a pendiente desde gestión"
                              })
                            }
                          >
                            Devolver a pendiente
                          </Button>
                        </>
                      ) : null}

                      {task.status === "COMPLETADA" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 rounded-lg px-3 text-xs"
                          disabled={changeStatusMutation.isPending}
                          onClick={() =>
                            changeStatusMutation.mutate({
                              taskId: task.id,
                              status: "PENDIENTE",
                              reason: "Reabierta por gestión"
                            })
                          }
                        >
                          Reabrir pendiente
                        </Button>
                      ) : null}

                      {isActivablePending ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 rounded-lg px-3 text-xs"
                          disabled={activateTaskMutation.isPending}
                          onClick={() =>
                            activateTaskMutation.mutate({
                              taskId: task.id,
                              reason: "Activación manual por gestión"
                            })
                          }
                        >
                          Activar ahora
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <article className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Nueva tarea</h3>
              <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setCreateModalOpen(false)}>
                Cerrar
              </Button>
            </div>

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
                  stageId?: string;
                  assigneeId?: string;
                  startDate?: string;
                  dueDate?: string;
                } = {
                  projectId: selectedProjectId,
                  title: values.title.trim(),
                  status: "PENDIENTE"
                };

                if (values.description?.trim()) {
                  payload.description = values.description.trim();
                }

                if (values.stageId) {
                  payload.stageId = values.stageId;
                }

                if (values.assigneeId) {
                  payload.assigneeId = values.assigneeId;
                }

                if (values.startDate) {
                  payload.startDate = new Date(values.startDate).toISOString();
                }

                if (values.dueDate) {
                  payload.dueDate = new Date(values.dueDate).toISOString();
                }

                createTaskMutation.mutate(payload);
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

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600" htmlFor="create-task-stage">
                    Etapa (opcional)
                  </label>
                  <select
                    id="create-task-stage"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                    {...form.register("stageId")}
                  >
                    <option value="">Sin etapa</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
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
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600" htmlFor="create-task-start-date">
                    Fecha desde
                  </label>
                  <input
                    id="create-task-start-date"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                    type="datetime-local"
                    {...form.register("startDate")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-600" htmlFor="create-task-due-date">
                    Fecha hasta
                  </label>
                  <input
                    id="create-task-due-date"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                    type="datetime-local"
                    {...form.register("dueDate")}
                  />
                </div>
              </div>

              {form.formState.errors.startDate?.message ? (
                <p className="text-sm text-red-600">{form.formState.errors.startDate.message}</p>
              ) : null}
              {form.formState.errors.dueDate?.message ? (
                <p className="text-sm text-red-600">{form.formState.errors.dueDate.message}</p>
              ) : null}

              {createTaskMutation.error ? <p className="text-sm text-red-600">{createTaskMutation.error.message}</p> : null}

              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="h-9 px-3 text-xs" type="submit" disabled={createTaskMutation.isPending || !selectedProjectId}>
                  {createTaskMutation.isPending ? "Guardando..." : "Guardar tarea"}
                </Button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {createStageModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <article className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Nueva etapa</h3>
              <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setCreateStageModalOpen(false)}>
                Cerrar
              </Button>
            </div>

            <form
              className="space-y-3"
              onSubmit={stageForm.handleSubmit((values) => {
                if (!selectedProjectId) {
                  return;
                }

                createStageMutation.mutate({
                  projectId: selectedProjectId,
                  name: values.name.trim(),
                  color: values.color.toUpperCase()
                });
              })}
            >
              <div className="space-y-1">
                <label className="text-xs text-slate-600" htmlFor="create-stage-name">
                  Nombre
                </label>
                <input
                  id="create-stage-name"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  placeholder="Análisis funcional"
                  {...stageForm.register("name")}
                />
                {stageForm.formState.errors.name?.message ? (
                  <p className="text-sm text-red-600">{stageForm.formState.errors.name.message}</p>
                ) : null}
              </div>

              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Número de etapa: se asigna automáticamente en orden incremental.
              </p>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600" htmlFor="create-stage-color">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="create-stage-color"
                      className="h-10 w-12 rounded-xl border border-slate-300 p-1"
                      type="color"
                      value={stageColorValue}
                      onChange={(event) =>
                        stageForm.setValue("color", event.target.value.toUpperCase(), {
                          shouldDirty: true,
                          shouldValidate: true
                        })
                      }
                    />
                    <input
                      className="h-10 w-28 rounded-xl border border-slate-300 px-3 text-sm uppercase"
                      placeholder="#4F7CFF"
                      {...stageForm.register("color", {
                        setValueAs: (value) => String(value || "").toUpperCase()
                      })}
                    />
                  </div>
                  {stageForm.formState.errors.color?.message ? (
                    <p className="text-sm text-red-600">{stageForm.formState.errors.color.message}</p>
                  ) : null}
                </div>
              </div>

              {createStageMutation.error ? <p className="text-sm text-red-600">{createStageMutation.error.message}</p> : null}

              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setCreateStageModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="h-9 px-3 text-xs" type="submit" disabled={createStageMutation.isPending || !selectedProjectId}>
                  {createStageMutation.isPending ? "Guardando..." : "Guardar etapa"}
                </Button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {selectedHistoryTaskId ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Historial de tarea</h3>
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setSelectedHistoryTaskId(null)}>
              Cerrar
            </Button>
          </div>

          {taskHistoryQuery.isLoading ? <p className="text-sm text-slate-500">Cargando historial...</p> : null}
          {taskHistoryQuery.error ? <p className="text-sm text-red-600">{taskHistoryQuery.error.message}</p> : null}

          {historyTask ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-base font-semibold text-slate-900">{historyTask.title}</p>
                <p className="text-xs text-slate-600">Etapa: {historyTask.stage?.name ?? "Sin etapa"}</p>
                <p className="text-xs text-slate-600">
                  Creó: {historyTask.createdBy ? `${historyTask.createdBy.firstName} ${historyTask.createdBy.lastName}` : historyTask.createdById}
                </p>
                <p className="text-xs text-slate-600">
                  Asignado: {historyTask.assignee ? `${historyTask.assignee.firstName} ${historyTask.assignee.lastName}` : "Sin asignar"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cambios de estado</p>
                {historyTask.statusHistory?.length ? (
                  <ul className="space-y-2">
                    {historyTask.statusHistory.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-xs">
                        <p>
                          {formatDateTime(entry.changedAt)} · {entry.fromStatus} → {entry.toStatus}
                        </p>
                        <p>Motivo: {entry.reason}</p>
                        <p>
                          Por: {entry.changedBy ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}` : "Usuario"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Sin cambios de estado registrados.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Reasignaciones</p>
                {historyTask.reassignments?.length ? (
                  <ul className="space-y-2">
                    {historyTask.reassignments.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-xs">
                        <p>{formatDateTime(entry.reassignedAt)}</p>
                        <p>Motivo: {entry.reason}</p>
                        <p>
                          Por: {entry.reassignedBy ? `${entry.reassignedBy.firstName} ${entry.reassignedBy.lastName}` : "Usuario"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Sin reasignaciones registradas.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cambios de cronograma</p>
                {historyTask.scheduleHistory?.length ? (
                  <ul className="space-y-2">
                    {historyTask.scheduleHistory.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-xs">
                        <p>{formatDateTime(entry.changedAt)}</p>
                        <p>
                          Desde: {formatDateTime(entry.previousStartDate)} / {formatDateTime(entry.previousDueDate)}
                        </p>
                        <p>
                          Hasta: {formatDateTime(entry.newStartDate)} / {formatDateTime(entry.newDueDate)}
                        </p>
                        <p>Motivo: {entry.reason}</p>
                        <p>
                          Por: {entry.changedBy ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}` : "Usuario"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Sin ajustes de fechas registrados.</p>
                )}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
};
