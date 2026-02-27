"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SystemRole } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

type AdminUsersResponse = {
  items: Array<{
    id: string;
    fullName: string;
    email: string;
    role: SystemRole;
  }>;
  total: number;
};

type TeamListItem = {
  id: string;
  name: string;
  description: string | null;
  coordinator: {
    userId: string;
    fullName: string;
  } | null;
  membersCount: number;
  activeProjects: number;
};

type AdminTeamsResponse = {
  items: TeamListItem[];
  total: number;
};

type TeamDetail = {
  id: string;
  name: string;
  description: string | null;
  coordinatorUserId: string | null;
  activeProjects: number;
  members: Array<{
    userId: string;
    fullName: string;
    email: string;
    baseRole: SystemRole;
  }>;
};

export const AdminTeamsView = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    coordinatorUserId: "",
    memberIds: [] as string[]
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users-for-teams"],
    queryFn: () => apiRequest<AdminUsersResponse>("/admin/users")
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => apiRequest<AdminTeamsResponse>("/admin/teams")
  });

  const selectedTeamQuery = useQuery({
    queryKey: ["admin-team-detail", selectedTeamId],
    queryFn: () => apiRequest<TeamDetail>(`/admin/teams/${selectedTeamId}`),
    enabled: Boolean(selectedTeamId)
  });

  const createTeamMutation = useMutation({
    mutationFn: () =>
      apiRequest("/admin/teams", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          coordinatorUserId: form.coordinatorUserId || undefined,
          memberIds: form.memberIds
        })
      }),
    onSuccess: async () => {
      setForm({
        name: "",
        description: "",
        coordinatorUserId: "",
        memberIds: []
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    }
  });

  const updateTeamMutation = useMutation({
    mutationFn: (input: { teamId: string; payload: Record<string, unknown> }) =>
      apiRequest(`/admin/teams/${input.teamId}`, {
        method: "PATCH",
        body: JSON.stringify(input.payload)
      }),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-team-detail", input.teamId] });
    }
  });

  const dissolveTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      apiRequest(`/admin/teams/${teamId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      if (selectedTeamId) {
        setSelectedTeamId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    }
  });

  const userOptions = usersQuery.data?.items ?? [];
  const filteredUsers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) {
      return userOptions;
    }
    return userOptions.filter((user) => {
      return (
        user.fullName.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle)
      );
    });
  }, [memberSearch, userOptions]);

  const resetForm = () => {
    setEditingTeamId(null);
    setForm({
      name: "",
      description: "",
      coordinatorUserId: "",
      memberIds: []
    });
  };

  const loadTeamForEdit = async (teamId: string) => {
    const detail = await queryClient.fetchQuery({
      queryKey: ["admin-team-detail", teamId],
      queryFn: () => apiRequest<TeamDetail>(`/admin/teams/${teamId}`)
    });

    setEditingTeamId(teamId);
    setForm({
      name: detail.name,
      description: detail.description ?? "",
      coordinatorUserId: detail.coordinatorUserId ?? "",
      memberIds: detail.members.map((member) => member.userId)
    });
  };

  if (session.isLoading || !session.data) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Cargando sesión...</p>
      </Card>
    );
  }

  if (session.data.activeRole !== "ADMINISTRADOR") {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Acceso restringido</h2>
        <p className="text-sm text-slate-600">Solo administradores pueden gestionar equipos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingTeamId ? "Editar equipo" : "Crear equipo"}
        </h2>

        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Nombre del equipo"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                name: event.target.value
              }))
            }
          />
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value
              }))
            }
          />
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={form.coordinatorUserId}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                coordinatorUserId: event.target.value
              }))
            }
          >
            <option value="">Sin coordinador</option>
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Buscar miembros"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
          />
        </div>

        <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {filteredUsers.map((user) => {
            const checked = form.memberIds.includes(user.id);
            return (
              <label key={user.id} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                <span>
                  {user.fullName} · {user.email}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      memberIds: event.target.checked
                        ? [...new Set([...prev.memberIds, user.id])]
                        : prev.memberIds.filter((id) => id !== user.id)
                    }))
                  }
                />
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              !form.name.trim() ||
              createTeamMutation.isPending ||
              updateTeamMutation.isPending
            }
            onClick={() => {
              if (editingTeamId) {
                updateTeamMutation.mutate({
                  teamId: editingTeamId,
                  payload: {
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    coordinatorUserId: form.coordinatorUserId || null,
                    memberIds: form.memberIds
                  }
                });
                return;
              }

              createTeamMutation.mutate();
            }}
          >
            {editingTeamId
              ? updateTeamMutation.isPending
                ? "Guardando..."
                : "Guardar cambios"
              : createTeamMutation.isPending
                ? "Creando..."
                : "Crear equipo"}
          </Button>
          {editingTeamId ? (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar edición
            </Button>
          ) : null}
        </div>

        {createTeamMutation.error ? <p className="text-sm text-red-600">{createTeamMutation.error.message}</p> : null}
        {updateTeamMutation.error ? <p className="text-sm text-red-600">{updateTeamMutation.error.message}</p> : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Equipos</h2>
        {teamsQuery.isLoading ? <p className="text-sm text-slate-600">Cargando equipos...</p> : null}
        {teamsQuery.error ? <p className="text-sm text-red-600">{teamsQuery.error.message}</p> : null}

        <ul className="space-y-2">
          {teamsQuery.data?.items.map((team) => (
            <li key={team.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{team.name}</p>
                  <p className="text-xs text-slate-600">
                    Coordinador: {team.coordinator?.fullName ?? "No asignado"} · Miembros:{" "}
                    {team.membersCount} · Proyectos activos: {team.activeProjects}
                  </p>
                  {team.description ? <p className="text-xs text-slate-600">{team.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => loadTeamForEdit(team.id)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() =>
                      setSelectedTeamId((current) => (current === team.id ? null : team.id))
                    }
                  >
                    Ver miembros
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="h-8 px-3 text-xs"
                    disabled={dissolveTeamMutation.isPending || team.activeProjects > 0}
                    onClick={() => {
                      if (team.activeProjects > 0) {
                        return;
                      }
                      if (!window.confirm(`¿Disolver el equipo ${team.name}?`)) {
                        return;
                      }
                      dissolveTeamMutation.mutate(team.id);
                    }}
                  >
                    Disolver equipo
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {selectedTeamId ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Miembros del equipo</h2>
          {selectedTeamQuery.isLoading ? <p className="text-sm text-slate-600">Cargando miembros...</p> : null}
          {selectedTeamQuery.error ? <p className="text-sm text-red-600">{selectedTeamQuery.error.message}</p> : null}

          {selectedTeamQuery.data ? (
            <ul className="space-y-2">
              {selectedTeamQuery.data.members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.fullName}</p>
                    <p className="text-xs text-slate-600">
                      {member.email} · {member.baseRole}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    className="h-8 px-3 text-xs"
                    disabled={updateTeamMutation.isPending}
                    onClick={() => {
                      if (!window.confirm(`¿Quitar a ${member.fullName} del equipo?`)) {
                        return;
                      }
                      updateTeamMutation.mutate({
                        teamId: selectedTeamQuery.data!.id,
                        payload: {
                          memberIds: selectedTeamQuery.data!.members
                            .map((item) => item.userId)
                            .filter((id) => id !== member.userId),
                          coordinatorUserId:
                            selectedTeamQuery.data!.coordinatorUserId === member.userId
                              ? null
                              : selectedTeamQuery.data!.coordinatorUserId
                        }
                      });
                    }}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};
