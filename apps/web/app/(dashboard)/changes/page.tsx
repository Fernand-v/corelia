"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@corelia/ui";
import { ProjectContextRequired } from "@/components/project-context-required";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";

type ProjectChangesResponse = {
  project: {
    id: string;
    name: string;
  };
  changes: Array<{
    id: string;
    type: "CARPETA_CREADA" | "ARCHIVO_SUBIDO" | "ARCHIVO_ELIMINADO";
    title: string;
    detail: string;
    actorName: string;
    occurredAt: string;
  }>;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const typeLabel: Record<ProjectChangesResponse["changes"][number]["type"], string> = {
  CARPETA_CREADA: "Carpeta",
  ARCHIVO_SUBIDO: "Archivo subido",
  ARCHIVO_ELIMINADO: "Archivo eliminado"
};

const typeTone: Record<ProjectChangesResponse["changes"][number]["type"], string> = {
  CARPETA_CREADA: "border-blue-200 bg-blue-50 text-blue-700",
  ARCHIVO_SUBIDO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVO_ELIMINADO: "border-red-200 bg-red-50 text-red-700"
};

export default function ProjectChangesPage() {
  const params = useSearchParams();
  const dashboardContext = getContextFromSearchParams(params);
  const projectId = dashboardContext.projectId ?? "";
  const projectName = dashboardContext.projectName;
  const teamId = dashboardContext.teamId;

  const changesQuery = useQuery({
    queryKey: ["files", "history", projectId],
    queryFn: () =>
      apiRequest<ProjectChangesResponse>(
        `/files/history?projectId=${encodeURIComponent(projectId)}&limit=120`
      ),
    enabled: Boolean(projectId)
  });

  if (!projectId) {
    return (
      <ProjectContextRequired
        sectionLabel="Ver cambios"
        description="Selecciona un proyecto para consultar su historial."
      />
    );
  }

  const filesHref = withDashboardContext("/files", {
    projectId,
    projectName: projectName ?? null,
    teamId: teamId ?? null
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ver cambios</h1>
          <p className="text-sm text-slate-600">
            {changesQuery.data?.project.name ? `Proyecto: ${changesQuery.data.project.name}` : "Cargando proyecto..."}
          </p>
        </div>
        <Link
          href={filesHref as Route}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          Ir a archivos
        </Link>
      </header>

      <Card className="space-y-3">
        {changesQuery.isLoading ? <p className="text-sm text-slate-600">Cargando historial...</p> : null}
        {changesQuery.error ? <p className="text-sm text-red-600">{changesQuery.error.message}</p> : null}

        {!changesQuery.isLoading && !changesQuery.error && changesQuery.data?.changes.length === 0 ? (
          <p className="text-sm text-slate-600">No hay cambios registrados.</p>
        ) : null}

        {changesQuery.data?.changes.length ? (
          <ul className="space-y-2">
            {changesQuery.data.changes.map((change) => (
              <li key={change.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeTone[change.type]}`}
                      >
                        {typeLabel[change.type]}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">{change.title}</p>
                    </div>
                    <p className="text-sm text-slate-700">{change.detail}</p>
                    <p className="text-xs text-slate-500">Por: {change.actorName}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(change.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </main>
  );
}
