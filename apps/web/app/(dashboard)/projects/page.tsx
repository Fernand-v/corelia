"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import type { Route } from "next";
import { UiModal } from "@/components/ui-modal";
import { apiRequest } from "@/lib/api";
import { withDashboardContext } from "@/lib/context";
import { useSession } from "@/lib/session";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  ownerId: string;
  createdAt: string;
};

type ProjectTemplate = "SOFTWARE" | "CONTENIDO" | "OPERACIONES";

const resourceCards = [
  { label: "Tareas", href: "/tasks", description: "Backlog, estado y asignaciones" },
  { label: "Reuniones", href: "/meetings", description: "Agenda y videollamadas del proyecto" },
  { label: "Calendario", href: "/calendar", description: "Vista semanal y agenda por hora" },
  { label: "Archivos", href: "/files", description: "Documentación del proyecto" },
  { label: "Ver cambios", href: "/changes", description: "Historial reciente de carpetas y archivos" }
];

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const params = useSearchParams();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.get("projectId") ?? "");
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTemplate, setNewProjectTemplate] = useState<ProjectTemplate>("SOFTWARE");
  const [createError, setCreateError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiRequest<ProjectItem[]>("/projects")
  });

  const canCreateProject =
    session.data?.baseRole === "ADMINISTRADOR" ||
    session.data?.activeRole === "ADMINISTRADOR" ||
    session.data?.activeRole === "LIDER_PROYECTO";

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const name = newProjectName.trim();
      if (name.length < 3) {
        throw new Error("El nombre del proyecto debe tener al menos 3 caracteres");
      }

      return apiRequest<ProjectItem>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: newProjectDescription.trim() || undefined,
          template: newProjectTemplate,
          memberIds: []
        })
      });
    },
    onSuccess: async (project) => {
      setCreateError(null);
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectTemplate("SOFTWARE");
      setNewProjectModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      selectProject(project.id);
    },
    onError: (error) => {
      setCreateError(error.message);
    }
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
    const selected = projectsQuery.data?.find((project) => project.id === projectId) ?? null;
    setSelectedProjectId(projectId);
    const next = withDashboardContext("/projects", {
      projectId,
      projectName: selected?.name ?? null,
      teamId: params.get("teamId")
    });
    router.push(next as Route);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <h1 className="sr-only">Proyectos</h1>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mis proyectos</p>
          {canCreateProject ? (
            <Button
              type="button"
              className="h-9 px-3 text-xs"
              onClick={() => {
                setCreateError(null);
                setNewProjectModalOpen(true);
              }}
            >
              Nuevo proyecto
            </Button>
          ) : null}
        </div>

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
            <p className="text-sm font-semibold text-slate-900">{selectedProject.name}</p>
            <p className="text-sm text-slate-600">{selectedProject.description || "Sin descripción"}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resourceCards.map((resource) => {
              const href = withDashboardContext(resource.href, {
                projectId: selectedProject.id,
                projectName: selectedProject.name,
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

      <UiModal
        open={newProjectModalOpen}
        onClose={() => {
          if (!createProjectMutation.isPending) {
            setNewProjectModalOpen(false);
          }
        }}
        title="Nuevo proyecto"
      >
        <form
          id="new-project-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setCreateError(null);
            createProjectMutation.mutate();
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Ej. Plataforma de Soporte"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Plantilla</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={newProjectTemplate}
              onChange={(event) => setNewProjectTemplate(event.target.value as ProjectTemplate)}
            >
              <option value="SOFTWARE">SOFTWARE</option>
              <option value="CONTENIDO">CONTENIDO</option>
              <option value="OPERACIONES">OPERACIONES</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Descripción (opcional)
            </span>
            <textarea
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              placeholder="Objetivo y alcance del proyecto"
            />
          </label>

          {createError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </p>
          ) : null}
        </form>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setNewProjectModalOpen(false)}
            disabled={createProjectMutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="new-project-form" disabled={createProjectMutation.isPending}>
            {createProjectMutation.isPending ? "Creando..." : "Crear proyecto"}
          </Button>
        </div>
      </UiModal>
    </main>
  );
}
