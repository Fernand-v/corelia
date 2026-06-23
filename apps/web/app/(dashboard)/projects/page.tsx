"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import type { Route } from "next";
import { UiModal } from "@/components/ui-modal";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";
import { useSession } from "@/lib/session";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  ownerId: string;
  startDate: string | null;
  estimatedEndDate: string | null;
  createdAt: string;
};

type ProjectTemplate = "SOFTWARE" | "CONTENIDO" | "OPERACIONES";

const resourceCards = [
  { label: "Tareas", href: "/tasks", description: "Backlog, estado y asignaciones" },
  { label: "Reuniones", href: "/meetings", description: "Agenda y videollamadas del proyecto" },
  { label: "Calendario", href: "/calendar", description: "Vista semanal y agenda por hora" },
  { label: "Archivos", href: "/files", description: "Documentación del proyecto" },
  { label: "Ver cambios", href: "/changes", description: "Historial reciente de carpetas y archivos" },
  { label: "Presupuesto", href: "/budget", description: "Partidas, gastos y resumen financiero", isProjectRoute: true }
];

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const params = useSearchParams();
  const dashboardContext = useMemo(() => getContextFromSearchParams(params), [params]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(dashboardContext.projectId ?? "");
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTemplate, setNewProjectTemplate] = useState<ProjectTemplate>("SOFTWARE");
  const [createError, setCreateError] = useState<string | null>(null);
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [newProjectEndDate, setNewProjectEndDate] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

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
          memberIds: [],
          startDate: newProjectStartDate ? `${newProjectStartDate}T00:00:00.000Z` : undefined,
          estimatedEndDate: newProjectEndDate ? `${newProjectEndDate}T00:00:00.000Z` : undefined
        })
      });
    },
    onSuccess: async (project) => {
      setCreateError(null);
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectTemplate("SOFTWARE");
      setNewProjectStartDate("");
      setNewProjectEndDate("");
      setNewProjectModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      selectProject(project.id);
    },
    onError: (error) => {
      setCreateError(error.message);
    }
  });

  useEffect(() => {
    const fromQuery = dashboardContext.projectId ?? "";
    if (fromQuery !== selectedProjectId) {
      setSelectedProjectId(fromQuery);
    }
  }, [dashboardContext.projectId, selectedProjectId]);

  const selectedProject = useMemo(
    () => projectsQuery.data?.find((project) => project.id === selectedProjectId) ?? null,
    [projectsQuery.data, selectedProjectId]
  );

  const filteredProjects = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const needle = normalizeSearchValue(projectSearch);

    if (!needle) {
      return projects;
    }

    return projects.filter((project) => {
      const haystack = normalizeSearchValue(
        `${project.name} ${project.description ?? ""} ${project.template}`
      );
      return haystack.includes(needle);
    });
  }, [projectSearch, projectsQuery.data]);

  const selectProject = (projectId: string) => {
    const selected = projectsQuery.data?.find((project) => project.id === projectId) ?? null;
    setSelectedProjectId(projectId);
    const next = withDashboardContext("/projects", {
      projectId,
      projectName: selected?.name ?? null,
      teamId: dashboardContext.teamId ?? null
    });
    router.push(next as Route);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <h1 className="sr-only">Proyectos</h1>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-mid">Mis proyectos</p>
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

        {projectsQuery.isLoading ? <p className="text-sm text-mid">Cargando proyectos...</p> : null}
        {projectsQuery.error ? <p className="text-sm text-urgent">{projectsQuery.error.message}</p> : null}

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-mid">Buscar proyecto</span>
          <input
            type="text"
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
            placeholder="Nombre, descripción o plantilla"
            className="h-10 w-full rounded-xl border border-line px-3 text-sm"
          />
        </label>

        <ul className="space-y-2">
          {filteredProjects.map((project) => {
            const selected = project.id === selectedProjectId;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => selectProject(project.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left ${
                    selected
                      ? "border-line bg-ink text-white"
                      : "border-line bg-white text-ink hover:bg-line"
                  }`}
                >
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className={`text-xs ${selected ? "text-faint" : "text-mid"}`}>
                    {project.template} ·{" "}
                    {new Date(project.createdAt).toLocaleDateString("es-ES", { dateStyle: "medium" })}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
        {!projectsQuery.isLoading && !projectsQuery.error && filteredProjects.length === 0 ? (
          <p className="rounded-xl border border-line bg-line px-3 py-2 text-sm text-mid">
            No se encontraron proyectos con ese criterio.
          </p>
        ) : null}
      </Card>

      {selectedProject ? (
        <Card className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">{selectedProject.name}</p>
            <p className="text-sm text-mid">{selectedProject.description || "Sin descripción"}</p>
            {selectedProject.startDate || selectedProject.estimatedEndDate ? (
              <p className="text-xs text-mid">
                {selectedProject.startDate
                  ? `Inicio: ${new Date(selectedProject.startDate).toLocaleDateString("es-ES", { dateStyle: "medium" })}`
                  : null}
                {selectedProject.startDate && selectedProject.estimatedEndDate ? " · " : null}
                {selectedProject.estimatedEndDate
                  ? `Fin estimado: ${new Date(selectedProject.estimatedEndDate).toLocaleDateString("es-ES", { dateStyle: "medium" })}`
                  : null}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resourceCards.map((resource) => {
              const href = "isProjectRoute" in resource && resource.isProjectRoute
                ? `/projects/${selectedProject.id}${resource.href}`
                : withDashboardContext(resource.href, {
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    teamId: dashboardContext.teamId ?? null
                  });
              return (
                <Link
                  key={resource.href}
                  href={href as Route}
                  className="rounded-xl border border-line bg-white p-3 hover:bg-line"
                >
                  <p className="text-sm font-semibold text-ink">{resource.label}</p>
                  <p className="text-xs text-mid">{resource.description}</p>
                </Link>
              );
            })}
          </div>

          <div>
            <Link
              href={`/projects/${selectedProject.id}/settings` as Route}
              className="rounded-lg border border-line px-3 py-1 text-xs text-ink hover:bg-line"
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
            <span className="text-xs font-medium uppercase tracking-wide text-mid">Nombre</span>
            <input
              className="h-10 w-full rounded-xl border border-line px-3 text-sm"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Ej. Plataforma de Soporte"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-mid">Plantilla</span>
            <select
              className="h-10 w-full rounded-xl border border-line px-3 text-sm"
              value={newProjectTemplate}
              onChange={(event) => setNewProjectTemplate(event.target.value as ProjectTemplate)}
            >
              <option value="SOFTWARE">SOFTWARE</option>
              <option value="CONTENIDO">CONTENIDO</option>
              <option value="OPERACIONES">OPERACIONES</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-mid">Fecha inicio (opcional)</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                value={newProjectStartDate}
                onChange={(event) => setNewProjectStartDate(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-mid">Fin estimado (opcional)</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                value={newProjectEndDate}
                onChange={(event) => setNewProjectEndDate(event.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-mid">
              Descripción (opcional)
            </span>
            <textarea
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              rows={3}
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              placeholder="Objetivo y alcance del proyecto"
            />
          </label>

          {createError ? (
            <p className="rounded-lg border border-urgent/30 bg-urgent-muted px-3 py-2 text-sm text-urgent">
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
