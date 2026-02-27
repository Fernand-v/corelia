"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

type DirectoryProfile = {
  userId: string;
  fullName: string;
  activeRole: string;
  teamName: string | null;
  contact: {
    email: string;
    phone?: string;
  };
};

export default function DirectoryPage() {
  const query = useQuery({
    queryKey: ["directory"],
    queryFn: () => apiRequest<DirectoryProfile[]>("/identity/directory")
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Directorio</h1>
        <p className="text-sm text-slate-600">Personas y equipos dentro de Corelia</p>
      </header>

      <Card className="space-y-3">
        {query.isLoading ? <p className="text-sm text-slate-600">Cargando directorio...</p> : null}
        {query.error ? <p className="text-sm text-red-600">{query.error.message}</p> : null}
        <ul className="space-y-2">
          {query.data?.map((person) => (
            <li key={person.userId} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">{person.fullName}</p>
              <p className="text-xs text-slate-600">
                {person.activeRole} · {person.teamName ?? "Sin equipo"}
              </p>
              <p className="text-xs text-slate-600">{person.contact.email}</p>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
