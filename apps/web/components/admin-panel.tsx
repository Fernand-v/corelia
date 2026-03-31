"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  frontendSettingsDefaults,
  type AdminAuditReportResponse,
  type AdminOverview,
  type FrontendSettings,
  type RoleCode,
  type TaskStatusColors
} from "@corelia/types";
import { Button, Card } from "@corelia/ui";
import { apiRequest, getApiBaseUrl, getAuthToken } from "@/lib/api";
import { useFrontendSettings } from "@/lib/frontend-settings";
import { useSession } from "@/lib/session";
import { UiModal } from "@/components/ui-modal";

type AdminUsersResponse = {
  items: Array<{
    id: string;
    fullName: string;
    email: string;
    role: RoleCode;
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
    resourceScopeType: "PROYECTO" | "ARCHIVO" | "DOCUMENTO";
    resourceScopeId: string;
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
    baseRole: RoleCode;
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
  role: RoleCode;
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
  leadershipProjects: Array<{ projectId: string; projectName: string; role: RoleCode }>;
  ownedDocuments: Array<{ fileId: string; originalName: string }>;
};

type OffboardingTransfersState = {
  tasks: Record<string, string>;
  leadership: Record<string, string>;
  documents: Record<string, string>;
};

type ProjectItem = {
  id: string;
  name: string;
};


const TASK_STATUS_OPTIONS: Array<{ status: keyof TaskStatusColors; label: string }> = [
  { status: "PENDIENTE", label: "Pendiente" },
  { status: "EN_REVISION", label: "En revisión" },
  { status: "COMPLETADA", label: "Completada" }
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const ActionCard = ({
  title,
  description,
  helper,
  buttonLabel,
  onOpen
}: {
  title: string;
  description: string;
  helper?: string;
  buttonLabel: string;
  onOpen: () => void;
}) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-600">{description}</p>
    {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    <div className="mt-3">
      <Button type="button" className="h-8 px-3 text-xs" onClick={onOpen}>
        {buttonLabel}
      </Button>
    </div>
  </article>
);

const toIso = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Selecciona una fecha válida");
  }
  return parsed.toISOString();
};

const parseDownloadFilename = (contentDisposition: string | null, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return fallback;
    }
  }

  const plainMatch = contentDisposition.match(/filename=\"?([^";]+)\"?/i);
  return plainMatch?.[1] ?? fallback;
};

export const AdminPanelView = () => {
  const session = useSession();
  const { settings: frontendSettings } = useFrontendSettings();
  const queryClient = useQueryClient();

  const [userSearch] = useState("");
  const [userRoleFilter] = useState<RoleCode | "">("");
  const [userStateFilter] = useState<
    AdminUsersResponse["items"][number]["state"] | ""
  >(""
  );

  const [openCreateUserModal, setOpenCreateUserModal] = useState(false);
  const [openOffboardingModal, setOpenOffboardingModal] = useState(false);
  const [openInternalInviteModal, setOpenInternalInviteModal] = useState(false);
  const [openExternalInviteModal, setOpenExternalInviteModal] = useState(false);
  const [openCreateTeamModal, setOpenCreateTeamModal] = useState(false);
  const [openAccessModal, setOpenAccessModal] = useState(false);
  const [openAuditModal, setOpenAuditModal] = useState(false);
  const [openDatabaseBackupModal, setOpenDatabaseBackupModal] = useState(false);
  const [openResetPasswordModal, setOpenResetPasswordModal] = useState(false);
  const [openVisualSettingsModal, setOpenVisualSettingsModal] = useState(false);
  const [openRolesPermissionsModal, setOpenRolesPermissionsModal] = useState(false);
  const [resetPasswordUserSearch, setResetPasswordUserSearch] = useState("");

  const [createUserForm, setCreateUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    baseRole: "COLABORADOR" as RoleCode,
    teamId: "",
    startOnboarding: true
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    userId: "",
    fullName: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [adminPasswordResetFeedback, setAdminPasswordResetFeedback] = useState<string | null>(null);

  const [createTeamForm, setCreateTeamForm] = useState({
    name: "",
    description: "",
    coordinatorUserId: ""
  });

  const [inviteForm, setInviteForm] = useState({
    email: "",
    resourceScopeId: "",
    expiresAt: ""
  });

  const [externalInviteLinkPreview, setExternalInviteLinkPreview] = useState<string | null>(null);

  const [internalInviteForm, setInternalInviteForm] = useState({
    email: "",
    baseRole: "COLABORADOR" as RoleCode,
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

  const [accessLookupForm, setAccessLookupForm] = useState({
    projectId: ""
  });

  const [auditFilters, setAuditFilters] = useState({
    from: "",
    to: "",
    page: 1,
    pageSize: 50
  });
  const [databaseBackupPassword, setDatabaseBackupPassword] = useState("");

  const [visualSettingsForm, setVisualSettingsForm] = useState<{
    organizationName: string;
    taskStatusColors: TaskStatusColors;
    instantCallExpiryHours: string;
  }>({
    organizationName: frontendSettingsDefaults.organizationName,
    taskStatusColors: {
      ...frontendSettingsDefaults.taskStatusColors
    },
    instantCallExpiryHours: String(frontendSettingsDefaults.instantCallExpiryHours)
  });
  const [visualSettingsDirty, setVisualSettingsDirty] = useState(false);
  const [visualSettingsFeedback, setVisualSettingsFeedback] = useState<string | null>(null);

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

  const projectsQuery = useQuery({
    queryKey: ["admin-project-options"],
    queryFn: () => apiRequest<ProjectItem[]>("/projects")
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

  const availableRolesQuery = useQuery({
    queryKey: ["available-roles"],
    queryFn: () => apiRequest<Array<{ id: string; key: string; displayName: string; rank: number; isSystem: boolean; scope: string }>>("/identity/roles")
  });
  const roleOptions = useMemo(() => availableRolesQuery.data ?? [], [availableRolesQuery.data]);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiRequest<AdminOverview>("/admin/overview?page=1&pageSize=10")
  });

  const adminFrontendSettingsQuery = useQuery({
    queryKey: ["admin-frontend-settings"],
    queryFn: () => apiRequest<FrontendSettings>("/admin/frontend-settings")
  });
  const adminFrontendSettings = adminFrontendSettingsQuery.data;

  const auditReportQuery = useQuery({
    queryKey: ["admin-audit-report", auditFilters.from, auditFilters.to, auditFilters.page, auditFilters.pageSize],
    queryFn: () => {
      const params = new URLSearchParams();
      if (auditFilters.from) {
        params.set("from", toIso(auditFilters.from));
      }
      if (auditFilters.to) {
        params.set("to", toIso(auditFilters.to));
      }
      params.set("page", String(auditFilters.page));
      params.set("pageSize", String(auditFilters.pageSize));
      return apiRequest<AdminAuditReportResponse>(`/admin/audit-report?${params.toString()}`);
    },
    enabled: openAuditModal
  });

  useEffect(() => {
    if (!adminFrontendSettings) {
      return;
    }

    setVisualSettingsForm({
      organizationName: adminFrontendSettings.organizationName,
      taskStatusColors: {
        ...adminFrontendSettings.taskStatusColors
      },
      instantCallExpiryHours: String(adminFrontendSettings.instantCallExpiryHours)
    });
    setVisualSettingsDirty(false);
  }, [adminFrontendSettings]);

  const saveVisualSettingsMutation = useMutation({
    mutationFn: () =>
      apiRequest<FrontendSettings>("/admin/frontend-settings", {
        method: "PATCH",
        body: JSON.stringify({
          organizationName: visualSettingsForm.organizationName.trim(),
          taskStatusColors: {
            PENDIENTE: visualSettingsForm.taskStatusColors.PENDIENTE.trim().toUpperCase(),
            EN_REVISION: visualSettingsForm.taskStatusColors.EN_REVISION.trim().toUpperCase(),
            COMPLETADA: visualSettingsForm.taskStatusColors.COMPLETADA.trim().toUpperCase()
          },
          instantCallExpiryHours: Number.parseInt(visualSettingsForm.instantCallExpiryHours, 10)
        })
      }),
    onSuccess: async (updated) => {
      setVisualSettingsForm({
        organizationName: updated.organizationName,
        taskStatusColors: {
          ...updated.taskStatusColors
        },
        instantCallExpiryHours: String(updated.instantCallExpiryHours)
      });
      setVisualSettingsDirty(false);
      setVisualSettingsFeedback("Configuración guardada correctamente.");
      await queryClient.invalidateQueries({ queryKey: ["admin-frontend-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["frontend-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
    }
  });

  const resetVisualSettingsMutation = useMutation({
    mutationFn: () =>
      apiRequest<FrontendSettings>("/admin/frontend-settings/reset", {
        method: "POST"
      }),
    onSuccess: async (updated) => {
      setVisualSettingsForm({
        organizationName: updated.organizationName,
        taskStatusColors: {
          ...updated.taskStatusColors
        },
        instantCallExpiryHours: String(updated.instantCallExpiryHours)
      });
      setVisualSettingsDirty(false);
      setVisualSettingsFeedback("Se restauraron los valores por defecto.");
      await queryClient.invalidateQueries({ queryKey: ["admin-frontend-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["frontend-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string; email: string }>("/admin/users", {
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
      setOpenCreateUserModal(false);
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
      setOpenResetPasswordModal(false);
      setResetPasswordForm({
        userId: "",
        fullName: "",
        newPassword: "",
        confirmPassword: ""
      });
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
        tasks: Object.fromEntries(preview.activeTasks.map((task) => [task.id, defaultTarget])) as Record<string, string>,
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
              offboardingTransfers.leadership[project.projectId] ?? offboardingForm.primaryTransferToUserId
          })),
          documentTransfers: (previewOffboardingMutation.data?.ownedDocuments ?? []).map((document) => ({
            fileId: document.fileId,
            toUserId:
              offboardingTransfers.documents[document.fileId] ?? offboardingForm.primaryTransferToUserId
          }))
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      previewOffboardingMutation.reset();
      setOffboardingForm({ userId: "", primaryTransferToUserId: "", reason: "" });
      setOffboardingTransfers({ tasks: {}, leadership: {}, documents: {} });
      setOpenOffboardingModal(false);
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
      setCreateTeamForm({ name: "", description: "", coordinatorUserId: "" });
      setOpenCreateTeamModal(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const createInviteMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ linkPreview: string }>("/admin/guest-invites", {
        method: "POST",
        body: JSON.stringify({
          email: inviteForm.email,
          resourceScopeType: "PROYECTO",
          resourceScopeId: inviteForm.resourceScopeId,
          expiresAt: toIso(inviteForm.expiresAt)
        })
      }),
    onSuccess: async (data) => {
      setExternalInviteLinkPreview(data.linkPreview);
      setInviteForm({ email: "", resourceScopeId: "", expiresAt: "" });
      setOpenExternalInviteModal(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  });

  const createInternalInviteMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ linkPreview: string }>("/admin/internal-invites", {
        method: "POST",
        body: JSON.stringify({
          email: internalInviteForm.email,
          baseRole: internalInviteForm.baseRole,
          teamId: internalInviteForm.teamId || undefined,
          expiresAt: toIso(internalInviteForm.expiresAt)
        })
      }),
    onSuccess: async (data) => {
      setInternalInviteLinkPreview(data.linkPreview);
      setInternalInviteForm({ email: "", baseRole: "COLABORADOR", teamId: "", expiresAt: "" });
      setOpenInternalInviteModal(false);
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
        `/admin/access?type=PROYECTO&id=${encodeURIComponent(accessLookupForm.projectId)}`
      )
  });

  const databaseBackupMutation = useMutation({
    mutationFn: async () => {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");

      const token = getAuthToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(`${getApiBaseUrl()}/admin/database-backup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          password: databaseBackupPassword
        })
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "No se pudo generar el backup de base de datos" }));
        throw new Error(body.message ?? "No se pudo generar el backup de base de datos");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = parseDownloadFilename(
        response.headers.get("Content-Disposition"),
        `corelia-backup-${new Date().toISOString().slice(0, 10)}.dump`
      );
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      setDatabaseBackupPassword("");
      setOpenDatabaseBackupModal(false);
    }
  });

  const userOptions = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items]);
  const projectOptions = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

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

  const runAuditExport = async () => {
    const params = new URLSearchParams();
    if (auditFilters.from) {
      params.set("from", toIso(auditFilters.from));
    }
    if (auditFilters.to) {
      params.set("to", toIso(auditFilters.to));
    }

    const headers = new Headers();
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${getApiBaseUrl()}/admin/audit-report/export.csv?${params.toString()}`, {
      headers
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "No se pudo descargar auditoría" }));
      throw new Error(body.message ?? "No se pudo descargar auditoría");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
        <p className="text-sm text-slate-600">
          Solo el rol Administrador puede acceder al Panel de Administración.
        </p>
      </Card>
    );
  }

  const overview = overviewQuery.data;
  const visualColorRegex = /^#[0-9A-F]{6}$/;
  const visualInstantCallHoursText = visualSettingsForm.instantCallExpiryHours.trim();
  const visualInstantCallHours = Number.parseInt(visualInstantCallHoursText, 10);
  const visualInstantCallHoursValid =
    /^\d+$/.test(visualInstantCallHoursText) &&
    Number.isInteger(visualInstantCallHours) &&
    visualInstantCallHours >= 1 &&
    visualInstantCallHours <= 720;
  const visualSettingsValid =
    visualSettingsForm.organizationName.trim().length > 0 &&
    visualInstantCallHoursValid &&
    TASK_STATUS_OPTIONS.every(({ status }) =>
      visualColorRegex.test(visualSettingsForm.taskStatusColors[status].trim().toUpperCase())
    );

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Panel de Administración</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Administración {frontendSettings.organizationName}
        </h1>
        <p className="text-sm text-slate-600">Acciones administrativas principales en un solo lugar.</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Acciones</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title="Crear usuario"
            description="Alta de usuario interno con rol base y equipo opcional."
            helper={`Usuarios actuales: ${usersQuery.data?.total ?? 0}`}
            buttonLabel="Abrir"
            onOpen={() => setOpenCreateUserModal(true)}
          />
          <ActionCard
            title="Flujo de offboarding"
            description="Transferencia de tareas, liderazgo y documentos antes de desactivar usuario."
            buttonLabel="Abrir"
            onOpen={() => setOpenOffboardingModal(true)}
          />
          <ActionCard
            title="Invitación interna"
            description="Genera enlace de activación para nuevos usuarios internos."
            helper={`Pendientes: ${internalInvitesQuery.data?.items.filter((item) => !item.revokedAt && !item.acceptedAt).length ?? 0}`}
            buttonLabel="Abrir"
            onOpen={() => setOpenInternalInviteModal(true)}
          />
          <ActionCard
            title="Invitación externa"
            description="Invita externos a un proyecto específico con fecha de expiración."
            helper={`Activas: ${invitesQuery.data?.items.filter((item) => !item.revokedAt).length ?? 0}`}
            buttonLabel="Abrir"
            onOpen={() => setOpenExternalInviteModal(true)}
          />
          <ActionCard
            title="Crear equipo"
            description="Crea equipos y define coordinador para la operación."
            helper={`Equipos actuales: ${teamsQuery.data?.total ?? 0}`}
            buttonLabel="Abrir"
            onOpen={() => setOpenCreateTeamModal(true)}
          />
          <ActionCard
            title="Consultar accesos"
            description="Consulta los accesos efectivos por proyecto."
            buttonLabel="Abrir"
            onOpen={() => setOpenAccessModal(true)}
          />
          <ActionCard
            title="Reporte de auditoría"
            description="Filtra eventos por fecha y descarga CSV."
            helper={`Eventos recientes: ${overview?.audit.latestEvents.length ?? 0}`}
            buttonLabel="Abrir"
            onOpen={() => setOpenAuditModal(true)}
          />
          <ActionCard
            title="Backup de base de datos"
            description="Genera un respaldo completo (.dump) y lo descarga de inmediato."
            helper="Solicita contraseña del administrador para confirmar la operación."
            buttonLabel="Generar"
            onOpen={() => {
              setDatabaseBackupPassword("");
              databaseBackupMutation.reset();
              setOpenDatabaseBackupModal(true);
            }}
          />
          <ActionCard
            title="Resetear contraseña"
            description="Busca un usuario y establece una nueva contraseña temporal."
            buttonLabel="Abrir"
            onOpen={() => {
              setAdminPasswordResetFeedback(null);
              setResetPasswordUserSearch("");
              setResetPasswordForm({ userId: "", fullName: "", newPassword: "", confirmPassword: "" });
              setOpenResetPasswordModal(true);
            }}
          />
          <ActionCard
            title="Configuraciones generales"
            description="Personaliza nombre de empresa y colores de estados."
            helper={`Empresa actual: ${visualSettingsForm.organizationName.trim() || frontendSettingsDefaults.organizationName}`}
            buttonLabel="Configurar"
            onOpen={() => {
              setVisualSettingsFeedback(null);
              setOpenVisualSettingsModal(true);
            }}
          />
          <ActionCard
            title="Roles y permisos"
            description="Consulta la matriz completa de permisos por rol."
            helper={`Roles disponibles: ${rolesQuery.data?.length ?? 0}`}
            buttonLabel="Ver matriz"
            onOpen={() => setOpenRolesPermissionsModal(true)}
          />
        </div>
      </Card>

      {(teamsQuery.data?.items.length ?? 0) > 0 ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Equipos</h2>
          <ul className="space-y-2">
            {teamsQuery.data?.items.map((team) => (
              <li key={team.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{team.name}</p>
                    <p className="text-xs text-slate-600">
                      Coordinador: {team.coordinator?.fullName ?? "No asignado"} · Miembros: {team.membersCount}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {(internalInvitesQuery.data?.items.length ?? 0) > 0 || internalInviteLinkPreview ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Invitaciones internas</h2>
          <ul className="space-y-2">
            {internalInvitesQuery.data?.items.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      {invite.baseRole} · {invite.teamName ?? "Sin equipo"} · expira {formatDateTime(invite.expiresAt)}
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
                        revokeInternalInviteMutation.isPending || Boolean(invite.revokedAt) || Boolean(invite.acceptedAt)
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
          {internalInviteLinkPreview ? (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Enlace interno: {internalInviteLinkPreview}
            </p>
          ) : null}
        </Card>
      ) : null}

      {(invitesQuery.data?.items.length ?? 0) > 0 || externalInviteLinkPreview ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Invitaciones externas</h2>
          <ul className="space-y-2">
            {invitesQuery.data?.items.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      PROYECTO · {invite.resourceScopeId} · expira {formatDateTime(invite.expiresAt)}
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
          {externalInviteLinkPreview ? (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Enlace externo: {externalInviteLinkPreview}
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Integraciones</p>
          <p className="text-xs text-slate-600">
            Webhooks: {overview?.integrations.webhooksConfigured ?? 0} · activos: {overview?.integrations.webhooksEnabled ?? 0}
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Automatizaciones</p>
          <p className="text-xs text-slate-600">
            Total: {overview?.automations.total ?? 0} · Activas: {overview?.automations.enabled ?? 0} · Fallidas 24h: {overview?.automations.failedLast24h ?? 0}
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Formularios</p>
          <p className="text-xs text-slate-600">
            Activas: {overview?.forms.activeRequests ?? 0} · Pendientes: {overview?.forms.pendingApproval ?? 0}
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Importaciones</p>
          <p className="text-xs text-slate-600">Últimos jobs: {overview?.imports.latestJobs.length ?? 0}</p>
        </Card>
      </div>

      <UiModal
        open={openVisualSettingsModal}
        onClose={() => setOpenVisualSettingsModal(false)}
        title="Configuraciones generales"
        widthClassName="max-w-3xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenVisualSettingsModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={resetVisualSettingsMutation.isPending}
              onClick={() => {
                setVisualSettingsFeedback(null);
                resetVisualSettingsMutation.mutate();
              }}
            >
              {resetVisualSettingsMutation.isPending ? "Restaurando..." : "Restaurar por defecto"}
            </Button>
            <Button
              type="button"
              disabled={saveVisualSettingsMutation.isPending || !visualSettingsValid || !visualSettingsDirty}
              onClick={() => {
                setVisualSettingsFeedback(null);
                saveVisualSettingsMutation.mutate();
              }}
            >
              {saveVisualSettingsMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-500">
          Configura nombre de empresa, colores de estados de tarea y vigencia de videollamadas instantáneas sin editar código.
        </p>

        {adminFrontendSettingsQuery.isLoading ? (
          <p className="text-sm text-slate-600">Cargando configuración visual...</p>
        ) : null}
        {adminFrontendSettingsQuery.error ? (
          <p className="text-sm text-red-600">{adminFrontendSettingsQuery.error.message}</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Nombre de empresa</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={visualSettingsForm.organizationName}
              onChange={(event) => {
                setVisualSettingsFeedback(null);
                setVisualSettingsDirty(true);
                setVisualSettingsForm((prev) => ({
                  ...prev,
                  organizationName: event.target.value
                }));
              }}
              placeholder="Nombre de empresa"
            />
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {visualSettingsForm.organizationName.trim() || frontendSettingsDefaults.organizationName}
            </p>
            <p className="text-xs text-slate-600">Nombre aplicado en login, shell, admin y home.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Vigencia de videollamada instantánea (horas)</span>
            <input
              type="number"
              min={1}
              max={720}
              step={1}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={visualSettingsForm.instantCallExpiryHours}
              onChange={(event) => {
                setVisualSettingsFeedback(null);
                setVisualSettingsDirty(true);
                setVisualSettingsForm((prev) => ({
                  ...prev,
                  instantCallExpiryHours: event.target.value
                }));
              }}
              placeholder="24"
            />
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {visualInstantCallHoursValid ? `${visualInstantCallHours} horas` : "Valor no válido"}
            </p>
            <p className="text-xs text-slate-600">
              Después de este tiempo el botón de ingreso pasa a gris y se bloquea el acceso.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {TASK_STATUS_OPTIONS.map((item) => {
            const color = visualSettingsForm.taskStatusColors[item.status];
            return (
              <div key={item.status} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-11 cursor-pointer rounded border border-slate-300 bg-white p-1"
                    value={visualColorRegex.test(color) ? color : "#64748B"}
                    onChange={(event) => {
                      const nextColor = event.target.value.toUpperCase();
                      setVisualSettingsFeedback(null);
                      setVisualSettingsDirty(true);
                      setVisualSettingsForm((prev) => ({
                        ...prev,
                        taskStatusColors: {
                          ...prev.taskStatusColors,
                          [item.status]: nextColor
                        }
                      }));
                    }}
                  />
                  <input
                    className="h-9 w-full rounded-md border border-slate-300 px-2 text-xs font-medium uppercase"
                    value={color}
                    onChange={(event) => {
                      const nextColor = event.target.value.toUpperCase();
                      setVisualSettingsFeedback(null);
                      setVisualSettingsDirty(true);
                      setVisualSettingsForm((prev) => ({
                        ...prev,
                        taskStatusColors: {
                          ...prev.taskStatusColors,
                          [item.status]: nextColor
                        }
                      }));
                    }}
                  />
                </div>
                <div className="mt-2">
                  <span
                    className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      borderColor: `${color}66`,
                      backgroundColor: `${color}26`,
                      color: "#0F172A"
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {!visualSettingsValid ? (
          <p className="text-sm text-red-600">
            Verifica nombre, colores hex válidos (formato #RRGGBB) y vigencia en horas (1 a 720).
          </p>
        ) : null}
        {saveVisualSettingsMutation.error ? (
          <p className="text-sm text-red-600">{saveVisualSettingsMutation.error.message}</p>
        ) : null}
        {resetVisualSettingsMutation.error ? (
          <p className="text-sm text-red-600">{resetVisualSettingsMutation.error.message}</p>
        ) : null}
        {visualSettingsFeedback ? <p className="text-sm text-emerald-700">{visualSettingsFeedback}</p> : null}
      </UiModal>

      <UiModal
        open={openRolesPermissionsModal}
        onClose={() => setOpenRolesPermissionsModal(false)}
        title="Roles y permisos"
        widthClassName="max-w-5xl"
        footer={
          <Button type="button" variant="ghost" onClick={() => setOpenRolesPermissionsModal(false)}>
            Cerrar
          </Button>
        }
      >
        <p className="text-xs text-slate-500">Vista de los permisos asignados a cada rol del sistema.</p>
        {rolesQuery.isLoading ? <p className="text-sm text-slate-600">Cargando roles...</p> : null}
        {rolesQuery.error ? <p className="text-sm text-red-600">{rolesQuery.error.message}</p> : null}
        {(rolesQuery.data?.length ?? 0) === 0 && !rolesQuery.isLoading ? (
          <p className="text-sm text-slate-600">No hay roles disponibles para mostrar.</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rolesQuery.data?.map((item) => (
            <article key={item.role} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-sm font-semibold text-slate-900">{item.role}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    {permission}
                  </span>
                ))}
                {item.permissions.length === 0 ? (
                  <span className="text-xs text-slate-400">Sin permisos asignados</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </UiModal>

      <UiModal
        open={openCreateUserModal}
        onClose={() => setOpenCreateUserModal(false)}
        title="Crear usuario"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenCreateUserModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                createUserMutation.isPending || !createUserForm.firstName || !createUserForm.lastName || !createUserForm.email
              }
              onClick={() => createUserMutation.mutate()}
            >
              {createUserMutation.isPending ? "Creando..." : "Crear usuario"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Nombre</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Nombre"
              value={createUserForm.firstName}
              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, firstName: event.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Apellido</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Apellido"
              value={createUserForm.lastName}
              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, lastName: event.target.value }))}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Email corporativo</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="usuario@empresa.com"
              value={createUserForm.email}
              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Rol base</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={createUserForm.baseRole}
              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, baseRole: event.target.value as RoleCode }))}
            >
              {roleOptions.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Equipo (opcional)</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={createUserForm.teamId}
              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, teamId: event.target.value }))}
            >
              <option value="">Sin equipo</option>
              {teamsQuery.data?.items.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={createUserForm.startOnboarding}
              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, startOnboarding: event.target.checked }))}
            />
            Iniciar proceso de onboarding
          </label>
        </div>
        {createUserMutation.error ? <p className="text-sm text-red-600">{createUserMutation.error.message}</p> : null}
      </UiModal>

      <UiModal
        open={openResetPasswordModal}
        onClose={() => setOpenResetPasswordModal(false)}
        title="Resetear contraseña"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenResetPasswordModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={adminResetPasswordMutation.isPending || !resetPasswordForm.userId}
              onClick={() => {
                if (!resetPasswordForm.userId) {
                  setAdminPasswordResetFeedback("Selecciona un usuario.");
                  return;
                }
                if (resetPasswordForm.newPassword.length < 8) {
                  setAdminPasswordResetFeedback("La contraseña debe tener al menos 8 caracteres.");
                  return;
                }
                if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
                  setAdminPasswordResetFeedback("La confirmación de contraseña no coincide.");
                  return;
                }
                setAdminPasswordResetFeedback(null);
                adminResetPasswordMutation.mutate({
                  userId: resetPasswordForm.userId,
                  newPassword: resetPasswordForm.newPassword
                });
              }}
            >
              {adminResetPasswordMutation.isPending ? "Guardando..." : "Resetear"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {!resetPasswordForm.userId ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Buscar usuario</span>
                <input
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  placeholder="Nombre o email..."
                  value={resetPasswordUserSearch}
                  onChange={(event) => setResetPasswordUserSearch(event.target.value)}
                />
              </label>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {userOptions
                  .filter((user) => {
                    const needle = resetPasswordUserSearch.trim().toLowerCase();
                    if (!needle) return true;
                    return (
                      user.fullName.toLowerCase().includes(needle) ||
                      user.email.toLowerCase().includes(needle)
                    );
                  })
                  .map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() =>
                          setResetPasswordForm((prev) => ({
                            ...prev,
                            userId: user.id,
                            fullName: user.fullName
                          }))
                        }
                      >
                        <span className="font-medium text-slate-900">{user.fullName}</span>
                        <span className="ml-2 text-xs text-slate-500">{user.email}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{resetPasswordForm.fullName}</p>
                  <p className="text-xs text-slate-500">Usuario seleccionado</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-700"
                  onClick={() =>
                    setResetPasswordForm((prev) => ({ ...prev, userId: "", fullName: "" }))
                  }
                >
                  Cambiar
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Nueva contraseña</span>
                <input
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  placeholder="Mínimo 8 caracteres"
                  value={resetPasswordForm.newPassword}
                  onChange={(event) => setResetPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Confirmar contraseña</span>
                <input
                  type="password"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  placeholder="Repite la contraseña"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(event) => setResetPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
              </label>
            </>
          )}
        </div>
        {adminPasswordResetFeedback ? (
          <p className={`text-sm ${adminResetPasswordMutation.isSuccess ? "text-emerald-700" : "text-red-600"}`}>
            {adminPasswordResetFeedback}
          </p>
        ) : null}
        {adminResetPasswordMutation.error ? <p className="text-sm text-red-600">{adminResetPasswordMutation.error.message}</p> : null}
      </UiModal>

      <UiModal
        open={openOffboardingModal}
        onClose={() => setOpenOffboardingModal(false)}
        title="Flujo de offboarding"
        widthClassName="max-w-4xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenOffboardingModal(false)}>
              Cerrar
            </Button>
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
          </>
        }
      >
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={offboardingForm.userId}
            onChange={(event) => setOffboardingForm((prev) => ({ ...prev, userId: event.target.value }))}
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
            onChange={(event) => setOffboardingForm((prev) => ({ ...prev, primaryTransferToUserId: event.target.value }))}
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
            onChange={(event) => setOffboardingForm((prev) => ({ ...prev, reason: event.target.value }))}
          />
        </div>

        {previewOffboardingMutation.error ? <p className="text-sm text-red-600">{previewOffboardingMutation.error.message}</p> : null}
        {executeOffboardingMutation.error ? <p className="text-sm text-red-600">{executeOffboardingMutation.error.message}</p> : null}

        {offboardingPreview ? (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-sm text-slate-700">
              Tareas activas: {offboardingPreview.activeTasks.length} · Roles de liderazgo: {offboardingPreview.leadershipProjects.length} · Documentos propietarios: {offboardingPreview.ownedDocuments.length}
            </p>
            {missingOffboardingAssignments > 0 ? (
              <p className="text-sm text-amber-700">Faltan {missingOffboardingAssignments} asignaciones por definir antes de ejecutar.</p>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Transferencia de tareas</p>
              {offboardingPreview.activeTasks.map((task) => (
                <div key={task.id} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_220px]">
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
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Transferencia de liderazgo</p>
              {offboardingPreview.leadershipProjects.map((project) => (
                <div key={project.projectId} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_220px]">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{project.projectName}</p>
                    <p className="text-xs text-slate-600">{project.role}</p>
                  </div>
                  <select
                    className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                    value={offboardingTransfers.leadership[project.projectId] ?? offboardingForm.primaryTransferToUserId}
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
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Transferencia de documentos</p>
              {offboardingPreview.ownedDocuments.map((document) => (
                <div key={document.fileId} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_220px]">
                  <p className="text-sm font-medium text-slate-900">{document.originalName}</p>
                  <select
                    className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                    value={offboardingTransfers.documents[document.fileId] ?? offboardingForm.primaryTransferToUserId}
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
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </UiModal>

      <UiModal
        open={openInternalInviteModal}
        onClose={() => setOpenInternalInviteModal(false)}
        title="Invitación interna"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenInternalInviteModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createInternalInviteMutation.isPending || !internalInviteForm.email || !internalInviteForm.expiresAt}
              onClick={() => createInternalInviteMutation.mutate()}
            >
              {createInternalInviteMutation.isPending ? "Generando..." : "Generar enlace"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-500">
          Aquí no defines contraseña. La persona invitada la crea al abrir el enlace de activación.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Email corporativo</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="usuario@empresa.com"
              value={internalInviteForm.email}
              onChange={(event) => setInternalInviteForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Rol base</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={internalInviteForm.baseRole}
              onChange={(event) => setInternalInviteForm((prev) => ({ ...prev, baseRole: event.target.value as RoleCode }))}
            >
              {roleOptions.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Equipo (opcional)</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={internalInviteForm.teamId}
              onChange={(event) => setInternalInviteForm((prev) => ({ ...prev, teamId: event.target.value }))}
            >
              <option value="">Sin equipo</option>
              {teamsQuery.data?.items.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Fecha de expiración</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              type="datetime-local"
              value={internalInviteForm.expiresAt}
              onChange={(event) => setInternalInviteForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
            />
          </label>
        </div>
        {createInternalInviteMutation.error ? <p className="text-sm text-red-600">{createInternalInviteMutation.error.message}</p> : null}
      </UiModal>

      <UiModal
        open={openExternalInviteModal}
        onClose={() => setOpenExternalInviteModal(false)}
        title="Invitación externa"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenExternalInviteModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createInviteMutation.isPending || !inviteForm.email || !inviteForm.resourceScopeId || !inviteForm.expiresAt}
              onClick={() => createInviteMutation.mutate()}
            >
              {createInviteMutation.isPending ? "Generando..." : "Generar enlace"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-500">
          La invitación externa usa enlace temporal al recurso. No crea cuenta interna ni contraseña.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Email invitado externo"
            value={inviteForm.email}
            onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Proyecto</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={inviteForm.resourceScopeId}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, resourceScopeId: event.target.value }))}
            >
              <option value="">Selecciona un proyecto</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-medium text-slate-600">Fecha de expiración</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              type="datetime-local"
              value={inviteForm.expiresAt}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
            />
          </label>
        </div>
        {createInviteMutation.error ? <p className="text-sm text-red-600">{createInviteMutation.error.message}</p> : null}
      </UiModal>

      <UiModal
        open={openCreateTeamModal}
        onClose={() => setOpenCreateTeamModal(false)}
        title="Crear equipo"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenCreateTeamModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createTeamMutation.isPending || !createTeamForm.name}
              onClick={() => createTeamMutation.mutate()}
            >
              {createTeamMutation.isPending ? "Creando..." : "Crear equipo"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Nombre del equipo</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Ej. Equipo Backend"
              value={createTeamForm.name}
              onChange={(event) => setCreateTeamForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Descripción (opcional)</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder="Descripción breve"
              value={createTeamForm.description}
              onChange={(event) => setCreateTeamForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Coordinador (opcional)</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={createTeamForm.coordinatorUserId}
              onChange={(event) => setCreateTeamForm((prev) => ({ ...prev, coordinatorUserId: event.target.value }))}
            >
              <option value="">Sin coordinador</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {createTeamMutation.error ? <p className="text-sm text-red-600">{createTeamMutation.error.message}</p> : null}
      </UiModal>

      <UiModal
        open={openAccessModal}
        onClose={() => setOpenAccessModal(false)}
        title="Consultar accesos por proyecto"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenAccessModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={accessLookupMutation.isPending || !accessLookupForm.projectId}
              onClick={() => accessLookupMutation.mutate()}
            >
              Consultar acceso
            </Button>
          </>
        }
      >
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Proyecto</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            value={accessLookupForm.projectId}
            onChange={(event) => setAccessLookupForm({ projectId: event.target.value })}
          >
            <option value="">Selecciona un proyecto</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        {accessLookupMutation.error ? <p className="text-sm text-red-600">{accessLookupMutation.error.message}</p> : null}
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
      </UiModal>

      <UiModal
        open={openDatabaseBackupModal}
        onClose={() => {
          setOpenDatabaseBackupModal(false);
          setDatabaseBackupPassword("");
        }}
        title="Generar backup de base de datos"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpenDatabaseBackupModal(false);
                setDatabaseBackupPassword("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={databaseBackupMutation.isPending || !databaseBackupPassword}
              onClick={() => databaseBackupMutation.mutate()}
            >
              {databaseBackupMutation.isPending ? "Generando..." : "Generar y descargar"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-500">
          Para generar el backup, confirma la operación con tu contraseña actual de administrador.
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Contraseña de administrador</span>
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            type="password"
            autoComplete="current-password"
            value={databaseBackupPassword}
            onChange={(event) => setDatabaseBackupPassword(event.target.value)}
            placeholder="Ingresa tu contraseña"
          />
        </label>
        {databaseBackupMutation.error ? (
          <p className="text-sm text-red-600">{databaseBackupMutation.error.message}</p>
        ) : null}
      </UiModal>


      <UiModal
        open={openAuditModal}
        onClose={() => setOpenAuditModal(false)}
        title="Reporte de auditoría"
        widthClassName="max-w-5xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpenAuditModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={auditReportQuery.isFetching}
              onClick={() => auditReportQuery.refetch()}
            >
              Filtrar
            </Button>
            <Button type="button" onClick={runAuditExport}>
              Descargar CSV
            </Button>
          </>
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Desde</span>
            <input
              type="datetime-local"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={auditFilters.from}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, from: event.target.value, page: 1 }))}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Hasta</span>
            <input
              type="datetime-local"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              value={auditFilters.to}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, to: event.target.value, page: 1 }))}
            />
          </label>
        </div>

        {auditReportQuery.error ? <p className="text-sm text-red-600">{auditReportQuery.error.message}</p> : null}
        {auditReportQuery.isLoading ? <p className="text-sm text-slate-600">Cargando auditoría...</p> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Razón</th>
              </tr>
            </thead>
            <tbody>
              {auditReportQuery.data?.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(item.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">{item.actorName ?? (item.userId ? item.userId : "Sistema")}</td>
                  <td className="px-3 py-2 text-slate-700">{item.entityType}</td>
                  <td className="px-3 py-2 text-slate-700">{item.action}</td>
                  <td className="px-3 py-2 text-slate-700">{item.reason ?? item.reasonCatalogId ?? "-"}</td>
                </tr>
              ))}
              {!auditReportQuery.data || auditReportQuery.data.items.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                    Sin eventos para el rango seleccionado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {auditReportQuery.data ? (
          <div className="flex items-center justify-between text-xs text-slate-600">
            <p>
              Página {auditReportQuery.data.page} · Total {auditReportQuery.data.total}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3 text-xs"
                disabled={auditFilters.page <= 1}
                onClick={() => setAuditFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3 text-xs"
                disabled={auditFilters.page * auditFilters.pageSize >= auditReportQuery.data.total}
                onClick={() => setAuditFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </UiModal>
    </div>
  );
};
