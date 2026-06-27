"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTicketInputSchema,
  type CreateTicketInput,
  type Ticket,
  type TicketCatalogItem,
  type TicketMeta
} from "@corelia/types";
import { Badge, Button, Card, Empty } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

// Clave numérica del estado "Resuelto" (catálogo estados_ticket).
const ESTADO_RESUELTO_ID = 3;

const estadoVariant = (estadoId: number) => (estadoId >= ESTADO_RESUELTO_ID ? "neutral" : "default");

const prioridadVariant = (prioridadId: number) => (prioridadId >= 3 ? "warning" : "info");

const formatDate = (value: string) =>
  new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });

export function TicketBoard() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const permissions = session.data?.permissions ?? [];
  const canManage = permissions.includes("TICKET_GESTIONAR");
  const canAssign = permissions.includes("TICKET_ASIGNAR");
  const currentUserId = session.data?.id;

  const metaQuery = useQuery({
    queryKey: ["tickets", "meta"],
    queryFn: () => apiRequest<TicketMeta>("/tickets/meta")
  });
  const estados = metaQuery.data?.estados ?? [];
  const prioridades = metaQuery.data?.prioridades ?? [];

  const listQuery = useQuery({
    queryKey: ["tickets", "list"],
    queryFn: () => apiRequest<Ticket[]>("/tickets")
  });

  const detailQuery = useQuery({
    queryKey: ["tickets", "detail", selectedId],
    queryFn: () => apiRequest<Ticket>(`/tickets/${selectedId}`),
    enabled: Boolean(selectedId)
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const createForm = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketInputSchema),
    defaultValues: { title: "", description: "", prioridadId: 2 }
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTicketInput) =>
      apiRequest<Ticket>("/tickets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      createForm.reset({ title: "", description: "", prioridadId: 2 });
      invalidate();
    }
  });

  const estadoMutation = useMutation({
    mutationFn: ({ id, estadoId }: { id: string; estadoId: number }) =>
      apiRequest<Ticket>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ estadoId }) }),
    onSuccess: invalidate
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      apiRequest<Ticket>(`/tickets/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId })
      }),
    onSuccess: invalidate
  });

  const commentForm = useForm<{ content: string }>({ defaultValues: { content: "" } });
  const commentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiRequest(`/tickets/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => {
      commentForm.reset({ content: "" });
      invalidate();
    }
  });

  const detail = detailQuery.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <section className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-ink">Tickets IT</h1>
          <p className="text-sm text-mid">Solicitudes de soporte al área de informática</p>
        </header>

        <Card className="space-y-3">
          {listQuery.isLoading ? <p className="text-sm text-mid">Cargando tickets...</p> : null}
          {listQuery.error ? (
            <p className="text-sm text-urgent">{(listQuery.error as Error).message}</p>
          ) : null}
          {listQuery.data && listQuery.data.length === 0 ? (
            <Empty title="Sin tickets" description="Crea un ticket para empezar." />
          ) : null}
          <ul className="space-y-2">
            {listQuery.data?.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                    selectedId === ticket.id
                      ? "border-ink bg-accent-muted"
                      : "border-line hover:bg-accent-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      #{ticket.code} · {ticket.title}
                    </span>
                    <Badge variant={prioridadVariant(ticket.prioridadId)}>
                      {ticket.prioridad?.nombre ?? "—"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-mid">
                    <Badge variant={estadoVariant(ticket.estadoId)}>
                      {ticket.estado?.nombre ?? "—"}
                    </Badge>
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <aside className="space-y-6">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Nuevo ticket</h2>
          <form
            className="space-y-2"
            onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
          >
            <input
              className="h-10 w-full rounded-xl border border-line px-3 text-sm"
              placeholder="Título"
              {...createForm.register("title")}
            />
            {createForm.formState.errors.title ? (
              <p className="text-xs text-urgent">{createForm.formState.errors.title.message}</p>
            ) : null}
            <textarea
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Describe el problema"
              rows={4}
              {...createForm.register("description")}
            />
            <select
              className="h-10 w-full rounded-xl border border-line px-3 text-sm"
              {...createForm.register("prioridadId", { valueAsNumber: true })}
            >
              {prioridades.map((prioridad: TicketCatalogItem) => (
                <option key={prioridad.id} value={prioridad.id}>
                  {prioridad.nombre}
                </option>
              ))}
            </select>
            {createMutation.error ? (
              <p className="text-xs text-urgent">{(createMutation.error as Error).message}</p>
            ) : null}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Crear ticket"}
            </Button>
          </form>
        </Card>

        {selectedId ? (
          <Card className="space-y-3">
            {detailQuery.isLoading ? <p className="text-sm text-mid">Cargando...</p> : null}
            {detail ? (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    #{detail.code} · {detail.title}
                  </h2>
                  {detail.description ? (
                    <p className="mt-1 text-sm text-mid">{detail.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-mid">
                    Creado por {detail.createdByName ?? "—"} · {formatDate(detail.createdAt)}
                  </p>
                  <p className="text-xs text-mid">
                    Asignado a {detail.assigneeName ?? "Sin asignar"}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {estados.map((estado: TicketCatalogItem) => (
                      <Button
                        key={estado.id}
                        variant={estado.id === detail.estadoId ? "primary" : "secondary"}
                        className="h-8 px-3 text-xs"
                        disabled={estado.id === detail.estadoId || estadoMutation.isPending}
                        onClick={() => estadoMutation.mutate({ id: detail.id, estadoId: estado.id })}
                      >
                        {estado.nombre}
                      </Button>
                    ))}
                  </div>
                ) : null}

                {canAssign ? (
                  <div className="flex gap-2">
                    {detail.assigneeId === currentUserId ? (
                      <Button
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        disabled={assignMutation.isPending}
                        onClick={() => assignMutation.mutate({ id: detail.id, assigneeId: null })}
                      >
                        Liberar
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        disabled={assignMutation.isPending || !currentUserId}
                        onClick={() =>
                          assignMutation.mutate({ id: detail.id, assigneeId: currentUserId ?? null })
                        }
                      >
                        Tomar ticket
                      </Button>
                    )}
                  </div>
                ) : null}

                <div className="space-y-2 border-t border-line pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-mid">
                    Comentarios
                  </h3>
                  <ul className="space-y-2">
                    {detail.comments?.map((comment) => (
                      <li key={comment.id} className="rounded-xl border border-line px-3 py-2">
                        <p className="text-sm text-ink">{comment.content}</p>
                        <p className="mt-1 text-xs text-mid">
                          {comment.authorName ?? "—"} · {formatDate(comment.createdAt)}
                        </p>
                      </li>
                    ))}
                    {detail.comments && detail.comments.length === 0 ? (
                      <li className="text-xs text-mid">Sin comentarios todavía.</li>
                    ) : null}
                  </ul>
                  <form
                    className="space-y-2"
                    onSubmit={commentForm.handleSubmit((values) => {
                      if (!values.content.trim()) return;
                      commentMutation.mutate({ id: detail.id, content: values.content });
                    })}
                  >
                    <textarea
                      className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                      placeholder="Escribe un comentario"
                      rows={3}
                      {...commentForm.register("content")}
                    />
                    <Button type="submit" disabled={commentMutation.isPending}>
                      {commentMutation.isPending ? "Enviando..." : "Comentar"}
                    </Button>
                  </form>
                </div>
              </>
            ) : null}
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
