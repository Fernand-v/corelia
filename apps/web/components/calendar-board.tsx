"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

type CalendarEvent = {
  id: string;
  type: "TAREA" | "REUNION" | "VACACIONES" | "HITO" | "EXTERNO";
  title: string;
  startsAt: string;
  endsAt: string;
  projectId: string | null;
  teamId: string | null;
  readOnly: boolean;
};

const dayLabel = (date: Date) =>
  date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });

const normalizeDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const isSameDay = (a: Date, b: Date) => normalizeDay(a).getTime() === normalizeDay(b).getTime();

const startOfWeek = (date: Date) => {
  const normalized = normalizeDay(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
};

const eventTone = (type: CalendarEvent["type"]) => {
  if (type === "REUNION") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  if (type === "TAREA") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (type === "HITO") {
    return "border-purple-200 bg-purple-50 text-purple-800";
  }
  if (type === "VACACIONES") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export const CalendarBoard = () => {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const projectId = params.get("projectId");

  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => normalizeDay(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [confirmOutOfSchedule, setConfirmOutOfSchedule] = useState(false);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      return day;
    });
  }, [weekStart]);

  const weekRange = useMemo(() => {
    const from = new Date(weekStart);
    const to = new Date(weekStart);
    to.setDate(to.getDate() + 7);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [weekStart]);

  const eventsQuery = useQuery({
    queryKey: ["calendar", "week", projectId, weekRange.from, weekRange.to],
    queryFn: () =>
      apiRequest<CalendarEvent[]>(
        `/calendar/shared?scope=PROYECTO&scopeId=${encodeURIComponent(projectId!)}&view=SEMANA&date=${encodeURIComponent(
          weekRange.from
        )}`
      ),
    enabled: Boolean(projectId)
  });

  const selectedDayEvents = useMemo(() => {
    const list = eventsQuery.data ?? [];
    return list
      .filter((event) => isSameDay(new Date(event.startsAt), selectedDate))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [eventsQuery.data, selectedDate]);

  const taskEventsForDay = useMemo(
    () => selectedDayEvents.filter((event) => event.type === "TAREA"),
    [selectedDayEvents]
  );

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ warnings: string[] }>("/calendar/tasks/reschedule", {
        method: "POST",
        body: JSON.stringify({
          taskId: selectedTaskId,
          dueDate: new Date(dueDate).toISOString(),
          confirmOutOfSchedule,
          allowDependencyConflict: true
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTaskId("");
      setDueDate("");
    }
  });

  const timelineSlots = useMemo(
    () =>
      Array.from({ length: 48 }, (_, index) => {
        const hour = Math.floor(index / 2);
        const minute = index % 2 === 0 ? 0 : 30;
        return {
          hour,
          minute,
          events: selectedDayEvents.filter((event) => {
            const startsAt = new Date(event.startsAt);
            const minuteBucket = startsAt.getMinutes() < 30 ? 0 : 30;
            return startsAt.getHours() === hour && minuteBucket === minute;
          })
        };
      }),
    [selectedDayEvents]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Agenda del día</h2>
        <p className="text-xs text-slate-600">
          Calendario tipo agenda por horas del proyecto activo.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="secondary" onClick={() => setAnchorDate(new Date())}>
            Hoy
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const next = new Date(anchorDate);
              next.setDate(next.getDate() - 7);
              setAnchorDate(next);
            }}
          >
            Semana -
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const next = new Date(anchorDate);
              next.setDate(next.getDate() + 7);
              setAnchorDate(next);
            }}
          >
            Semana +
          </Button>
        </div>

        <div className="space-y-1">
          {weekDays.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDate(normalizeDay(day))}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  isSameDay(day, selectedDate)
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                {dayLabel(day)}
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Reprogramar tarea</h3>
          <select
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            value={selectedTaskId}
            onChange={(event) => setSelectedTaskId(event.target.value)}
          >
            <option value="">Seleccionar tarea del día</option>
            {taskEventsForDay.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={confirmOutOfSchedule}
              onChange={(event) => setConfirmOutOfSchedule(event.target.checked)}
            />
            Confirmar fuera de jornada laboral
          </label>
          <Button
            className="w-full"
            type="button"
            disabled={rescheduleMutation.isPending || !selectedTaskId || !dueDate}
            onClick={() => rescheduleMutation.mutate()}
          >
            {rescheduleMutation.isPending ? "Actualizando..." : "Reprogramar"}
          </Button>
          {rescheduleMutation.error ? (
            <p className="text-sm text-red-600">{rescheduleMutation.error.message}</p>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Calendario semanal ({dayLabel(weekDays[0]!)} - {dayLabel(weekDays[6]!)})
        </h2>

        {eventsQuery.isLoading ? <p className="text-sm text-slate-500">Cargando eventos...</p> : null}
        {eventsQuery.error ? <p className="text-sm text-red-600">{eventsQuery.error.message}</p> : null}

        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const dayEvents =
              eventsQuery.data?.filter((event) => isSameDay(new Date(event.startsAt), day)) ?? [];
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDate(normalizeDay(day))}
                className={`min-h-32 rounded-xl border p-2 text-left ${
                  isSameDay(day, selectedDate)
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-semibold">{dayLabel(day)}</p>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 4).map((event) => (
                    <p
                      key={event.id}
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        isSameDay(day, selectedDate)
                          ? "border-blue-200 bg-white text-blue-900"
                          : eventTone(event.type)
                      }`}
                    >
                      {new Date(event.startsAt).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}{" "}
                      · {event.title}
                    </p>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">
              {selectedDate.toLocaleDateString("es-ES", { dateStyle: "full" })}
            </p>
          </div>
          <div className="max-h-[540px] overflow-y-auto">
            {timelineSlots.map((slot) => (
              <div
                key={`${slot.hour}-${slot.minute}`}
                className="grid grid-cols-[64px_1fr] border-b border-slate-100 px-2 py-1.5"
              >
                <p className="text-xs text-slate-500">
                  {`${`${slot.hour}`.padStart(2, "0")}:${slot.minute === 0 ? "00" : "30"}`}
                </p>
                <div className="space-y-1">
                  {slot.events.length === 0 ? (
                    <p className="text-xs text-slate-300"> </p>
                  ) : (
                    slot.events.map((event) => (
                      <div key={event.id} className={`rounded-lg border px-2 py-1 text-xs ${eventTone(event.type)}`}>
                        <p className="font-medium">{event.title}</p>
                        <p>
                          {new Date(event.startsAt).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                          {" - "}
                          {new Date(event.endsAt).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
