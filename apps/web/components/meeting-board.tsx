"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";

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

export const MeetingBoard = () => {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const projectId = params.get("projectId");
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

  const openCallTab = (meetingId: string) => {
    const query = new URLSearchParams({
      meetingId,
      ...(projectId ? { projectId } : {})
    });
    window.open(`/call?${query.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Programar reunión</h2>
        <form
          className="space-y-2"
          onSubmit={form.handleSubmit((payload) => {
            createMeetingMutation.mutate(payload);
          })}
        >
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {projectMembersQuery.data?.projectName
              ? `Proyecto activo: ${projectMembersQuery.data.projectName}`
              : "Selecciona un proyecto para programar reuniones contextuales."}
          </p>
          <input className="h-10 w-full rounded-xl border px-3 text-sm" placeholder="Título" {...form.register("title")} />
          <textarea className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Descripción" {...form.register("description")} />
          <input className="h-10 w-full rounded-xl border px-3 text-sm" type="datetime-local" {...form.register("startsAt")} />
          <input className="h-10 w-full rounded-xl border px-3 text-sm" type="datetime-local" {...form.register("endsAt")} />

          <div className="space-y-2 rounded-xl border border-slate-200 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Participantes</p>
            {projectMembersQuery.isLoading ? (
              <p className="text-xs text-slate-600">Cargando miembros...</p>
            ) : null}
            {projectMembersQuery.error ? (
              <p className="text-xs text-red-600">{projectMembersQuery.error.message}</p>
            ) : null}
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {projectMembersQuery.data?.members.map((member) => (
                <label key={member.userId} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedParticipantIds.includes(member.userId)}
                    onChange={(event) => {
                      setSelectedParticipantIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, member.userId])]
                          : current.filter((id) => id !== member.userId)
                      );
                    }}
                  />
                  {member.fullName}
                </label>
              ))}
            </div>
          </div>

          <textarea
            className="w-full rounded-xl border px-3 py-2 text-sm"
            rows={3}
            placeholder="Agenda (una línea por punto)"
            {...form.register("agendaText")}
          />

          {createMeetingMutation.error ? (
            <p className="text-sm text-red-600">{createMeetingMutation.error.message}</p>
          ) : null}

          <Button
            className="w-full"
            type="submit"
            disabled={createMeetingMutation.isPending || !projectId || selectedParticipantIds.length === 0}
          >
            {createMeetingMutation.isPending ? "Guardando..." : "Crear reunión"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Reuniones del proyecto</h2>
        <p className="text-xs text-slate-500">
          Al entrar a llamada se abre una nueva pestaña dedicada.
        </p>
        {meetingsQuery.isLoading ? <p className="text-sm text-slate-500">Cargando...</p> : null}
        {meetingsQuery.error ? <p className="text-sm text-red-600">{meetingsQuery.error.message}</p> : null}
        <ul className="space-y-2">
          {meetingsQuery.data?.map((meeting) => (
            <li key={meeting.id} className="rounded-xl border border-slate-200 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                  <p className="text-xs text-slate-500">
                    {meeting.status} · {formatMeetingWindow(meeting.startsAt, meeting.endsAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    openCallTab(meeting.id);
                  }}
                >
                  Entrar llamada
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
