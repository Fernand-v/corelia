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
  CARPETA_CREADA: "border-line bg-paper text-ink",
  ARCHIVO_SUBIDO: "border-line bg-paper text-ink",
  ARCHIVO_ELIMINADO: "border-urgent/30 bg-urgent-muted text-urgent"
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
          <h1 className="text-2xl font-semibold text-ink">Ver cambios</h1>
          <p className="text-sm text-mid">
            {changesQuery.data?.project.name ? `Proyecto: ${changesQuery.data.project.name}` : "Cargando proyecto..."}
          </p>
        </div>
        <Link
          href={filesHref as Route}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-line"
        >
          Ir a archivos
        </Link>
      </header>

      <Card className="space-y-3">
        {changesQuery.isLoading ? <p className="text-sm text-mid">Cargando historial...</p> : null}
        {changesQuery.error ? <p className="text-sm text-urgent">{changesQuery.error.message}</p> : null}

        {!changesQuery.isLoading && !changesQuery.error && changesQuery.data?.changes.length === 0 ? (
          <p className="text-sm text-mid">No hay cambios registrados.</p>
        ) : null}

        {changesQuery.data?.changes.length ? (
          <ul className="space-y-2">
            {changesQuery.data.changes.map((change) => (
              <li key={change.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeTone[change.type]}`}
                      >
                        {typeLabel[change.type]}
                      </span>
                      <p className="text-sm font-semibold text-ink">{change.title}</p>
                    </div>
                    <p className="text-sm text-ink">{change.detail}</p>
                    <p className="text-xs text-mid">Por: {change.actorName}</p>
                  </div>
                  <p className="text-xs text-mid">{formatDateTime(change.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </main>
  );
}
