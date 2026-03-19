"use client";

import { useQuery } from "@tanstack/react-query";
import type { RequestStatus, RequestType } from "@corelia/types";
import { Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

type RequestItem = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  comment: string | null;
};

export default function RequestsPage() {
  const query = useQuery({
    queryKey: ["form-requests"],
    queryFn: () => apiRequest<RequestItem[]>("/forms/requests")
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Solicitudes</h1>
          <p className="text-sm text-slate-600">Estado de solicitudes internas y aprobaciones</p>
        </div>
      </header>

      <Card className="space-y-3">
        {query.isLoading ? <p className="text-sm text-slate-600">Cargando solicitudes...</p> : null}
        {query.error ? <p className="text-sm text-red-600">{query.error.message}</p> : null}
        <ul className="space-y-2">
          {query.data?.map((request) => (
            <li key={request.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">
                {request.type} · {request.status}
              </p>
              <p className="text-xs text-slate-600">
                {new Date(request.createdAt).toLocaleString("es-ES", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </p>
              {request.comment ? <p className="text-xs text-slate-600">{request.comment}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
