"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { buildMaskedCallRoute } from "@/lib/call-route-ref";
import { getContextFromSearchParams } from "@/lib/context";

type Meeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "PROGRAMADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
};

type CreateMeetingInput = {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  agendaText: string;
};

const formatMeetingWindow = (startsAt: string, endsAt: string) =>
  `${new Date(startsAt).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  })} - ${new Date(endsAt).toLocaleString("es-ES", {
    timeStyle: "short"
  })}`;

const meetingStatusLabel = (status: Meeting["status"]) => {
  switch (status) {
    case "PROGRAMADA":
      return "Programada";
    case "EN_CURSO":
      return "En curso";
    case "FINALIZADA":
      return "Finalizada";
    case "CANCELADA":
      return "Cancelada";
    default:
      return status;
  }
};

const meetingStatusClass = (status: Meeting["status"]) => {
  switch (status) {
    case "EN_CURSO":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PROGRAMADA":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "FINALIZADA":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "CANCELADA":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
};

export const MeetingBoard = () => {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const dashboardContext = useMemo(() => getContextFromSearchParams(params), [params]);
  const projectId = dashboardContext.projectId;
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  const form = useForm<CreateMeetingInput>({
    defaultValues: {
      title: "",
      description: "",
      startsAt: "",
      endsAt: "",
      agendaText: ""
    }
  });

  const projectMembersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () =>
      apiRequest<{
        projectName?: string;
        members: Array<{ userId: string; fullName: string }>;
      }>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId)
  });

  const meetingsQuery = useQuery({
    queryKey: ["meetings", projectId],
    queryFn: () => apiRequest<Meeting[]>(`/meetings?projectId=${encodeURIComponent(projectId!)}`),
    enabled: Boolean(projectId)
  });

  useEffect(() => {
    if (!projectMembersQuery.data) {
      setSelectedParticipantIds([]);
      return;
    }

    const availableIds = new Set(projectMembersQuery.data.members.map((member) => member.userId));
    setSelectedParticipantIds((current) => {
      const kept = current.filter((id) => availableIds.has(id));
      if (kept.length > 0) {
        return kept;
      }
      return projectMembersQuery.data.members.slice(0, 1).map((member) => member.userId);
    });
  }, [projectMembersQuery.data]);

  const createMeetingMutation = useMutation({
    mutationFn: (payload: CreateMeetingInput) =>
      apiRequest<{ meeting: Meeting; warnings: Array<{ detail: string }> }>("/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description || undefined,
          projectId: projectId || undefined,
          startsAt: new Date(payload.startsAt).toISOString(),
          endsAt: new Date(payload.endsAt).toISOString(),
          participantIds: selectedParticipantIds,
          agenda: payload.agendaText
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
        })
      }),
    onSuccess: async () => {
      form.reset({
        title: "",
        description: "",
        startsAt: "",
        endsAt: "",
        agendaText: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    }
  });

  const orderedMeetings = useMemo(
    () =>
      [...(meetingsQuery.data ?? [])].sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
      ),
    [meetingsQuery.data]
  );

  const openCallTab = (meetingId: string) => {
    const callUrl = buildMaskedCallRoute({
      meetingId,
      projectId: projectId ?? null
    });
    window.open(callUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="teams-meetings grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <Card className="teams-meetings-panel space-y-3 rounded-2xl border border-[--teams-call-border] bg-[--teams-call-panel] p-4 shadow-[var(--teams-call-shadow)]">
        <div>
          <h2 className="text-lg font-semibold text-[--teams-call-text]">Programar reunión</h2>
          <p className="mt-1 text-xs text-[--teams-call-muted]">
            Diseño de agenda con flujo rápido estilo Teams.
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((payload) => {
            createMeetingMutation.mutate(payload);
          })}
        >
          <p className="rounded-xl border border-[--teams-call-border] bg-[--teams-call-surface-2] px-3 py-2 text-xs text-[--teams-call-muted]">
            {projectMembersQuery.data?.projectName
              ? `Proyecto activo: ${projectMembersQuery.data.projectName}`
              : "Selecciona un proyecto para programar reuniones contextuales."}
          </p>

          <input
            className="teams-meetings-input"
            placeholder="Título de la reunión"
            {...form.register("title")}
          />
          <textarea
            className="teams-meetings-input min-h-[84px] py-2"
            placeholder="Descripción"
            {...form.register("description")}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="teams-meetings-input"
              type="datetime-local"
              aria-label="Fecha de inicio"
              {...form.register("startsAt")}
            />
            <input
              className="teams-meetings-input"
              type="datetime-local"
              aria-label="Fecha de fin"
              {...form.register("endsAt")}
            />
          </div>

          <div className="rounded-xl border border-[--teams-call-border] bg-[--teams-call-surface-2] p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[--teams-call-muted]">
              Participantes
            </p>
            {projectMembersQuery.isLoading ? (
              <p className="mb-2 text-xs text-[--teams-call-muted]">Cargando miembros...</p>
            ) : null}
            {projectMembersQuery.error ? (
              <p className="mb-2 text-xs text-red-600">{projectMembersQuery.error.message}</p>
            ) : null}
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {projectMembersQuery.data?.members.map((member) => (
                <label key={member.userId} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-[--teams-call-text]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[--teams-call-accent]"
                    checked={selectedParticipantIds.includes(member.userId)}
                    onChange={(event) => {
                      setSelectedParticipantIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, member.userId])]
                          : current.filter((id) => id !== member.userId)
                      );
                    }}
                  />
                  <span className="truncate">{member.fullName}</span>
                </label>
              ))}
            </div>
          </div>

          <textarea
            className="teams-meetings-input min-h-[90px] py-2"
            rows={3}
            placeholder="Agenda (una línea por punto)"
            {...form.register("agendaText")}
          />

          {createMeetingMutation.error ? (
            <p className="text-sm text-red-600">{createMeetingMutation.error.message}</p>
          ) : null}

          <Button
            className="h-10 w-full rounded-xl bg-[--teams-call-accent] text-sm text-white hover:bg-[--teams-call-accent-hover]"
            type="submit"
            disabled={createMeetingMutation.isPending || !projectId || selectedParticipantIds.length === 0}
          >
            {createMeetingMutation.isPending ? "Guardando..." : "Crear reunión"}
          </Button>
        </form>
      </Card>

      <Card className="teams-meetings-panel space-y-3 rounded-2xl border border-[--teams-call-border] bg-[--teams-call-panel] p-4 shadow-[var(--teams-call-shadow)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[--teams-call-text]">Sesiones del proyecto</h2>
            <p className="text-xs text-[--teams-call-muted]">
              El acceso a llamada abre una pestaña dedicada para videollamada.
            </p>
          </div>
          <span className="rounded-full border border-[--teams-call-border] bg-[--teams-call-surface-2] px-2 py-1 text-xs text-[--teams-call-muted]">
            {orderedMeetings.length} reunión(es)
          </span>
        </div>

        {meetingsQuery.isLoading ? <p className="text-sm text-[--teams-call-muted]">Cargando reuniones...</p> : null}
        {meetingsQuery.error ? <p className="text-sm text-red-600">{meetingsQuery.error.message}</p> : null}

        {orderedMeetings.length === 0 && !meetingsQuery.isLoading ? (
          <p className="rounded-xl border border-dashed border-[--teams-call-border] px-3 py-8 text-center text-sm text-[--teams-call-muted]">
            No hay reuniones cargadas para este proyecto.
          </p>
        ) : (
          <ul className="space-y-2">
            {orderedMeetings.map((meeting) => (
              <li
                key={meeting.id}
                className="rounded-xl border border-[--teams-call-border] bg-[--teams-call-surface-2] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[--teams-call-text]">{meeting.title}</p>
                    <p className="mt-1 text-xs text-[--teams-call-muted]">
                      {formatMeetingWindow(meeting.startsAt, meeting.endsAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-medium ${meetingStatusClass(meeting.status)}`}
                    >
                      {meetingStatusLabel(meeting.status)}
                    </span>
                    <Button
                      type="button"
                      className="h-9 rounded-xl bg-[--teams-call-accent] px-3 text-xs text-white hover:bg-[--teams-call-accent-hover]"
                      onClick={() => {
                        openCallTab(meeting.id);
                      }}
                    >
                      Entrar llamada
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
