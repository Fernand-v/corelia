"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Task } from "@corelia/types";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

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

  const taskId = params.taskId;

  const taskQuery = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => apiRequest<Task>(`/tasks/${taskId}`),
    enabled: Boolean(taskId)
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
          <p className="text-sm text-red-600">{taskQuery.error?.message ?? "No se pudo cargar la tarea"}</p>
        </Card>
      </main>
    );
  }

  const task = taskQuery.data;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <Card className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Detalle de tarea</p>
          <h1 className="text-2xl font-semibold text-slate-900">{task.title}</h1>
          <p className="text-sm text-slate-600">
            Estado: {task.status} · Desde: {formatDateTime(task.startDate)} · Hasta: {formatDateTime(task.dueDate)}
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Descripción</p>
          <p className="mt-1 text-sm text-slate-700">{task.description ?? "Sin descripción"}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            La reasignación de responsables se realiza desde el módulo <strong>Gestión de Tareas</strong>.
          </p>
        </div>
      </Card>
    </main>
  );
}
