"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@corelia/ui";
import type { Route } from "next";
import { NotificationsBadge } from "@/components/notifications-badge";
import { apiRequest } from "@/lib/api";
import { withDashboardContext } from "@/lib/context";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  ownerId: string;
  createdAt: string;
};

const resourceCards = [
  { label: "Tareas", href: "/tasks", description: "Backlog, estado y asignaciones" },
  { label: "Mensajería", href: "/messaging", description: "Canales del proyecto y menciones" },
  { label: "Reuniones", href: "/meetings", description: "Agenda y videollamadas del proyecto" },
  { label: "Calendario", href: "/calendar", description: "Vista semanal y agenda por hora" },
  { label: "Archivos", href: "/files", description: "Documentación del proyecto" }
];

export default function ProjectsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.get("projectId") ?? "");

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiRequest<ProjectItem[]>("/projects")
  });

  useEffect(() => {
    const fromQuery = params.get("projectId") ?? "";
    if (fromQuery !== selectedProjectId) {
      setSelectedProjectId(fromQuery);
    }
  }, [params, selectedProjectId]);

  const selectedProject = useMemo(
    () => projectsQuery.data?.find((project) => project.id === selectedProjectId) ?? null,
    [projectsQuery.data, selectedProjectId]
  );

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const next = withDashboardContext("/projects", {
      projectId,
      teamId: params.get("teamId")
    });
    router.push(next as Route);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Proyectos</h1>
          <p className="text-sm text-slate-600">
            Selecciona un proyecto para abrir sus recursos y trabajar en su contexto.
          </p>
        </div>
        <NotificationsBadge />
      </header>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Lista de proyectos</h2>
        {projectsQuery.isLoading ? <p className="text-sm text-slate-600">Cargando proyectos...</p> : null}
        {projectsQuery.error ? <p className="text-sm text-red-600">{projectsQuery.error.message}</p> : null}
        <ul className="space-y-2">
          {projectsQuery.data?.map((project) => {
            const selected = project.id === selectedProjectId;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => selectProject(project.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className={`text-xs ${selected ? "text-slate-200" : "text-slate-600"}`}>
                    {project.template} ·{" "}
                    {new Date(project.createdAt).toLocaleDateString("es-ES", { dateStyle: "medium" })}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {selectedProject ? (
        <Card className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{selectedProject.name}</h2>
            <p className="text-sm text-slate-600">
              {selectedProject.description || "Sin descripción"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {resourceCards.map((resource) => {
              const href = withDashboardContext(resource.href, {
                projectId: selectedProject.id,
                teamId: params.get("teamId")
              });
              return (
                <Link
                  key={resource.href}
                  href={href as Route}
                  className="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{resource.label}</p>
                  <p className="text-xs text-slate-600">{resource.description}</p>
                </Link>
              );
            })}
          </div>

          <div>
            <Link
              href={`/projects/${selectedProject.id}/settings` as Route}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Configurar equipo del proyecto
            </Link>
          </div>
        </Card>
      ) : null}
    </main>
  );
}
