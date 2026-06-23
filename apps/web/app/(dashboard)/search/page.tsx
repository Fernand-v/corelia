"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams } from "@/lib/context";
import { useFrontendSettings } from "@/lib/frontend-settings";

type SearchResultItem = {
  entity: "TAREA" | "PROYECTO" | "MENSAJE" | "PERSONA" | "ARCHIVO";
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
};

type SearchResult = {
  tasks: SearchResultItem[];
  projects: SearchResultItem[];
  messages: SearchResultItem[];
  people: SearchResultItem[];
  files: SearchResultItem[];
};

const sections: Array<keyof SearchResult> = ["tasks", "projects", "messages", "people", "files"];

const sectionLabel: Record<keyof SearchResult, string> = {
  tasks: "Tareas",
  projects: "Proyectos",
  messages: "Mensajes",
  people: "Personas",
  files: "Archivos"
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const dashboardContext = getContextFromSearchParams(searchParams);
  const { settings: frontendSettings } = useFrontendSettings();

  const searchMutation = useMutation({
    mutationFn: async () => {
      const cleanQuery = query.trim();
      if (cleanQuery.length < 2) {
        throw new Error("Ingresa al menos 2 caracteres");
      }
      const params = new URLSearchParams({
        query: cleanQuery
      });
      if (dashboardContext.projectId) {
        params.set("projectId", dashboardContext.projectId);
      }
      return apiRequest<SearchResult>(`/search?${params.toString()}`);
    }
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Buscar</h1>
        <p className="text-sm text-mid">
          Búsqueda global en {frontendSettings.organizationName}
        </p>
        {dashboardContext.projectId ? (
          <p className="text-xs text-mid">
            Consulta acotada al proyecto activo.
          </p>
        ) : null}
      </header>

      <Card className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="h-10 flex-1 rounded-xl border border-line px-3 text-sm"
            placeholder="Buscar tareas, proyectos, personas, mensajes..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            type="button"
            disabled={searchMutation.isPending || query.trim().length < 2}
            onClick={() => searchMutation.mutate()}
          >
            {searchMutation.isPending ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {searchMutation.error ? (
          <p className="text-sm text-urgent">{searchMutation.error.message}</p>
        ) : null}

        {searchMutation.data
          ? sections.map((key) => (
              <div key={key} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-mid">{sectionLabel[key]}</p>
                {searchMutation.data[key].length === 0 ? (
                  <p className="text-sm text-mid">Sin resultados.</p>
                ) : (
                  <ul className="space-y-2">
                    {searchMutation.data[key].map((item) => (
                      <li key={item.id} className="rounded-xl border border-line p-3">
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="text-xs text-mid">
                          {item.entity} · {item.subtitle ?? "Sin detalle"}
                        </p>
                        <p className="text-xs text-mid">{item.path}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          : null}
      </Card>
    </main>
  );
}
