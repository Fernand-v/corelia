"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SystemRole } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { UiModal } from "@/components/ui-modal";
import { apiRequest } from "@/lib/api";

type ProjectMembersResponse = {
  projectId: string;
  projectName: string;
  members: Array<{
    userId: string;
    fullName: string;
    email: string;
    role: SystemRole;
    joinedAt: string;
  }>;
};

type DirectoryProfile = {
  userId: string;
  fullName: string;
  activeRole: SystemRole;
  teamName: string | null;
  contact: {
    email: string;
    phone?: string;
  };
};

type IdentityTeamsResponse = {
  items: Array<{
    id: string;
    name: string;
  }>;
  total: number;
};

type LinkedTeamsResponse = {
  projectId: string;
  items: Array<{
    teamId: string;
    teamName: string;
    linkedAt: string;
    totalTeamMembers: number;
    syncedMembers: number;
  }>;
};

const roleOptions: SystemRole[] = [
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR",
  "INVITADO_EXTERNO"
];

export default function ProjectSettingsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<SystemRole>("COLABORADOR");
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamLinkError, setTeamLinkError] = useState<string | null>(null);

  const projectId = params.id;

  const membersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => apiRequest<ProjectMembersResponse>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId)
  });

  const directoryQuery = useQuery({
    queryKey: ["directory"],
    queryFn: () => apiRequest<DirectoryProfile[]>("/identity/directory")
  });

  const teamsQuery = useQuery({
    queryKey: ["identity-teams-for-project-settings"],
    queryFn: () => apiRequest<IdentityTeamsResponse>("/identity/teams"),
    enabled: Boolean(projectId)
  });

  const linkedTeamsQuery = useQuery({
    queryKey: ["project-linked-teams", projectId],
    queryFn: () => apiRequest<LinkedTeamsResponse>(`/projects/${projectId}/teams`),
    enabled: Boolean(projectId)
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole
        })
      }),
    onSuccess: async () => {
      setSelectedUserId("");
      setSelectedRole("COLABORADOR");
      await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/projects/${projectId}/members/${userId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });

  const linkTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      apiRequest(`/projects/${projectId}/teams`, {
        method: "POST",
        body: JSON.stringify({ teamId })
      }),
    onSuccess: async () => {
      setSelectedTeamId("");
      setTeamLinkError(null);
      setTeamModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-linked-teams", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-members", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      ]);
    },
    onError: (error) => {
      setTeamLinkError(error.message);
    }
  });

  const unlinkTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      apiRequest(`/projects/${projectId}/teams/${teamId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project-linked-teams", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-members", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      ]);
    }
  });

  const memberIds = new Set((membersQuery.data?.members ?? []).map((member) => member.userId));

  const candidateUsers = useMemo(() => {
    const users = directoryQuery.data ?? [];
    const needle = userSearch.trim().toLowerCase();

    return users.filter((user) => {
      if (memberIds.has(user.userId)) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return (
        user.fullName.toLowerCase().includes(needle) ||
        user.contact.email.toLowerCase().includes(needle)
      );
    });
  }, [directoryQuery.data, memberIds, userSearch]);

  const availableTeams = useMemo(() => {
    const linkedIds = new Set((linkedTeamsQuery.data?.items ?? []).map((item) => item.teamId));
    return (teamsQuery.data?.items ?? []).filter((team) => !linkedIds.has(team.id));
  }, [linkedTeamsQuery.data?.items, teamsQuery.data?.items]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8 md:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Configuración de Proyecto</h1>
        <p className="text-sm text-slate-600">
          Gestiona miembros y roles del proyecto desde la UI.
        </p>
      </header>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Equipo del proyecto {membersQuery.data ? `· ${membersQuery.data.projectName}` : ""}
        </h2>
        {membersQuery.isLoading ? <p className="text-sm text-slate-600">Cargando miembros...</p> : null}
        {membersQuery.error ? <p className="text-sm text-red-600">{membersQuery.error.message}</p> : null}

        <ul className="space-y-2">
          {membersQuery.data?.members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{member.fullName}</p>
                <p className="text-xs text-slate-600">
                  {member.email} · {member.role}
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                className="h-8 px-3 text-xs"
                disabled={removeMemberMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`¿Quitar a ${member.fullName} del proyecto?`)) {
                    return;
                  }
                  removeMemberMutation.mutate(member.userId);
                }}
              >
                Quitar miembro
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Equipos vinculados</h2>
          <Button
            type="button"
            className="h-8 px-3 text-xs"
            onClick={() => {
              setTeamLinkError(null);
              setSelectedTeamId(availableTeams[0]?.id ?? "");
              setTeamModalOpen(true);
            }}
          >
            Vincular equipo
          </Button>
        </div>

        {linkedTeamsQuery.isLoading ? <p className="text-sm text-slate-600">Cargando equipos vinculados...</p> : null}
        {linkedTeamsQuery.error ? <p className="text-sm text-red-600">{linkedTeamsQuery.error.message}</p> : null}
        {!linkedTeamsQuery.isLoading && !linkedTeamsQuery.error && (linkedTeamsQuery.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-600">Sin equipos vinculados por ahora.</p>
        ) : null}

        <ul className="space-y-2">
          {linkedTeamsQuery.data?.items.map((item) => (
            <li key={item.teamId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{item.teamName}</p>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-3 text-xs"
                  disabled={unlinkTeamMutation.isPending}
                  onClick={() => unlinkTeamMutation.mutate(item.teamId)}
                >
                  Desvincular
                </Button>
              </div>
              <p className="text-xs text-slate-600">
                Miembros del equipo: {item.totalTeamMembers} · Sincronizados en proyecto: {item.syncedMembers}
              </p>
              <p className="text-xs text-slate-500">
                Vinculado: {new Date(item.linkedAt).toLocaleDateString("es-ES", { dateStyle: "medium" })}
              </p>
            </li>
          ))}
        </ul>
        {unlinkTeamMutation.error ? <p className="text-sm text-red-600">{unlinkTeamMutation.error.message}</p> : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Agregar miembro</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Buscar por nombre"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
          />
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">Seleccionar usuario</option>
            {candidateUsers.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.fullName} · {user.contact.email}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as SystemRole)}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          disabled={addMemberMutation.isPending || !selectedUserId}
          onClick={() => addMemberMutation.mutate()}
        >
          {addMemberMutation.isPending ? "Agregando..." : "Agregar miembro"}
        </Button>

        {addMemberMutation.error ? <p className="text-sm text-red-600">{addMemberMutation.error.message}</p> : null}
        {removeMemberMutation.error ? <p className="text-sm text-red-600">{removeMemberMutation.error.message}</p> : null}
      </Card>

      <UiModal
        open={teamModalOpen}
        onClose={() => {
          if (!linkTeamMutation.isPending) {
            setTeamModalOpen(false);
          }
        }}
        title="Vincular equipo al proyecto"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Al vincular un equipo, sus miembros se sincronizan al proyecto como colaboradores.
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Equipo</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
            >
              <option value="">Seleccionar equipo</option>
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          {availableTeams.length === 0 ? (
            <p className="text-xs text-slate-500">No hay equipos disponibles para vincular.</p>
          ) : null}
          {teamLinkError ? <p className="text-xs text-red-600">{teamLinkError}</p> : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setTeamModalOpen(false)}
            disabled={linkTeamMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={linkTeamMutation.isPending || !selectedTeamId}
            onClick={() => {
              if (!selectedTeamId) {
                setTeamLinkError("Selecciona un equipo para continuar");
                return;
              }
              setTeamLinkError(null);
              linkTeamMutation.mutate(selectedTeamId);
            }}
          >
            {linkTeamMutation.isPending ? "Vinculando..." : "Vincular equipo"}
          </Button>
        </div>
      </UiModal>
    </main>
  );
}
