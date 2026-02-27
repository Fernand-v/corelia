"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SystemRole } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
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
    </main>
  );
}
