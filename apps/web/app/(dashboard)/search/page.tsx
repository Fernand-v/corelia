"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
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
  const { settings: frontendSettings } = useFrontendSettings();

  const searchMutation = useMutation({
    mutationFn: async () => {
      const cleanQuery = query.trim();
      if (cleanQuery.length < 2) {
        throw new Error("Ingresa al menos 2 caracteres");
      }
      return apiRequest<SearchResult>(`/search?query=${encodeURIComponent(cleanQuery)}`);
    }
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Buscar</h1>
        <p className="text-sm text-slate-600">
          Búsqueda global en {frontendSettings.organizationName}
        </p>
      </header>

      <Card className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm"
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
          <p className="text-sm text-red-600">{searchMutation.error.message}</p>
        ) : null}

        {searchMutation.data
          ? sections.map((key) => (
              <div key={key} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">{sectionLabel[key]}</p>
                {searchMutation.data[key].length === 0 ? (
                  <p className="text-sm text-slate-600">Sin resultados.</p>
                ) : (
                  <ul className="space-y-2">
                    {searchMutation.data[key].map((item) => (
                      <li key={item.id} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-600">
                          {item.entity} · {item.subtitle ?? "Sin detalle"}
                        </p>
                        <p className="text-xs text-slate-500">{item.path}</p>
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
