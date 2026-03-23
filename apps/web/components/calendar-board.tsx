"use client";

import { DM_Sans, Sora } from "next/font/google";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectStage, Task, TaskStatus, TaskStatusColors } from "@corelia/types";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams } from "@/lib/context";
import {
  getTaskStatusBadgeStyle,
  getTaskStatusColor,
  hexToRgba,
  useFrontendSettings
} from "@/lib/frontend-settings";
import { useSession } from "@/lib/session";

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

type CalendarApiEvent = {
  id: string;
  type: "TAREA" | "REUNION" | "VACACIONES" | "HITO" | "EXTERNO";
  title: string;
  startsAt: string;
  endsAt: string;
  projectId: string | null;
  teamId: string | null;
  userId: string | null;
  readOnly: boolean;
  metadata: Record<string, unknown>;
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

type CalendarView = "hoy" | "semana" | "mes";

type ModalTab = "evento" | "tarea";

type CalendarEventCreatePayload = {
  title: string;
  eventType: "REUNION" | "CALL" | "RECORDATORIO" | "OTRO";
  startsAt: string;
  endsAt: string;
  participantIds: string[];
  description?: string;
};

type CalendarTaskCreatePayload = {
  nombre: string;
  etapa: string;
  responsable: string;
  fechaInicio: string;
  fechaFin: string;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  descripcion: string;
  mostrarEnGantt: boolean;
  mostrarEnCalendario: boolean;
};

type CalendarBoardViewProps = {
  events: CalendarApiEvent[];
  tasks: Task[];
  stages: ProjectStage[];
  members: ProjectMemberAvailability[];
  currentUser: {
    id: string;
    fullName: string;
  } | null;
  currentWeek: Date[];
  currentMonth: Date;
  daysWithEvents: Date[];
  onCreateEvent: (eventData: CalendarEventCreatePayload) => Promise<void>;
  onCreateTask: (taskData: CalendarTaskCreatePayload) => Promise<void>;
  onRescheduleTask: (task: Task, newDatetime: string, confirmOutOfSchedule: boolean) => Promise<void>;
  onSelectDay: (date: Date) => void;
  onChangeWeek: (direction: "prev" | "next") => void;
  onChangeMonth: (direction: "prev" | "next") => void;
  onChangeView: (view: CalendarView) => void;
  onEventClick: (event: CalendarApiEvent) => void;
  loading: boolean;
  errorMessage: string | null;
};

type PositionedEvent = {
  event: CalendarApiEvent;
  top: number;
  height: number;
  column: number;
  columns: number;
};

const WEEKDAY_HEADER = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAY_LONG = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GRID_START_HOUR = 1;
const GRID_END_HOUR = 24;
const GRID_HOUR_HEIGHT = 60;
const GRID_MINUTE_HEIGHT = 1;
const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
const GRID_TOTAL_HEIGHT = GRID_TOTAL_MINUTES * GRID_MINUTE_HEIGHT;

const normalizeDate = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const toDateKey = (value: Date) => normalizeDate(value).toISOString().slice(0, 10);

const isSameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b);

const startOfWeek = (date: Date) => {
  const normalized = normalizeDate(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
};

const addDays = (value: Date, days: number) => {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const buildMonthGrid = (currentMonth: Date) => {
  const monthAnchor = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const firstWeekday = monthAnchor.getDay();
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const gridStart = addDays(monthAnchor, -offset);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const toLocalDateTimeInput = (value: Date) => {
  const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
};

const formatHourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const formatTimeRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  })} - ${end.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
};

const formatRelativeEventDate = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const today = normalizeDate(now).getTime();
  const target = normalizeDate(date).getTime();
  const diff = Math.round((target - today) / DAY_IN_MS);

  if (diff === 0) {
    return "Hoy";
  }

  if (diff === 1) {
    return "Mañana";
  }

  if (diff === -1) {
    return "Ayer";
  }

  return `${Math.abs(diff)}d ${diff > 0 ? "restantes" : "atrás"}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const staticChipStyle = (borderColor: string, backgroundColor: string, color: string): CSSProperties => ({
  borderColor,
  backgroundColor,
  color
});

const resolveTaskState = (task: Task | undefined, nowMs: number, taskStatusColors: TaskStatusColors) => {
  if (!task) {
    return {
      label: "Programada",
      chipStyle: staticChipStyle("#c4b5fd", "#ede9fe", "#6d28d9"),
      borderColor: "#8b5cf6"
    };
  }

  if (task.status === "COMPLETADA") {
    const color = getTaskStatusColor("COMPLETADA", taskStatusColors);
    return {
      label: "Completada",
      chipStyle: getTaskStatusBadgeStyle("COMPLETADA", taskStatusColors),
      borderColor: color
    };
  }

  if (task.dueDate) {
    const dueMs = new Date(task.dueDate).getTime();
    if (dueMs < nowMs) {
      return {
        label: "Vencida",
        chipStyle: staticChipStyle("#fecaca", "#fef2f2", "#b91c1c"),
        borderColor: "#ef4444"
      };
    }

    if (dueMs - nowMs <= DAY_IN_MS) {
      return {
        label: "Por vencer",
        chipStyle: staticChipStyle("#fde68a", "#fffbeb", "#92400e"),
        borderColor: "#f59e0b"
      };
    }
  }

  if (task.status === "EN_REVISION") {
    const color = getTaskStatusColor("EN_REVISION", taskStatusColors);
    return {
      label: "En progreso",
      chipStyle: getTaskStatusBadgeStyle("EN_REVISION", taskStatusColors),
      borderColor: color
    };
  }

  const pendingColor = getTaskStatusColor("PENDIENTE", taskStatusColors);
  return {
    label: "Pendiente",
    chipStyle: getTaskStatusBadgeStyle("PENDIENTE", taskStatusColors),
    borderColor: pendingColor
  };
};

const eventTone = (
  event: CalendarApiEvent,
  task: Task | undefined,
  nowMs: number,
  taskStatusColors: TaskStatusColors
) => {
  if (event.type === "REUNION") {
    return {
      bg: "rgba(79, 110, 247, 0.15)",
      border: "#4f6ef7",
      text: "#1d3ca6"
    };
  }

  if (event.type === "EXTERNO" || event.type === "HITO") {
    return {
      bg: "rgba(139, 92, 246, 0.18)",
      border: "#8b5cf6",
      text: "#5b2ab5"
    };
  }

  if (event.type === "VACACIONES") {
    return {
      bg: "rgba(148, 163, 184, 0.18)",
      border: "#64748b",
      text: "#334155"
    };
  }

  const taskState = resolveTaskState(task, nowMs, taskStatusColors);

  if (taskState.label === "Vencida") {
    return {
      bg: "rgba(239, 68, 68, 0.16)",
      border: "#ef4444",
      text: "#991b1b"
    };
  }

  if (taskState.label === "Por vencer") {
    return {
      bg: "rgba(245, 158, 11, 0.16)",
      border: "#f59e0b",
      text: "#92400e"
    };
  }

  if (task?.status) {
    const statusColor = getTaskStatusColor(task.status as TaskStatus, taskStatusColors);
    return {
      bg: hexToRgba(statusColor, 0.16),
      border: statusColor,
      text: "#0f172a"
    };
  }

  return {
    bg: "rgba(100, 116, 139, 0.14)",
    border: "#64748b",
    text: "#1e293b"
  };
};

const buildPositionedEvents = (events: CalendarApiEvent[], day: Date): PositionedEvent[] => {
  const dayEvents = events
    .filter((event) => isSameDay(new Date(event.startsAt), day))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const active: PositionedEvent[] = [];
  const positioned: PositionedEvent[] = [];

  for (const event of dayEvents) {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    const endMinutesRaw = endsAt.getHours() * 60 + endsAt.getMinutes();

    const startOffset = clamp(startMinutes - GRID_START_HOUR * 60, 0, GRID_TOTAL_MINUTES);
    const endOffset = clamp(Math.max(endMinutesRaw, startMinutes + 30) - GRID_START_HOUR * 60, 0, GRID_TOTAL_MINUTES);

    if (startOffset >= GRID_TOTAL_MINUTES || endOffset <= 0) {
      continue;
    }

    const top = Math.max(0, startOffset * GRID_MINUTE_HEIGHT);
    const height = Math.max(45, (endOffset - startOffset) * GRID_MINUTE_HEIGHT);

    const activeStillRunning = active.filter((item) => item.top + item.height > top);
    active.length = 0;
    active.push(...activeStillRunning);

    const used = new Set(active.map((item) => item.column));
    let column = 0;
    while (used.has(column)) {
      column += 1;
    }

    const row: PositionedEvent = {
      event,
      top,
      height,
      column,
      columns: column + 1
    };

    active.push(row);
    positioned.push(row);

    const maxColumns = Math.max(...active.map((item) => item.column + 1));
    for (const item of active) {
      item.columns = Math.max(item.columns, maxColumns);
    }
  }

  return positioned;
};

const buildDefaultEventStart = (referenceDay: Date) => {
  const date = new Date(referenceDay);
  date.setHours(9, 0, 0, 0);
  return date;
};

const CalendarBoardView = ({
  events,
  tasks,
  stages,
  members,
  currentUser,
  currentWeek,
  currentMonth,
  daysWithEvents,
  onCreateEvent,
  onCreateTask,
  onRescheduleTask,
  onSelectDay,
  onChangeWeek,
  onChangeMonth,
  onChangeView,
  onEventClick,
  loading,
  errorMessage
}: CalendarBoardViewProps) => {
  const { settings: frontendSettings } = useFrontendSettings();
  const taskStatusColors = frontendSettings.taskStatusColors;
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<CalendarView>("semana");
  const [selectedDay, setSelectedDay] = useState<Date>(() => normalizeDate(currentWeek[0] ?? new Date()));
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("evento");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const [rescheduleTaskId, setRescheduleTaskId] = useState("");
  const [rescheduleDatetime, setRescheduleDatetime] = useState("");
  const [confirmOutOfSchedule, setConfirmOutOfSchedule] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventCreatePayload["eventType"]>("REUNION");
  const [eventStartsAt, setEventStartsAt] = useState(() => {
    const start = buildDefaultEventStart(selectedDay);
    return toLocalDateTimeInput(start);
  });
  const [eventEndsAt, setEventEndsAt] = useState(() => {
    const start = buildDefaultEventStart(selectedDay);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return toLocalDateTimeInput(end);
  });
  const [eventDescription, setEventDescription] = useState("");
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);

  const [taskName, setTaskName] = useState("");
  const [taskStageId, setTaskStageId] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskStartAt, setTaskStartAt] = useState(() => toLocalDateTimeInput(buildDefaultEventStart(selectedDay)));
  const [taskDueAt, setTaskDueAt] = useState(() => {
    const value = buildDefaultEventStart(selectedDay);
    value.setHours(value.getHours() + 2);
    return toLocalDateTimeInput(value);
  });
  const [taskPriority, setTaskPriority] = useState<CalendarTaskCreatePayload["prioridad"]>("MEDIA");
  const [taskDescription, setTaskDescription] = useState("");

  useEffect(() => {
    setSelectedDay((current) => {
      const inRange = currentWeek.some((item) => isSameDay(item, current));
      if (inRange) {
        return current;
      }
      return normalizeDate(currentWeek[0] ?? new Date());
    });
  }, [currentWeek]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const container = timeGridRef.current;
    if (!container) {
      return;
    }
    const currentHour = new Date().getHours();
    const targetHour = Math.max(GRID_START_HOUR, currentHour - 1);
    const scrollPx = (targetHour - GRID_START_HOUR) * GRID_HOUR_HEIGHT;
    container.scrollTop = scrollPx;
  }, []);

  useEffect(() => {
    const start = buildDefaultEventStart(selectedDay);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    setEventStartsAt(toLocalDateTimeInput(start));
    setEventEndsAt(toLocalDateTimeInput(end));
    setTaskStartAt(toLocalDateTimeInput(start));
    const due = new Date(start);
    due.setHours(due.getHours() + 2);
    setTaskDueAt(toLocalDateTimeInput(due));
  }, [selectedDay]);

  const dayKeysWithEvents = useMemo(() => new Set(daysWithEvents.map((day) => toDateKey(day))), [daysWithEvents]);

  const monthGridDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const membersById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);

  const upcomingEvents = useMemo(() => {
    const nowMs = Date.now();
    return [...events]
      .filter((event) => new Date(event.endsAt).getTime() >= nowMs)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 12);
  }, [events]);

  const tasksForSelectedDay = useMemo(() => {
    return tasks.filter((task) => {
      if (task.status === "COMPLETADA") {
        return false;
      }

      if (task.dueDate && isSameDay(new Date(task.dueDate), selectedDay)) {
        return true;
      }

      if (task.startDate && isSameDay(new Date(task.startDate), selectedDay)) {
        return true;
      }

      return false;
    });
  }, [selectedDay, tasks]);

  const displayedDays = useMemo(() => {
    if (activeView === "hoy") {
      return [selectedDay];
    }

    if (activeView === "mes") {
      return monthGridDays;
    }

    return currentWeek;
  }, [activeView, currentWeek, monthGridDays, selectedDay]);

  const positionedWeekEvents = useMemo(() => {
    if (activeView === "mes") {
      return new Map<string, PositionedEvent[]>();
    }

    const map = new Map<string, PositionedEvent[]>();
    for (const day of displayedDays) {
      map.set(toDateKey(day), buildPositionedEvents(events, day));
    }
    return map;
  }, [activeView, displayedDays, events]);

  const gridColumnTemplate = useMemo(() => {
    const dayCount = activeView === "hoy" ? 1 : currentWeek.length;
    return `64px repeat(${dayCount}, minmax(0, 1fr))`;
  }, [activeView, currentWeek.length]);

  const openModal = (tab: ModalTab, startDate?: Date) => {
    const base = startDate ? new Date(startDate) : buildDefaultEventStart(selectedDay);
    base.setSeconds(0, 0);
    const end = new Date(base);
    end.setHours(end.getHours() + 1);

    setModalTab(tab);
    setShowModal(true);
    setLocalError(null);
    setEventStartsAt(toLocalDateTimeInput(base));
    setEventEndsAt(toLocalDateTimeInput(end));
    setTaskStartAt(toLocalDateTimeInput(base));

    const due = new Date(base);
    due.setHours(due.getHours() + 2);
    setTaskDueAt(toLocalDateTimeInput(due));
  };

  const closeModal = () => {
    setShowModal(false);
    setBusy(false);
    setLocalError(null);
  };

  const handleSelectDay = (day: Date) => {
    const normalized = normalizeDate(day);
    setSelectedDay(normalized);
    onSelectDay(normalized);
    setMobileSidebarOpen(false);
  };

  const handleChangeView = (view: CalendarView) => {
    setActiveView(view);
    onChangeView(view);
  };

  const toggleInvite = (userId: string) => {
    setSelectedInviteIds((current) =>
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    );
  };

  const handleSubmitEvent = async () => {
    setLocalError(null);

    if (!eventTitle.trim()) {
      setLocalError("Ingresa un título para el evento.");
      return;
    }

    const startsAt = new Date(eventStartsAt);
    const endsAt = new Date(eventEndsAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setLocalError("Selecciona fecha y hora válidas para el evento.");
      return;
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      setLocalError("La fecha de fin debe ser posterior a la fecha de inicio.");
      return;
    }

    const participantIds = [
      ...new Set([...(currentUser?.id ? [currentUser.id] : []), ...selectedInviteIds])
    ];

    if (participantIds.length === 0) {
      setLocalError("Selecciona al menos un participante para crear el evento.");
      return;
    }

    setBusy(true);

    try {
      const cleanDescription = eventDescription.trim();
      await onCreateEvent({
        title: eventTitle.trim(),
        eventType,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        participantIds,
        ...(cleanDescription ? { description: cleanDescription } : {})
      });
      closeModal();
      setEventTitle("");
      setEventDescription("");
      setSelectedInviteIds([]);
    } catch (error) {
      setLocalError((error as Error).message);
      setBusy(false);
    }
  };

  const handleSubmitTask = async () => {
    setLocalError(null);

    if (!taskName.trim()) {
      setLocalError("Ingresa un nombre para la tarea.");
      return;
    }

    if (!taskStartAt || !taskDueAt) {
      setLocalError("Selecciona fecha de inicio y fecha de vencimiento.");
      return;
    }

    const startsAt = new Date(taskStartAt);
    const endsAt = new Date(taskDueAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setLocalError("Selecciona fechas válidas para la tarea.");
      return;
    }

    if (endsAt.getTime() < startsAt.getTime()) {
      setLocalError("La fecha de vencimiento no puede ser menor a la fecha de inicio.");
      return;
    }

    setBusy(true);

    try {
      await onCreateTask({
        nombre: taskName.trim(),
        etapa: taskStageId,
        responsable: taskAssigneeId,
        fechaInicio: startsAt.toISOString(),
        fechaFin: endsAt.toISOString(),
        prioridad: taskPriority,
        descripcion: taskDescription.trim(),
        mostrarEnGantt: true,
        mostrarEnCalendario: true
      });

      closeModal();
      setTaskName("");
      setTaskDescription("");
      setTaskStageId("");
      setTaskAssigneeId("");
      setTaskPriority("MEDIA");
    } catch (error) {
      setLocalError((error as Error).message);
      setBusy(false);
    }
  };

  const handleRescheduleTask = async () => {
    setLocalError(null);

    const task = tasks.find((item) => item.id === rescheduleTaskId);

    if (!task) {
      setLocalError("Selecciona una tarea válida para reprogramar.");
      return;
    }

    if (!rescheduleDatetime) {
      setLocalError("Selecciona una nueva fecha y hora.");
      return;
    }

    const nextDate = new Date(rescheduleDatetime);
    if (Number.isNaN(nextDate.getTime())) {
      setLocalError("La nueva fecha no es válida.");
      return;
    }

    setBusy(true);

    try {
      await onRescheduleTask(task, nextDate.toISOString(), confirmOutOfSchedule);
      setRescheduleTaskId("");
      setRescheduleDatetime("");
      setConfirmOutOfSchedule(false);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGridClick = (day: Date, event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-calendar-event-card='true']")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetY = clamp(event.clientY - bounds.top, 0, GRID_TOTAL_HEIGHT - 1);
    const minuteOffset = Math.floor(offsetY / GRID_MINUTE_HEIGHT);

    const start = new Date(day);
    start.setHours(GRID_START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + minuteOffset);

    openModal("evento", start);
  };

  const nowMs = now.getTime();

  const showMonthView = activeView === "mes";
  const timelineDays = activeView === "hoy" ? [selectedDay] : currentWeek;
  const timelineIsTodayInView = timelineDays.some((day) => isSameDay(day, now));

  const nowTop = useMemo(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return (currentMinutes - GRID_START_HOUR * 60) * GRID_MINUTE_HEIGHT;
  }, [now]);

  const hourRows = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, index) => GRID_START_HOUR + index),
    []
  );

  return (
    <section className={`${dmSans.className} h-full min-h-0 w-full overflow-hidden bg-[#f0f4f9] p-2 lg:grid lg:grid-cols-[clamp(340px,31vw,400px)_minmax(0,1fr)] lg:gap-3`}>
      <aside className={`${mobileSidebarOpen ? "flex" : "hidden"} lg:flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e2e8f2] bg-white p-3 shadow-[0_2px_12px_rgba(15,27,45,0.07)]`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="shrink-0 rounded-[10px] border border-[#d7dff0] px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label="Cerrar panel"
            >
              ←
            </button>
            <h2 className={`${sora.className} text-base font-semibold text-slate-900`}>Calendario</h2>
          </div>
          <button
            type="button"
            onClick={() => openModal("evento")}
            className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[#4f6ef7] px-3 text-xs font-semibold text-white transition hover:bg-[#3f5ce0]"
          >
            Nuevo evento
          </button>
        </div>

        <div className="shrink-0 rounded-2xl border border-[#e2e8f2] bg-[#f8faff] p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onChangeMonth("prev")}
              className="h-8 w-8 rounded-lg border border-[#d7dff0] text-slate-600 transition hover:bg-white"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <p className={`${sora.className} text-sm font-semibold text-slate-800`}>
              {currentMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => onChangeMonth("next")}
              className="h-8 w-8 rounded-lg border border-[#d7dff0] text-slate-600 transition hover:bg-white"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {WEEKDAY_HEADER.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGridDays.map((day) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, now);
              const isSelected = isSameDay(day, selectedDay);
              const hasEvents = dayKeysWithEvents.has(toDateKey(day));

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`relative h-9 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? "border border-[#4f6ef7] bg-white text-[#1d3ca6]"
                      : "border border-transparent hover:bg-[#eef2f9]"
                  } ${isCurrentMonth ? "text-slate-700" : "text-slate-400"}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                      isToday ? "bg-[#4f6ef7] text-white" : ""
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {hasEvents ? <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#10b981]" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 shrink-0 grid grid-cols-3 gap-2 rounded-2xl border border-[#e2e8f2] bg-white p-2">
          {([
            { value: "hoy", label: "Hoy" },
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mes" }
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChangeView(option.value)}
              className={`h-8 rounded-[10px] text-xs font-semibold transition ${
                activeView === option.value
                  ? "bg-[#4f6ef7] text-white"
                  : "border border-[#d7dff0] bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3 shrink-0 rounded-2xl border border-[#e2e8f2] bg-white p-3">
          <h3 className={`${sora.className} mb-2 text-sm font-semibold text-slate-900`}>Reprogramar tarea</h3>
          <select
            value={rescheduleTaskId}
            onChange={(event) => setRescheduleTaskId(event.target.value)}
            className="h-10 w-full rounded-[10px] border border-[#d7dff0] bg-white px-3 text-sm text-slate-700"
          >
            <option value="">Seleccionar tarea</option>
            {tasksForSelectedDay.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={rescheduleDatetime}
            onChange={(event) => setRescheduleDatetime(event.target.value)}
            className="mt-2 h-10 w-full rounded-[10px] border border-[#d7dff0] bg-white px-3 text-sm text-slate-700"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={confirmOutOfSchedule}
              onChange={(event) => setConfirmOutOfSchedule(event.target.checked)}
            />
            Confirmar fuera de jornada laboral
          </label>
          <button
            type="button"
            onClick={handleRescheduleTask}
            disabled={busy || !rescheduleTaskId || !rescheduleDatetime}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-[#4f6ef7] text-sm font-semibold text-white transition hover:bg-[#3f5ce0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reprogramar
          </button>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#e2e8f2] bg-white p-3">
          <h3 className={`${sora.className} mb-2 text-sm font-semibold text-slate-900`}>Próximos eventos</h3>
          <div className="calendar-upcoming-scroll min-h-0 flex-1 overflow-y-auto pr-2">
            {upcomingEvents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                Sin eventos próximos.
              </p>
            ) : (
              <ul className="w-full space-y-2">
                {upcomingEvents.map((event) => {
                  const task = event.type === "TAREA" ? tasksById.get(event.id) : undefined;
                  const state = resolveTaskState(task, nowMs, taskStatusColors);
                  const startsAt = new Date(event.startsAt);
                  const owner = event.userId ? membersById.get(event.userId)?.fullName : null;

                  return (
                    <li
                      key={`upcoming-${event.id}`}
                      className="min-w-0 rounded-xl border border-[#e2e8f2] bg-white px-3 py-2 transition hover:translate-x-0.5 hover:shadow-sm"
                      style={{ borderLeft: `4px solid ${state.borderColor}` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">
                          {startsAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          style={state.chipStyle}
                        >
                          {state.label}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{event.title}</p>
                      <p className="break-words text-xs text-slate-500">
                        {owner ?? "Proyecto"} · {formatRelativeEventDate(event.startsAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </aside>

      <section className={`${mobileSidebarOpen ? "hidden" : "flex"} lg:flex min-h-0 min-w-0 flex-col rounded-2xl border border-[#e2e8f2] bg-white shadow-[0_2px_12px_rgba(15,27,45,0.07)]`}>
        {(errorMessage || localError) && (
          <div className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage ?? localError}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f2] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="shrink-0 rounded-[10px] border border-[#d7dff0] px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label="Opciones de calendario"
            >
              ☰
            </button>
            <div className="min-w-0">
              <h2 className={`${sora.className} truncate text-base font-semibold text-slate-900`}>
                {activeView === "mes"
                  ? `Mes de ${currentMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`
                  : `${timelineDays[0]?.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) ?? ""} - ${
                      timelineDays[timelineDays.length - 1]?.toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short"
                      }) ?? ""
                    }`}
              </h2>
              <p className="text-xs text-slate-500">Vista colaborativa de agenda semanal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeWeek("prev")}
              className="h-9 w-9 rounded-[10px] border border-[#d7dff0] text-slate-600 transition hover:bg-slate-50"
              aria-label="Semana anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onChangeWeek("next")}
              className="h-9 w-9 rounded-[10px] border border-[#d7dff0] text-slate-600 transition hover:bg-slate-50"
              aria-label="Semana siguiente"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => openModal("evento")}
              className="h-9 rounded-[10px] bg-[#4f6ef7] px-3 text-sm font-semibold text-white transition hover:bg-[#3f5ce0]"
            >
              Nuevo evento
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid flex-1 grid-cols-1 gap-2 p-4">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : showMonthView ? (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {WEEKDAY_LONG.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthGridDays.map((day) => {
                const dayEvents = events
                  .filter((event) => isSameDay(new Date(event.startsAt), day))
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
                const isToday = isSameDay(day, now);
                const isSelected = isSameDay(day, selectedDay);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

                return (
                  <button
                    key={`month-${day.toISOString()}`}
                    type="button"
                    onClick={() => {
                      handleSelectDay(day);
                      setActiveView("hoy");
                      onChangeView("hoy");
                    }}
                    className={`min-h-28 rounded-xl border p-2 text-left transition ${
                      isSelected
                        ? "border-[#4f6ef7] bg-[#eff4ff]"
                        : "border-[#e2e8f2] bg-white hover:border-[#cfd8ee]"
                    } ${!isCurrentMonth ? "opacity-50" : ""}`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-[#4f6ef7] text-white" : "text-slate-700"}`}>
                      {day.getDate()}
                    </span>
                    <div className="mt-2 space-y-1">
                      {dayEvents.length === 0 ? (
                        <p className="text-[11px] text-slate-400">Sin eventos</p>
                      ) : (
                        dayEvents.slice(0, 3).map((event) => (
                          <p key={`month-item-${event.id}`} className="truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                            {event.title}
                          </p>
                        ))
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="grid border-b border-[#e2e8f2] bg-[#f8faff]"
              style={{ gridTemplateColumns: gridColumnTemplate }}
            >
              <div className="border-r border-[#e2e8f2] px-2 py-2 text-xs font-semibold text-slate-500">Hora</div>
              {timelineDays.map((day, index) => {
                const isToday = isSameDay(day, now);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={`header-${day.toISOString()}`}
                    className={`border-r border-[#e2e8f2] px-2 py-2 text-center ${
                      isWeekend ? "bg-slate-50" : ""
                    } ${isToday ? "bg-[#ecf2ff]" : ""}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-500">{WEEKDAY_LONG[(day.getDay() + 6) % 7]}</p>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-[#4f6ef7] text-white" : "text-slate-700"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            <div ref={timeGridRef} className="calendar-hours-scroll min-h-0 flex-1 overflow-x-auto overflow-y-scroll">
              <div className="grid" style={{ gridTemplateColumns: gridColumnTemplate }}>
                <div className="relative border-r border-[#e2e8f2] bg-white" style={{ height: GRID_TOTAL_HEIGHT }}>
                  {hourRows.map((hour) => (
                    <div key={`hour-${hour}`} className="border-b border-[#eef2f9] pr-2 text-right text-[11px] text-slate-500" style={{ height: GRID_HOUR_HEIGHT }}>
                      <span className="relative -top-2 inline-block bg-white px-1">{formatHourLabel(hour)}</span>
                    </div>
                  ))}
                  <div className="pointer-events-none absolute bottom-0 right-0 pr-2 text-right text-[11px] text-slate-500">
                    <span className="relative top-2 inline-block bg-white px-1">{formatHourLabel(GRID_END_HOUR)}</span>
                  </div>
                </div>

                {timelineDays.map((day) => {
                  const dayKey = toDateKey(day);
                  const eventRows = positionedWeekEvents.get(dayKey) ?? [];
                  const isToday = isSameDay(day, now);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <div
                      key={`column-${dayKey}`}
                      className={`relative border-r border-[#e2e8f2] ${isWeekend ? "bg-slate-50/50" : "bg-white"}`}
                      style={{ height: GRID_TOTAL_HEIGHT }}
                      onClick={(event) => handleGridClick(day, event)}
                    >
                      {Array.from({ length: GRID_TOTAL_MINUTES / 30 }, (_, index) => (
                        <div
                          key={`line-${dayKey}-${index}`}
                          className={`${index % 2 === 0 ? "border-t border-[#eef2f9]" : "border-t border-dashed border-[#e7edf7]"}`}
                          style={{ height: 30 }}
                        />
                      ))}

                      {eventRows.map((row) => {
                        const task = row.event.type === "TAREA" ? tasksById.get(row.event.id) : undefined;
                        const responsible =
                          row.event.userId && membersById.get(row.event.userId)
                            ? membersById.get(row.event.userId)!.fullName
                            : "Sin asignar";
                        const tone = eventTone(row.event, task, nowMs, taskStatusColors);

                        return (
                          <button
                            key={`event-${row.event.id}-${row.top}-${row.column}`}
                            type="button"
                            data-calendar-event-card="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEventClick(row.event);
                            }}
                            className="absolute rounded-lg border px-2 py-1 text-left shadow-sm transition duration-150 hover:scale-[1.02] hover:shadow-md"
                            style={{
                              top: row.top,
                              height: row.height,
                              left: `calc(${(row.column / row.columns) * 100}% + 2px)`,
                              width: `calc(${100 / row.columns}% - 4px)`,
                              backgroundColor: tone.bg,
                              borderColor: tone.border,
                              color: tone.text
                            }}
                          >
                            <p className="truncate text-[12px] font-semibold">{row.event.title}</p>
                            <p className="truncate text-[11px] opacity-90">{formatTimeRange(row.event.startsAt, row.event.endsAt)}</p>
                            <p className="mt-1 truncate text-[10px] opacity-75">{responsible}</p>
                          </button>
                        );
                      })}

                      {isToday && timelineIsTodayInView && nowTop >= 0 && nowTop <= GRID_TOTAL_HEIGHT ? (
                        <div className="pointer-events-none absolute left-0 right-0" style={{ top: nowTop }}>
                          <div className="relative h-0.5 bg-red-500">
                            <span className="absolute -left-1.5 -top-1 h-3 w-3 rounded-full border border-white bg-red-500" />
                          </div>
                        </div>
                      ) : null}

                      {eventRows.length === 0 ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-300">
                          Sin eventos
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-[520px] rounded-2xl border border-[#e2e8f2] bg-white p-4 shadow-xl transition"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`${sora.className} text-lg font-semibold text-slate-900`}>Nuevo registro</h3>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-lg border border-[#d7dff0] text-slate-500 transition hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-[#e2e8f2] bg-[#f8faff] p-1">
              {([
                { value: "evento", label: "Evento" },
                { value: "tarea", label: "Tarea" }
              ] as const).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setModalTab(tab.value)}
                  className={`h-9 rounded-[10px] text-sm font-semibold transition ${
                    modalTab === tab.value
                      ? "bg-[#4f6ef7] text-white"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {modalTab === "evento" ? (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Título del evento</span>
                  <input
                    value={eventTitle}
                    onChange={(event) => setEventTitle(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    placeholder="Ej. Revisión semanal"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
                  <select
                    value={eventType}
                    onChange={(event) =>
                      setEventType(event.target.value as CalendarEventCreatePayload["eventType"])
                    }
                    className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                  >
                    <option value="REUNION">Reunión</option>
                    <option value="CALL">Call</option>
                    <option value="RECORDATORIO">Recordatorio</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inicio</span>
                    <input
                      type="datetime-local"
                      value={eventStartsAt}
                      onChange={(event) => setEventStartsAt(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fin</span>
                    <input
                      type="datetime-local"
                      value={eventEndsAt}
                      onChange={(event) => setEventEndsAt(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invitados</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-[10px] border border-[#d7dff0] bg-white p-2">
                    {members.map((member) => {
                      const checked = selectedInviteIds.includes(member.userId);
                      return (
                        <label key={`invite-${member.userId}`} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInvite(member.userId)}
                          />
                          <span>{member.fullName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</span>
                  <textarea
                    value={eventDescription}
                    onChange={(event) => setEventDescription(event.target.value)}
                    className="h-24 w-full rounded-[10px] border border-[#d7dff0] px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </label>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="h-10 rounded-[10px] border border-[#d7dff0] px-4 text-sm font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitEvent}
                    disabled={busy}
                    className="h-10 rounded-[10px] bg-[#4f6ef7] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Crear evento
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre de la tarea</span>
                  <input
                    value={taskName}
                    onChange={(event) => setTaskName(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    placeholder="Ej. Entregar módulo de autenticación"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Etapa</span>
                    <select
                      value={taskStageId}
                      onChange={(event) => setTaskStageId(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    >
                      <option value="">Sin etapa</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.code} · {stage.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsable</span>
                    <select
                      value={taskAssigneeId}
                      onChange={(event) => setTaskAssigneeId(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {members.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de inicio</span>
                    <input
                      type="datetime-local"
                      value={taskStartAt}
                      onChange={(event) => setTaskStartAt(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de vencimiento</span>
                    <input
                      type="datetime-local"
                      value={taskDueAt}
                      onChange={(event) => setTaskDueAt(event.target.value)}
                      className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridad</span>
                  <select
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(event.target.value as CalendarTaskCreatePayload["prioridad"])
                    }
                    className="h-10 w-full rounded-[10px] border border-[#d7dff0] px-3 text-sm"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</span>
                  <textarea
                    value={taskDescription}
                    onChange={(event) => setTaskDescription(event.target.value)}
                    className="h-24 w-full rounded-[10px] border border-[#d7dff0] px-3 py-2 text-sm"
                    placeholder="Describe la actividad"
                  />
                </label>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  ⚡ Esta tarea también aparecerá en el módulo de Tareas y en el Gantt con las fechas que definas aquí.
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="h-10 rounded-[10px] border border-[#d7dff0] px-4 text-sm font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitTask}
                    disabled={busy}
                    className="h-10 rounded-[10px] bg-[#4f6ef7] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Crear tarea
                  </button>
                </div>
              </div>
            )}

            {localError ? <p className="mt-3 text-sm text-red-600">{localError}</p> : null}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .calendar-hours-scroll,
        .calendar-upcoming-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(79, 110, 247, 0.55) rgba(226, 232, 240, 0.7);
          scrollbar-gutter: stable;
        }

        .calendar-hours-scroll::-webkit-scrollbar,
        .calendar-upcoming-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .calendar-hours-scroll::-webkit-scrollbar-track,
        .calendar-upcoming-scroll::-webkit-scrollbar-track {
          background: rgba(226, 232, 240, 0.7);
          border-radius: 999px;
        }

        .calendar-hours-scroll::-webkit-scrollbar-thumb,
        .calendar-upcoming-scroll::-webkit-scrollbar-thumb {
          background: rgba(79, 110, 247, 0.55);
          border: 2px solid transparent;
          border-radius: 999px;
          background-clip: padding-box;
        }

        .calendar-hours-scroll::-webkit-scrollbar-thumb:hover,
        .calendar-upcoming-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(63, 92, 224, 0.72);
          background-clip: padding-box;
        }
      `}</style>
    </section>
  );
};

export const CalendarBoard = () => {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const dashboardContext = useMemo(() => getContextFromSearchParams(params), [params]);
  const projectId = dashboardContext.projectId;
  const session = useSession();

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);

  const currentWeek = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const monthStart = useMemo(() => new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1), [monthAnchor]);

  const eventsQuery = useQuery({
    queryKey: ["calendar", "shared", projectId, weekStart.toISOString()],
    queryFn: () =>
      apiRequest<CalendarApiEvent[]>(
        `/calendar/shared?scope=PROYECTO&scopeId=${encodeURIComponent(projectId!)}&view=SEMANA&date=${encodeURIComponent(weekStart.toISOString())}`
      ),
    enabled: Boolean(projectId)
  });

  const monthEventsQuery = useQuery({
    queryKey: ["calendar", "month-days", projectId, monthStart.toISOString()],
    queryFn: () =>
      apiRequest<CalendarApiEvent[]>(
        `/calendar/shared?scope=PROYECTO&scopeId=${encodeURIComponent(projectId!)}&view=MES&date=${encodeURIComponent(monthStart.toISOString())}`
      ),
    enabled: Boolean(projectId)
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "calendar", projectId],
    queryFn: () => apiRequest<Task[]>(`/tasks?projectId=${encodeURIComponent(projectId!)}`),
    enabled: Boolean(projectId)
  });

  const stagesQuery = useQuery({
    queryKey: ["project-stages", projectId],
    queryFn: () => apiRequest<ProjectStage[]>(`/projects/${projectId}/stages`),
    enabled: Boolean(projectId)
  });

  const membersQuery = useQuery({
    queryKey: ["project-members-availability", projectId],
    queryFn: () =>
      apiRequest<ProjectMemberAvailability[]>(
        `/tasks/project-members?projectId=${encodeURIComponent(projectId!)}`
      ),
    enabled: Boolean(projectId)
  });

  const createEventMutation = useMutation({
    mutationFn: async (payload: CalendarEventCreatePayload) => {
      if (!projectId) {
        throw new Error("Selecciona un proyecto para crear eventos.");
      }

      const participantIds = [...new Set(payload.participantIds)];
      if (participantIds.length === 0) {
        throw new Error("Debes seleccionar al menos un participante.");
      }

      return apiRequest("/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          projectId,
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
          participantIds,
          agenda: payload.description ? [payload.description] : []
        })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar", "shared", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "month-days", projectId] });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: CalendarTaskCreatePayload) => {
      if (!projectId) {
        throw new Error("Selecciona un proyecto para crear tareas.");
      }

      return apiRequest<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          title: payload.nombre,
          description: payload.descripcion,
          stageId: payload.etapa || undefined,
          assigneeId: payload.responsable || undefined,
          startDate: payload.fechaInicio,
          dueDate: payload.fechaFin,
          status: "PENDIENTE"
        })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", "calendar", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "shared", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "month-days", projectId] });
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (payload: {
      task: Task;
      newDatetime: string;
      confirmOutOfSchedule: boolean;
    }) => {
      return apiRequest<{ warnings: string[] }>("/calendar/tasks/reschedule", {
        method: "POST",
        body: JSON.stringify({
          taskId: payload.task.id,
          dueDate: payload.newDatetime,
          confirmOutOfSchedule: payload.confirmOutOfSchedule,
          allowDependencyConflict: true
        })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", "calendar", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "shared", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "month-days", projectId] });
    }
  });

  const onCreateEvent = useCallback(
    async (eventData: CalendarEventCreatePayload) => {
      await createEventMutation.mutateAsync(eventData);
    },
    [createEventMutation]
  );

  const onCreateTask = useCallback(
    async (taskData: CalendarTaskCreatePayload) => {
      await createTaskMutation.mutateAsync(taskData);
    },
    [createTaskMutation]
  );

  const onRescheduleTask = useCallback(
    async (task: Task, newDatetime: string, confirmOutOfSchedule: boolean) => {
      await rescheduleMutation.mutateAsync({ task, newDatetime, confirmOutOfSchedule });
    },
    [rescheduleMutation]
  );

  const onChangeWeek = useCallback((direction: "prev" | "next") => {
    setWeekAnchor((current) => addDays(current, direction === "prev" ? -7 : 7));
  }, []);

  const onChangeMonth = useCallback((direction: "prev" | "next") => {
    setMonthAnchor((current) => {
      const copy = new Date(current);
      copy.setMonth(copy.getMonth() + (direction === "prev" ? -1 : 1));
      return copy;
    });
  }, []);

  const onSelectDay = useCallback((date: Date) => {
    const week = startOfWeek(date);
    setWeekAnchor(week);
    setMonthAnchor(date);
  }, []);

  const onChangeView = useCallback((_view: CalendarView) => {
    // Reserved for analytics/filter sync if needed.
  }, []);

  const onEventClick = useCallback((_event: CalendarApiEvent) => {
    // Hook available for details drawer.
  }, []);

  const daysWithEvents = useMemo(() => {
    const source = monthEventsQuery.data ?? [];
    const unique = new Map<string, Date>();
    for (const event of source) {
      const date = new Date(event.startsAt);
      unique.set(toDateKey(date), normalizeDate(date));
    }
    return [...unique.values()];
  }, [monthEventsQuery.data]);

  const loading =
    eventsQuery.isLoading || tasksQuery.isLoading || stagesQuery.isLoading || membersQuery.isLoading;

  const errorMessage =
    eventsQuery.error?.message ??
    tasksQuery.error?.message ??
    stagesQuery.error?.message ??
    membersQuery.error?.message ??
    null;

  const currentUser = session.data
    ? {
        id: session.data.id,
        fullName: `${session.data.firstName} ${session.data.lastName}`.trim()
      }
    : null;

  return (
    <CalendarBoardView
      events={eventsQuery.data ?? []}
      tasks={tasksQuery.data ?? []}
      stages={stagesQuery.data ?? []}
      members={membersQuery.data ?? []}
      currentUser={currentUser}
      currentWeek={currentWeek}
      currentMonth={monthStart}
      daysWithEvents={daysWithEvents}
      onCreateEvent={onCreateEvent}
      onCreateTask={onCreateTask}
      onRescheduleTask={onRescheduleTask}
      onSelectDay={onSelectDay}
      onChangeWeek={onChangeWeek}
      onChangeMonth={onChangeMonth}
      onChangeView={onChangeView}
      onEventClick={onEventClick}
      loading={loading}
      errorMessage={errorMessage}
    />
  );
};
