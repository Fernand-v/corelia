"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useFrontendSettings } from "@/lib/frontend-settings";

type DirectoryProfile = {
  userId: string;
  fullName: string;
  activeRole: string;
  presence?: "EN_LINEA" | "DESCONECTADO" | "EN_REUNION";
  teamName: string | null;
  contact: {
    email: string;
    phone?: string;
  };
};

const presenceLabel: Record<NonNullable<DirectoryProfile["presence"]>, string> = {
  EN_LINEA: "En línea",
  DESCONECTADO: "Desconectado",
  EN_REUNION: "En reunión"
};

const presenceTone: Record<NonNullable<DirectoryProfile["presence"]>, string> = {
  EN_LINEA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DESCONECTADO: "border-slate-200 bg-slate-50 text-slate-700",
  EN_REUNION: "border-amber-200 bg-amber-50 text-amber-700"
};

export default function DirectoryPage() {
  const { settings: frontendSettings } = useFrontendSettings();
  const query = useQuery({
    queryKey: ["directory"],
    queryFn: () => apiRequest<DirectoryProfile[]>("/identity/directory")
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Directorio</h1>
        <p className="text-sm text-slate-600">
          Personas y equipos dentro de {frontendSettings.organizationName}
        </p>
      </header>

      <Card className="space-y-3">
        {query.isLoading ? <p className="text-sm text-slate-600">Cargando directorio...</p> : null}
        {query.error ? <p className="text-sm text-red-600">{query.error.message}</p> : null}
        <ul className="space-y-2">
          {query.data?.map((person) => (
            <li key={person.userId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{person.fullName}</p>
                {person.presence ? (
                  <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] ${presenceTone[person.presence]}`}>
                    {presenceLabel[person.presence]}
                  </span>
                ) : null}
              </div>
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
