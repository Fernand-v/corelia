"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminOverview, SystemRole } from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import type { Route } from "next";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

type AdminUsersResponse = {
  items: Array<{
    id: string;
    fullName: string;
    email: string;
    role: SystemRole;
    teamId: string | null;
    teamName: string | null;
    state: "ACTIVO" | "INACTIVO" | "ONBOARDING" | "OFFBOARDING";
    createdAt: string;
    deactivatedAt: string | null;
  }>;
  total: number;
};

type AdminTeamsResponse = {
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    coordinator: {
      userId: string;
      fullName: string;
    } | null;
    membersCount: number;
  }>;
  total: number;
};

type AdminInvitesResponse = {
  items: Array<{
    id: string;
    email: string;
    resourceType: "PROYECTO" | "ARCHIVO" | "DOCUMENTO";
    resourceId: string;
    expiresAt: string;
    revokedAt: string | null;
    acceptedAt: string | null;
    createdAt: string;
    createdByName: string | null;
  }>;
  total: number;
};

type AdminInternalInvitesResponse = {
  items: Array<{
    id: string;
    email: string;
    baseRole: SystemRole;
    teamId: string | null;
    teamName: string | null;
    expiresAt: string;
    revokedAt: string | null;
    acceptedAt: string | null;
    createdAt: string;
    resentAt: string | null;
    createdByName: string | null;
  }>;
  total: number;
};

type RolesMatrixItem = {
  role: SystemRole;
  permissions: string[];
};

type AccessItem = {
  userId: string;
  fullName: string;
  email: string;
  accessLevel: string;
};

type OffboardingPreview = {
  userId: string;
  activeTasks: Array<{ id: string; title: string; projectId: string; projectName: string }>;
  leadershipProjects: Array<{ projectId: string; projectName: string; role: SystemRole }>;
  ownedDocuments: Array<{ fileId: string; originalName: string }>;
};

type OffboardingTransfersState = {
  tasks: Record<string, string>;
  leadership: Record<string, string>;
  documents: Record<string, string>;
};

const ROLE_OPTIONS: SystemRole[] = [
  "COLABORADOR",
  "COORDINADOR_EQUIPO",
  "LIDER_PROYECTO",
  "OBSERVADOR",
  "INVITADO_EXTERNO",
  "ADMINISTRADOR"
];

const USER_STATE_OPTIONS: Array<AdminUsersResponse["items"][number]["state"]> = [
  "ACTIVO",
  "INACTIVO",
  "ONBOARDING",
  "OFFBOARDING"
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const statusTone = (state: string) => {
  if (state === "OFFBOARDING" || state === "INACTIVO") {
    return "text-red-700 bg-red-50 border-red-200";
  }
  if (state === "ONBOARDING") {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

export const AdminPanelView = () => {
  const session = useSession();
  const queryClient = useQueryClient();

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<SystemRole | "">("");
  const [userStateFilter, setUserStateFilter] = useState<
    AdminUsersResponse["items"][number]["state"] | ""
  >("");

  const [createUserForm, setCreateUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    baseRole: "COLABORADOR" as SystemRole,
    teamId: "",
    startOnboarding: true
  });

  const [createTeamForm, setCreateTeamForm] = useState({
    name: "",
    description: "",
    coordinatorUserId: ""
  });

  const [inviteForm, setInviteForm] = useState({
    email: "",
    resourceType: "PROYECTO" as "PROYECTO" | "ARCHIVO" | "DOCUMENTO",
    resourceId: "",
    expiresAt: ""
  });

  const [externalInviteLinkPreview, setExternalInviteLinkPreview] = useState<string | null>(null);

  const [internalInviteForm, setInternalInviteForm] = useState({
    email: "",
    baseRole: "COLABORADOR" as SystemRole,
    teamId: "",
    expiresAt: ""
  });

  const [internalInviteLinkPreview, setInternalInviteLinkPreview] = useState<string | null>(null);

  const [offboardingForm, setOffboardingForm] = useState({
    userId: "",
    primaryTransferToUserId: "",
    reason: ""
  });

  const [offboardingTransfers, setOffboardingTransfers] = useState<OffboardingTransfersState>({
    tasks: {},
    leadership: {},
    documents: {}
  });
  const [adminPasswordResetFeedback, setAdminPasswordResetFeedback] = useState<string | null>(null);

  const [accessLookupForm, setAccessLookupForm] = useState({
    type: "PROYECTO" as "PROYECTO" | "EQUIPO" | "ARCHIVO" | "DOCUMENTO",
    id: ""
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", userSearch, userRoleFilter, userStateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userSearch.trim()) {
        params.set("search", userSearch.trim());
      }
      if (userRoleFilter) {
        params.set("role", userRoleFilter);
      }
      if (userStateFilter) {
        params.set("state", userStateFilter);
      }
      return apiRequest<AdminUsersResponse>(`/admin/users?${params.toString()}`);
    }
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => apiRequest<AdminTeamsResponse>("/admin/teams")
  });

  const invitesQuery = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => apiRequest<AdminInvitesResponse>("/admin/guest-invites")
  });

  const internalInvitesQuery = useQuery({
    queryKey: ["admin-internal-invites"],
    queryFn: () => apiRequest<AdminInternalInvitesResponse>("/admin/internal-invites")
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-roles-matrix"],
    queryFn: () => apiRequest<RolesMatrixItem[]>("/admin/roles-matrix")
  });

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiRequest<AdminOverview>("/admin/overview?page=1&pageSize=10")
  });

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiRequest<{
        id: string;
        email: string;
      }>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          firstName: createUserForm.firstName,
          lastName: createUserForm.lastName,
          email: createUserForm.email,
          baseRole: createUserForm.baseRole,
          teamId: createUserForm.teamId || undefined,
          startOnboarding: createUserForm.startOnboarding
        })
      }),
    onSuccess: async () => {
      setCreateUserForm((prev) => ({
        ...prev,
        firstName: "",
        lastName: "",
        email: "",
        teamId: ""
      }));
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const setUserActiveMutation = useMutation({
    mutationFn: (input: { userId: string; isActive: boolean }) =>
      apiRequest(`/admin/users/${input.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: input.isActive
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const adminResetPasswordMutation = useMutation({
    mutationFn: (input: { userId: string; newPassword: string }) =>
      apiRequest<{ userId: string }>("/auth/admin-reset-password", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      setAdminPasswordResetFeedback("Contraseña restablecida correctamente.");
    }
  });

  const previewOffboardingMutation = useMutation({
    mutationFn: () =>
      apiRequest<OffboardingPreview>("/admin/offboarding/preview", {
        method: "POST",
        body: JSON.stringify({
          userId: offboardingForm.userId
        })
      }),
    onSuccess: (preview) => {
      const defaultTarget = offboardingForm.primaryTransferToUserId;
      setOffboardingTransfers({
        tasks: Object.fromEntries(
          preview.activeTasks.map((task) => [task.id, defaultTarget])
        ) as Record<string, string>,
        leadership: Object.fromEntries(
          preview.leadershipProjects.map((item) => [item.projectId, defaultTarget])
        ) as Record<string, string>,
        documents: Object.fromEntries(
          preview.ownedDocuments.map((item) => [item.fileId, defaultTarget])
        ) as Record<string, string>
      });
    }
  });

  const executeOffboardingMutation = useMutation({
    mutationFn: () =>
      apiRequest("/admin/offboarding/execute", {
        method: "POST",
        body: JSON.stringify({
          userId: offboardingForm.userId,
          primaryTransferToUserId: offboardingForm.primaryTransferToUserId,
          reason: offboardingForm.reason,
          archiveHistory: true,
          taskTransfers: (previewOffboardingMutation.data?.activeTasks ?? []).map((task) => ({
            taskId: task.id,
            toUserId: offboardingTransfers.tasks[task.id] ?? offboardingForm.primaryTransferToUserId
          })),
          leadershipTransfers: (previewOffboardingMutation.data?.leadershipProjects ?? []).map((project) => ({
            projectId: project.projectId,
            role: project.role,
            toUserId:
              offboardingTransfers.leadership[project.projectId] ??
              offboardingForm.primaryTransferToUserId
          })),
          documentTransfers: (previewOffboardingMutation.data?.ownedDocuments ?? []).map((document) => ({
            fileId: document.fileId,
            toUserId:
              offboardingTransfers.documents[document.fileId] ??
              offboardingForm.primaryTransferToUserId
          }))
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      previewOffboardingMutation.reset();
      setOffboardingForm({
        userId: "",
        primaryTransferToUserId: "",
        reason: ""
      });
      setOffboardingTransfers({
        tasks: {},
        leadership: {},
        documents: {}
      });
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: () =>
      apiRequest("/admin/teams", {
        method: "POST",
        body: JSON.stringify({
          name: createTeamForm.name,
          description: createTeamForm.description || undefined,
          coordinatorUserId: createTeamForm.coordinatorUserId || undefined,
          memberIds: []
        })
      }),
    onSuccess: async () => {
      setCreateTeamForm({
        name: "",
        description: "",
        coordinatorUserId: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const dissolveTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      apiRequest(`/admin/teams/${teamId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const createInviteMutation = useMutation({
    mutationFn: () => {
      const expires = new Date(inviteForm.expiresAt);
      if (Number.isNaN(expires.getTime())) {
        throw new Error("Selecciona una fecha de expiración válida");
      }

      return apiRequest<{ linkPreview: string }>("/admin/guest-invites", {
        method: "POST",
        body: JSON.stringify({
          email: inviteForm.email,
          resourceType: inviteForm.resourceType,
          resourceId: inviteForm.resourceId,
          expiresAt: expires.toISOString()
        })
      });
    },
    onSuccess: async (data) => {
      setExternalInviteLinkPreview(data.linkPreview);
      setInviteForm({
        email: "",
        resourceType: "PROYECTO",
        resourceId: "",
        expiresAt: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const createInternalInviteMutation = useMutation({
    mutationFn: () => {
      const expires = new Date(internalInviteForm.expiresAt);
      if (Number.isNaN(expires.getTime())) {
        throw new Error("Selecciona una fecha de expiración válida");
      }

      return apiRequest<{ linkPreview: string }>("/admin/internal-invites", {
        method: "POST",
        body: JSON.stringify({
          email: internalInviteForm.email,
          baseRole: internalInviteForm.baseRole,
          teamId: internalInviteForm.teamId || undefined,
          expiresAt: expires.toISOString()
        })
      });
    },
    onSuccess: async (data) => {
      setInternalInviteLinkPreview(data.linkPreview);
      setInternalInviteForm({
        email: "",
        baseRole: "COLABORADOR",
        teamId: "",
        expiresAt: ""
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-internal-invites"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest(`/admin/guest-invites/${inviteId}/revoke`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    }
  });

  const revokeInternalInviteMutation = useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest(`/admin/internal-invites/${inviteId}/revoke`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-internal-invites"] });
    }
  });

  const extendInviteMutation = useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest(`/admin/guest-invites/${inviteId}/extend`, {
        method: "POST",
        body: JSON.stringify({
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    }
  });

  const resendInternalInviteMutation = useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest<{ linkPreview: string }>(`/admin/internal-invites/${inviteId}/resend`, {
        method: "POST"
      }),
    onSuccess: async (data) => {
      setInternalInviteLinkPreview(data.linkPreview);
      await queryClient.invalidateQueries({ queryKey: ["admin-internal-invites"] });
    }
  });

  const accessLookupMutation = useMutation({
    mutationFn: () =>
      apiRequest<AccessItem[]>(
        `/admin/access?type=${accessLookupForm.type}&id=${encodeURIComponent(accessLookupForm.id)}`
      )
  });

  const userOptions = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
  const offboardingPreview = previewOffboardingMutation.data;
  const offboardingTargetOptions = useMemo(
    () => userOptions.filter((user) => user.id !== offboardingForm.userId),
    [offboardingForm.userId, userOptions]
  );
  const missingOffboardingAssignments = useMemo(() => {
    if (!offboardingPreview) {
      return 0;
    }

    const missingTasks = offboardingPreview.activeTasks.filter(
      (task) => !(offboardingTransfers.tasks[task.id] || offboardingForm.primaryTransferToUserId)
    ).length;
    const missingLeadership = offboardingPreview.leadershipProjects.filter(
      (project) =>
        !(offboardingTransfers.leadership[project.projectId] || offboardingForm.primaryTransferToUserId)
    ).length;
    const missingDocuments = offboardingPreview.ownedDocuments.filter(
      (document) =>
        !(offboardingTransfers.documents[document.fileId] || offboardingForm.primaryTransferToUserId)
    ).length;

    return missingTasks + missingLeadership + missingDocuments;
  }, [offboardingForm.primaryTransferToUserId, offboardingPreview, offboardingTransfers]);

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
        <p className="text-sm text-slate-600">
          Solo el rol Administrador puede acceder al Panel de Administración.
        </p>
      </Card>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Panel de Administración</p>
        <h1 className="text-2xl font-semibold text-slate-900">Administración Corelia</h1>
        <p className="text-sm text-slate-600">
          Gestión de usuarios, equipos, accesos, integraciones y operación global.
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">1. Gestión de Usuarios</h2>

        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Buscar nombre o email"
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
          />
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={userRoleFilter}
            onChange={(event) => setUserRoleFilter(event.target.value as SystemRole | "")}
          >
            <option value="">Todos los roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={userStateFilter}
            onChange={(event) =>
              setUserStateFilter(event.target.value as AdminUsersResponse["items"][number]["state"] | "")
            }
          >
            <option value="">Todos los estados</option>
            {USER_STATE_OPTIONS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setUserSearch("");
              setUserRoleFilter("");
              setUserStateFilter("");
            }}
          >
            Limpiar filtros
          </Button>
        </div>

        {usersQuery.error ? <p className="text-sm text-red-600">{usersQuery.error.message}</p> : null}
        {usersQuery.isLoading ? <p className="text-sm text-slate-600">Cargando usuarios...</p> : null}
        {adminResetPasswordMutation.error ? (
          <p className="text-sm text-red-600">{adminResetPasswordMutation.error.message}</p>
        ) : null}
        {adminPasswordResetFeedback ? (
          <p className="text-sm text-emerald-700">{adminPasswordResetFeedback}</p>
        ) : null}

        <ul className="space-y-2">
          {usersQuery.data?.items.map((user) => (
            <li key={user.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-600">
                    {user.email} · {user.role} · {user.teamName ?? "Sin equipo"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg border px-2 py-0.5 text-xs ${statusTone(user.state)}`}>
                    {user.state}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={adminResetPasswordMutation.isPending}
                    onClick={() => {
                      const newPassword = window.prompt(
                        `Nueva contraseña para ${user.fullName} (mínimo 8 caracteres)`
                      );
                      if (!newPassword) {
                        return;
                      }
                      if (newPassword.length < 8) {
                        window.alert("La contraseña debe tener al menos 8 caracteres.");
                        return;
                      }
                      setAdminPasswordResetFeedback(null);
                      adminResetPasswordMutation.mutate({
                        userId: user.id,
                        newPassword
                      });
                    }}
                  >
                    Restablecer clave
                  </Button>
                  <Button
                    variant={user.state === "INACTIVO" ? "primary" : "ghost"}
                    className="h-8 px-3 text-xs"
                    disabled={setUserActiveMutation.isPending}
                    onClick={() =>
                      setUserActiveMutation.mutate({
                        userId: user.id,
                        isActive: user.state === "INACTIVO"
                      })
                    }
                  >
                    {user.state === "INACTIVO" ? "Activar" : "Desactivar"}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Crear usuario</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Nombre"
              value={createUserForm.firstName}
              onChange={(event) =>
                setCreateUserForm((prev) => ({
                  ...prev,
                  firstName: event.target.value
                }))
              }
            />
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Apellido"
              value={createUserForm.lastName}
              onChange={(event) =>
                setCreateUserForm((prev) => ({
                  ...prev,
                  lastName: event.target.value
                }))
              }
            />
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Email"
              value={createUserForm.email}
              onChange={(event) =>
                setCreateUserForm((prev) => ({
                  ...prev,
                  email: event.target.value
                }))
              }
            />
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={createUserForm.baseRole}
              onChange={(event) =>
                setCreateUserForm((prev) => ({
                  ...prev,
                  baseRole: event.target.value as SystemRole
                }))
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={createUserForm.teamId}
              onChange={(event) =>
                setCreateUserForm((prev) => ({
                  ...prev,
                  teamId: event.target.value
                }))
              }
            >
              <option value="">Sin equipo</option>
              {teamsQuery.data?.items.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createUserForm.startOnboarding}
                onChange={(event) =>
                  setCreateUserForm((prev) => ({
                    ...prev,
                    startOnboarding: event.target.checked
                  }))
                }
              />
              Iniciar onboarding
            </label>
          </div>
          {createUserMutation.error ? (
            <p className="mt-2 text-sm text-red-600">{createUserMutation.error.message}</p>
          ) : null}
          <div className="mt-3">
            <Button
              type="button"
              disabled={
                createUserMutation.isPending ||
                !createUserForm.firstName ||
                !createUserForm.lastName ||
                !createUserForm.email
              }
              onClick={() => createUserMutation.mutate()}
            >
              {createUserMutation.isPending ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Flujo de offboarding</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={offboardingForm.userId}
              onChange={(event) =>
                setOffboardingForm((prev) => ({
                  ...prev,
                  userId: event.target.value
                }))
              }
            >
              <option value="">Selecciona usuario a offboard</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={offboardingForm.primaryTransferToUserId}
              onChange={(event) =>
                setOffboardingForm((prev) => ({
                  ...prev,
                  primaryTransferToUserId: event.target.value
                }))
              }
            >
              <option value="">Responsable principal</option>
              {offboardingTargetOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Motivo"
              value={offboardingForm.reason}
              onChange={(event) =>
                setOffboardingForm((prev) => ({
                  ...prev,
                  reason: event.target.value
                }))
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={previewOffboardingMutation.isPending || !offboardingForm.userId}
              onClick={() => previewOffboardingMutation.mutate()}
            >
              {previewOffboardingMutation.isPending ? "Calculando..." : "Vista previa"}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={
                executeOffboardingMutation.isPending ||
                !offboardingForm.userId ||
                !offboardingForm.primaryTransferToUserId ||
                !offboardingForm.reason ||
                !offboardingPreview ||
                missingOffboardingAssignments > 0
              }
              onClick={() => executeOffboardingMutation.mutate()}
            >
              {executeOffboardingMutation.isPending ? "Ejecutando..." : "Ejecutar offboarding"}
            </Button>
          </div>
          {previewOffboardingMutation.error ? (
            <p className="mt-2 text-sm text-red-600">{previewOffboardingMutation.error.message}</p>
          ) : null}
          {executeOffboardingMutation.error ? (
            <p className="mt-2 text-sm text-red-600">{executeOffboardingMutation.error.message}</p>
          ) : null}
          {offboardingPreview ? (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-700">
                Tareas activas: {offboardingPreview.activeTasks.length} · Roles de liderazgo:{" "}
                {offboardingPreview.leadershipProjects.length} · Documentos propietarios:{" "}
                {offboardingPreview.ownedDocuments.length}
              </p>
              {missingOffboardingAssignments > 0 ? (
                <p className="text-sm text-amber-700">
                  Faltan {missingOffboardingAssignments} asignaciones por definir antes de ejecutar.
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Transferencia de tareas</p>
                {offboardingPreview.activeTasks.length === 0 ? (
                  <p className="text-sm text-slate-600">Sin tareas activas.</p>
                ) : (
                  <ul className="space-y-2">
                    {offboardingPreview.activeTasks.map((task) => (
                      <li key={task.id} className="grid gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[1fr_240px]">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{task.title}</p>
                          <p className="text-xs text-slate-600">{task.projectName}</p>
                        </div>
                        <select
                          className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                          value={offboardingTransfers.tasks[task.id] ?? offboardingForm.primaryTransferToUserId}
                          onChange={(event) =>
                            setOffboardingTransfers((prev) => ({
                              ...prev,
                              tasks: {
                                ...prev.tasks,
                                [task.id]: event.target.value
                              }
                            }))
                          }
                        >
                          <option value="">Seleccionar responsable</option>
                          {offboardingTargetOptions.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.fullName}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Transferencia de liderazgo en proyectos
                </p>
                {offboardingPreview.leadershipProjects.length === 0 ? (
                  <p className="text-sm text-slate-600">Sin roles de liderazgo activos.</p>
                ) : (
                  <ul className="space-y-2">
                    {offboardingPreview.leadershipProjects.map((project) => (
                      <li
                        key={project.projectId}
                        className="grid gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[1fr_240px]"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{project.projectName}</p>
                          <p className="text-xs text-slate-600">{project.role}</p>
                        </div>
                        <select
                          className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                          value={
                            offboardingTransfers.leadership[project.projectId] ??
                            offboardingForm.primaryTransferToUserId
                          }
                          onChange={(event) =>
                            setOffboardingTransfers((prev) => ({
                              ...prev,
                              leadership: {
                                ...prev.leadership,
                                [project.projectId]: event.target.value
                              }
                            }))
                          }
                        >
                          <option value="">Seleccionar sustituto</option>
                          {offboardingTargetOptions.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.fullName}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Transferencia de documentos</p>
                {offboardingPreview.ownedDocuments.length === 0 ? (
                  <p className="text-sm text-slate-600">Sin documentos a transferir.</p>
                ) : (
                  <ul className="space-y-2">
                    {offboardingPreview.ownedDocuments.map((document) => (
                      <li
                        key={document.fileId}
                        className="grid gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[1fr_240px]"
                      >
                        <p className="text-sm font-medium text-slate-900">{document.originalName}</p>
                        <select
                          className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                          value={
                            offboardingTransfers.documents[document.fileId] ??
                            offboardingForm.primaryTransferToUserId
                          }
                          onChange={(event) =>
                            setOffboardingTransfers((prev) => ({
                              ...prev,
                              documents: {
                                ...prev.documents,
                                [document.fileId]: event.target.value
                              }
                            }))
                          }
                        >
                          <option value="">Seleccionar propietario</option>
                          {offboardingTargetOptions.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.fullName}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">2. Invitaciones y Acceso Externo</h2>
        <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Invitación interna (activación por enlace)</p>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Email corporativo"
              value={internalInviteForm.email}
              onChange={(event) =>
                setInternalInviteForm((prev) => ({
                  ...prev,
                  email: event.target.value
                }))
              }
            />
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={internalInviteForm.baseRole}
              onChange={(event) =>
                setInternalInviteForm((prev) => ({
                  ...prev,
                  baseRole: event.target.value as SystemRole
                }))
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={internalInviteForm.teamId}
              onChange={(event) =>
                setInternalInviteForm((prev) => ({
                  ...prev,
                  teamId: event.target.value
                }))
              }
            >
              <option value="">Sin equipo</option>
              {teamsQuery.data?.items.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              type="datetime-local"
              value={internalInviteForm.expiresAt}
              onChange={(event) =>
                setInternalInviteForm((prev) => ({
                  ...prev,
                  expiresAt: event.target.value
                }))
              }
            />
          </div>
          <Button
            type="button"
            disabled={
              createInternalInviteMutation.isPending ||
              !internalInviteForm.email ||
              !internalInviteForm.expiresAt
            }
            onClick={() => createInternalInviteMutation.mutate()}
          >
            {createInternalInviteMutation.isPending
              ? "Generando..."
              : "Generar enlace de invitación interna"}
          </Button>
          {createInternalInviteMutation.error ? (
            <p className="text-sm text-red-600">{createInternalInviteMutation.error.message}</p>
          ) : null}
          {internalInviteLinkPreview ? (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Enlace interno: {internalInviteLinkPreview}
            </p>
          ) : null}

          <ul className="space-y-2">
            {internalInvitesQuery.data?.items.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      {invite.baseRole} · {invite.teamName ?? "Sin equipo"} · expira{" "}
                      {formatDateTime(invite.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      disabled={resendInternalInviteMutation.isPending}
                      onClick={() => resendInternalInviteMutation.mutate(invite.id)}
                    >
                      Reenviar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="h-8 px-3 text-xs"
                      disabled={
                        revokeInternalInviteMutation.isPending ||
                        Boolean(invite.revokedAt) ||
                        Boolean(invite.acceptedAt)
                      }
                      onClick={() => revokeInternalInviteMutation.mutate(invite.id)}
                    >
                      {invite.revokedAt ? "Revocada" : invite.acceptedAt ? "Aceptada" : "Revocar"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Invitados externos</p>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Email invitado externo"
              value={inviteForm.email}
              onChange={(event) =>
                setInviteForm((prev) => ({
                  ...prev,
                  email: event.target.value
                }))
              }
            />
            <select
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              value={inviteForm.resourceType}
              onChange={(event) =>
                setInviteForm((prev) => ({
                  ...prev,
                  resourceType: event.target.value as "PROYECTO" | "ARCHIVO" | "DOCUMENTO"
                }))
              }
            >
              <option value="PROYECTO">Proyecto</option>
              <option value="ARCHIVO">Archivo</option>
              <option value="DOCUMENTO">Documento</option>
            </select>
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="ID del recurso"
              value={inviteForm.resourceId}
              onChange={(event) =>
                setInviteForm((prev) => ({
                  ...prev,
                  resourceId: event.target.value
                }))
              }
            />
            <input
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
              type="datetime-local"
              value={inviteForm.expiresAt}
              onChange={(event) =>
                setInviteForm((prev) => ({
                  ...prev,
                  expiresAt: event.target.value
                }))
              }
            />
          </div>
          <Button
            type="button"
            disabled={
              createInviteMutation.isPending ||
              !inviteForm.email ||
              !inviteForm.resourceId ||
              !inviteForm.expiresAt
            }
            onClick={() => createInviteMutation.mutate()}
          >
            {createInviteMutation.isPending ? "Generando..." : "Generar enlace externo"}
          </Button>
          {createInviteMutation.error ? (
            <p className="text-sm text-red-600">{createInviteMutation.error.message}</p>
          ) : null}
          {externalInviteLinkPreview ? (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Enlace externo: {externalInviteLinkPreview}
            </p>
          ) : null}

          <ul className="space-y-2">
            {invitesQuery.data?.items.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      {invite.resourceType} · {invite.resourceId} · expira {formatDateTime(invite.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      disabled={extendInviteMutation.isPending}
                      onClick={() => extendInviteMutation.mutate(invite.id)}
                    >
                      Extender 7 días
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="h-8 px-3 text-xs"
                      disabled={revokeInviteMutation.isPending || Boolean(invite.revokedAt)}
                      onClick={() => revokeInviteMutation.mutate(invite.id)}
                    >
                      {invite.revokedAt ? "Revocada" : "Revocar"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">3. Gestión de Equipos</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Nombre del equipo"
            value={createTeamForm.name}
            onChange={(event) =>
              setCreateTeamForm((prev) => ({
                ...prev,
                name: event.target.value
              }))
            }
          />
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Descripción"
            value={createTeamForm.description}
            onChange={(event) =>
              setCreateTeamForm((prev) => ({
                ...prev,
                description: event.target.value
              }))
            }
          />
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={createTeamForm.coordinatorUserId}
            onChange={(event) =>
              setCreateTeamForm((prev) => ({
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
        </div>
        <Button
          type="button"
          disabled={createTeamMutation.isPending || !createTeamForm.name}
          onClick={() => createTeamMutation.mutate()}
        >
          {createTeamMutation.isPending ? "Creando..." : "Crear equipo"}
        </Button>
        {createTeamMutation.error ? <p className="text-sm text-red-600">{createTeamMutation.error.message}</p> : null}
        <ul className="space-y-2">
          {teamsQuery.data?.items.map((team) => (
            <li key={team.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{team.name}</p>
                  <p className="text-xs text-slate-600">
                    Coordinador: {team.coordinator?.fullName ?? "No asignado"} · Miembros:{" "}
                    {team.membersCount}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-3 text-xs"
                  disabled={dissolveTeamMutation.isPending}
                  onClick={() => dissolveTeamMutation.mutate(team.id)}
                >
                  Disolver
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. Gestión de Roles y Permisos</h2>
        <p className="text-sm text-slate-600">Matriz de permisos por rol y vista de acceso por recurso.</p>
        {rolesQuery.error ? <p className="text-sm text-red-600">{rolesQuery.error.message}</p> : null}
        <ul className="space-y-2">
          {rolesQuery.data?.map((item) => (
            <li key={item.role} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">{item.role}</p>
              <p className="text-xs text-slate-600">{item.permissions.join(", ")}</p>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={accessLookupForm.type}
            onChange={(event) =>
              setAccessLookupForm((prev) => ({
                ...prev,
                type: event.target.value as "PROYECTO" | "EQUIPO" | "ARCHIVO" | "DOCUMENTO"
              }))
            }
          >
            <option value="PROYECTO">Proyecto</option>
            <option value="EQUIPO">Equipo</option>
            <option value="ARCHIVO">Archivo</option>
            <option value="DOCUMENTO">Documento</option>
          </select>
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="ID del recurso"
            value={accessLookupForm.id}
            onChange={(event) =>
              setAccessLookupForm((prev) => ({
                ...prev,
                id: event.target.value
              }))
            }
          />
          <Button
            type="button"
            variant="secondary"
            disabled={accessLookupMutation.isPending || !accessLookupForm.id}
            onClick={() => accessLookupMutation.mutate()}
          >
            Consultar acceso
          </Button>
        </div>
        {accessLookupMutation.error ? (
          <p className="text-sm text-red-600">{accessLookupMutation.error.message}</p>
        ) : null}
        {accessLookupMutation.data ? (
          <ul className="space-y-2">
            {accessLookupMutation.data.map((item) => (
              <li key={item.userId} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{item.fullName}</p>
                <p className="text-xs text-slate-600">
                  {item.email} · {item.accessLevel}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. Configuración de la Organización</h2>
        {overview ? (
          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-sm text-slate-700">Nombre: {overview.organization.name}</p>
            <p className="text-sm text-slate-700">
              Zona horaria por defecto: {overview.organization.defaultTimezone}
            </p>
            <p className="text-sm text-slate-700">Idioma por defecto: {overview.organization.defaultLanguage}</p>
            <p className="text-sm text-slate-700">
              Jornada: {overview.organization.workingHours.startHour} -{" "}
              {overview.organization.workingHours.endHour}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Cargando configuración...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. Configuración de Integraciones</h2>
        {overview ? (
          <>
            <p className="text-sm text-slate-700">
              Webhooks configurados: {overview.integrations.webhooksConfigured} · activos:{" "}
              {overview.integrations.webhooksEnabled}
            </p>
            <ul className="space-y-2">
              {overview.integrations.latestDeliveries.map((delivery) => (
                <li key={delivery.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{delivery.endpointId}</p>
                  <p className="text-xs text-slate-600">
                    {delivery.success ? "OK" : "Fallido"} · {formatDateTime(delivery.attemptedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-600">Cargando integraciones...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">7. Automatizaciones Globales</h2>
        {overview ? (
          <p className="text-sm text-slate-700">
            Total: {overview.automations.total} · Activas: {overview.automations.enabled} · Fallidas
            (24h): {overview.automations.failedLast24h}
          </p>
        ) : (
          <p className="text-sm text-slate-600">Cargando automatizaciones...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">8. Tablón de Anuncios — Gestión</h2>
        {overview ? (
          <>
            <p className="text-sm text-slate-700">Anuncios activos: {overview.announcements.active}</p>
            <ul className="space-y-2">
              {overview.announcements.recent.map((announcement) => (
                <li key={announcement.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{announcement.title}</p>
                  <p className="text-xs text-slate-600">
                    Publicado: {formatDateTime(announcement.createdAt)} · Expira:{" "}
                    {formatDateTime(announcement.expiresAt)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-600">Cargando anuncios...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">9. Formularios y Solicitudes — Configuración</h2>
        {overview ? (
          <>
            <p className="text-sm text-slate-700">
              Solicitudes activas: {overview.forms.activeRequests} · Pendientes de aprobación:{" "}
              {overview.forms.pendingApproval}
            </p>
            <ul className="space-y-2">
              {overview.forms.byStatus.map((row) => (
                <li key={row.status} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                  {row.status}: {row.total}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-600">Cargando formularios...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">10. Log de Auditoría</h2>
        {overview ? (
          <ul className="space-y-2">
            {overview.audit.latestEvents.map((event) => (
              <li key={event.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">
                  {event.entityType} · {event.action}
                </p>
                <p className="text-xs text-slate-600">
                  {formatDateTime(event.createdAt)} · usuario {event.userId ?? "sistema"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Cargando auditoría...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">11. Estado del Sistema</h2>
        {overview ? (
          <>
            <p className="text-sm text-slate-700">
              Mantenimiento: {overview.system.maintenanceEnabled ? "Activo" : "Inactivo"}
            </p>
            <ul className="space-y-2">
              {overview.system.services.map((service) => (
                <li key={service.service} className="rounded-xl border border-slate-200 p-3 text-sm">
                  {service.service}: {service.status}
                </li>
              ))}
            </ul>
            <Link
              href={"/admin/system" as Route}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              Abrir vista detallada del sistema
            </Link>
          </>
        ) : (
          <p className="text-sm text-slate-600">Cargando estado...</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">12. Importación de Datos</h2>
        {overview ? (
          <ul className="space-y-2">
            {overview.imports.latestJobs.map((job) => (
              <li key={job.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">
                  {job.source} · {job.filename}
                </p>
                <p className="text-xs text-slate-600">
                  Inicio: {formatDateTime(job.startedAt)} · Resultado: {job.success ? "OK" : "Error"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Cargando importaciones...</p>
        )}
      </Card>
    </div>
  );
};
