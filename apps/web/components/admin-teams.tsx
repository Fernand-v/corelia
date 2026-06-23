"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleCode } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { UiModal } from "@/components/ui-modal";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

type AdminUsersResponse = {
  items: Array<{
    id: string;
    fullName: string;
    email: string;
    role: RoleCode;
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
    baseRole: RoleCode;
  }>;
};

type MemberRemovalTarget = {
  teamId: string;
  memberId: string;
  memberName: string;
};

export const AdminTeamsView = () => {
  const session = useSession();
  const queryClient = useQueryClient();

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRemovalTarget, setMemberRemovalTarget] = useState<MemberRemovalTarget | null>(null);
  const [dissolveTarget, setDissolveTarget] = useState<{ id: string; name: string } | null>(null);
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
    enabled: Boolean(selectedTeamId && membersModalOpen)
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
      closeTeamModal();
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
      if (editingTeamId) {
        closeTeamModal();
      }
    }
  });

  const dissolveTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      apiRequest(`/admin/teams/${teamId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      setDissolveTarget(null);
      closeMembersModal();
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    }
  });

  const userOptions = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
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
    setMemberSearch("");
    setForm({
      name: "",
      description: "",
      coordinatorUserId: "",
      memberIds: []
    });
  };

  const closeTeamModal = () => {
    if (createTeamMutation.isPending || updateTeamMutation.isPending) {
      return;
    }
    setTeamModalOpen(false);
    resetForm();
  };

  const closeMembersModal = () => {
    setMembersModalOpen(false);
    setSelectedTeamId(null);
    setMemberRemovalTarget(null);
  };

  const openCreateTeamModal = () => {
    resetForm();
    setTeamModalOpen(true);
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
    setMemberSearch("");
    setTeamModalOpen(true);
  };

  const openMembersModal = (teamId: string) => {
    setSelectedTeamId(teamId);
    setMembersModalOpen(true);
  };

  if (session.isLoading || !session.data) {
    return (
      <Card>
        <p className="text-sm text-mid">Cargando sesión...</p>
      </Card>
    );
  }

  if (session.data.activeRole !== "ADMINISTRADOR") {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink">Acceso restringido</h2>
        <p className="text-sm text-mid">Solo administradores pueden gestionar equipos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mid">Equipos</p>
          <Button type="button" className="h-9 px-3 text-xs" onClick={openCreateTeamModal}>
            Nuevo equipo
          </Button>
        </div>

        {teamsQuery.isLoading ? <p className="text-sm text-mid">Cargando equipos...</p> : null}
        {teamsQuery.error ? <p className="text-sm text-urgent">{teamsQuery.error.message}</p> : null}

        <ul className="space-y-2">
          {teamsQuery.data?.items.map((team) => (
            <li key={team.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{team.name}</p>
                  <p className="text-xs text-mid">
                    Coordinador: {team.coordinator?.fullName ?? "No asignado"} · Miembros:{" "}
                    {team.membersCount} · Proyectos activos: {team.activeProjects}
                  </p>
                  {team.description ? <p className="text-xs text-mid">{team.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={() => loadTeamForEdit(team.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => openMembersModal(team.id)}
                  >
                    Ver miembros
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="h-8 px-3 text-xs"
                    disabled={team.activeProjects > 0}
                    onClick={() => setDissolveTarget({ id: team.id, name: team.name })}
                  >
                    Disolver equipo
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <UiModal
        open={teamModalOpen}
        onClose={closeTeamModal}
        title={editingTeamId ? "Editar equipo" : "Nuevo equipo"}
        widthClassName="max-w-3xl"
      >
        <form
          id="team-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) {
              return;
            }

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
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="h-10 rounded-xl border border-line px-3 text-sm"
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
              className="h-10 rounded-xl border border-line px-3 text-sm"
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
              className="h-10 rounded-xl border border-line px-3 text-sm"
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
              className="h-10 rounded-xl border border-line px-3 text-sm"
              placeholder="Buscar miembros"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line p-3">
            {filteredUsers.map((user) => {
              const checked = form.memberIds.includes(user.id);
              return (
                <label
                  key={user.id}
                  className="flex items-center justify-between gap-2 text-sm text-ink"
                >
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

          {createTeamMutation.error ? (
            <p className="text-sm text-urgent">{createTeamMutation.error.message}</p>
          ) : null}
          {updateTeamMutation.error ? (
            <p className="text-sm text-urgent">{updateTeamMutation.error.message}</p>
          ) : null}
        </form>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={closeTeamModal}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="team-form"
            disabled={
              !form.name.trim() || createTeamMutation.isPending || updateTeamMutation.isPending
            }
          >
            {editingTeamId
              ? updateTeamMutation.isPending
                ? "Guardando..."
                : "Guardar cambios"
              : createTeamMutation.isPending
                ? "Creando..."
                : "Crear equipo"}
          </Button>
        </div>
      </UiModal>

      <UiModal
        open={membersModalOpen}
        onClose={closeMembersModal}
        title="Miembros del equipo"
        widthClassName="max-w-2xl"
      >
        {selectedTeamQuery.isLoading ? <p className="text-sm text-mid">Cargando miembros...</p> : null}
        {selectedTeamQuery.error ? <p className="text-sm text-urgent">{selectedTeamQuery.error.message}</p> : null}

        {selectedTeamQuery.data ? (
          <ul className="space-y-2">
            {selectedTeamQuery.data.members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between rounded-xl border border-line p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{member.fullName}</p>
                  <p className="text-xs text-mid">
                    {member.email} · {member.baseRole}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-3 text-xs"
                  disabled={updateTeamMutation.isPending}
                  onClick={() =>
                    setMemberRemovalTarget({
                      teamId: selectedTeamQuery.data!.id,
                      memberId: member.userId,
                      memberName: member.fullName
                    })
                  }
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </UiModal>

      <UiModal
        open={Boolean(memberRemovalTarget)}
        onClose={() => setMemberRemovalTarget(null)}
        title="Quitar miembro"
      >
        <p className="text-sm text-ink">
          ¿Confirmas quitar a {memberRemovalTarget?.memberName} del equipo?
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setMemberRemovalTarget(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={updateTeamMutation.isPending || !memberRemovalTarget || !selectedTeamQuery.data}
            onClick={() => {
              if (!memberRemovalTarget || !selectedTeamQuery.data) {
                return;
              }
              updateTeamMutation.mutate({
                teamId: memberRemovalTarget.teamId,
                payload: {
                  memberIds: selectedTeamQuery.data.members
                    .map((item) => item.userId)
                    .filter((id) => id !== memberRemovalTarget.memberId),
                  coordinatorUserId:
                    selectedTeamQuery.data.coordinatorUserId === memberRemovalTarget.memberId
                      ? null
                      : selectedTeamQuery.data.coordinatorUserId
                }
              });
              setMemberRemovalTarget(null);
            }}
          >
            {updateTeamMutation.isPending ? "Quitando..." : "Quitar"}
          </Button>
        </div>
      </UiModal>

      <UiModal
        open={Boolean(dissolveTarget)}
        onClose={() => setDissolveTarget(null)}
        title="Disolver equipo"
      >
        <p className="text-sm text-ink">
          ¿Confirmas disolver el equipo {dissolveTarget?.name}? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDissolveTarget(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={dissolveTeamMutation.isPending || !dissolveTarget}
            onClick={() => {
              if (!dissolveTarget) {
                return;
              }
              dissolveTeamMutation.mutate(dissolveTarget.id);
            }}
          >
            {dissolveTeamMutation.isPending ? "Disolviendo..." : "Disolver"}
          </Button>
        </div>
      </UiModal>
    </div>
  );
};
