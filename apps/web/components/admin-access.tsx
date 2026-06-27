"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

type CatalogItem = {
  id: string;
  code: string;
  numericCode: number;
  displayName: string;
  description: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
};

type ProgramItem = CatalogItem & {
  route: string | null;
  icon: string | null;
  navOrder: number;
  isNavItem: boolean;
};
type ResourceItem = CatalogItem;
type ActionItem = CatalogItem & { kind: "read" | "write" };

type PermissionItem = {
  id: string;
  code: string;
  resource: string;
  resourceDisplayName: string;
  action: string;
  actionDisplayName: string;
  actionKind: "read" | "write";
  displayName: string;
  description: string | null;
  categoryCode: string;
  categoryDisplayName: string;
  categorySortOrder: number;
  programCode: string;
  programDisplayName: string;
  isSystem: boolean;
  isActive: boolean;
};

type RoleAccessItem = {
  id: string;
  code: string;
  displayName: string;
  isSystem: boolean;
  programs: Array<{
    id: string;
    code: string;
    displayName: string;
    isActive: boolean;
  }>;
  permissions: Array<{
    id: string;
    code: string;
    displayName: string;
    programCode: string;
    categoryCode: string;
    isActive: boolean;
  }>;
};

type TabKey = "programs" | "resources" | "actions" | "permissions" | "roles";

type CatalogEditForm = {
  id: string;
  displayName: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

export const AdminAccessView = () => {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("programs");

  const [programCreateForm, setProgramCreateForm] = useState({
    code: "",
    displayName: "",
    description: "",
    sortOrder: "0",
    route: "",
    navOrder: "0",
    isNavItem: false
  });
  const [programEditForm, setProgramEditForm] = useState<
    (CatalogEditForm & { route: string; navOrder: string; isNavItem: boolean }) | null
  >(null);

  const [resourceCreateForm, setResourceCreateForm] = useState({
    code: "",
    displayName: "",
    description: "",
    sortOrder: "0"
  });
  const [resourceEditForm, setResourceEditForm] = useState<CatalogEditForm | null>(null);

  const [actionCreateForm, setActionCreateForm] = useState({
    code: "",
    displayName: "",
    description: "",
    kind: "write" as "read" | "write",
    sortOrder: "0"
  });
  const [actionEditForm, setActionEditForm] = useState<(CatalogEditForm & { kind: "read" | "write" }) | null>(
    null
  );

  const [permissionCreateForm, setPermissionCreateForm] = useState({
    resource: "",
    action: "",
    displayName: "",
    description: "",
    categoryCode: "",
    programCode: ""
  });
  const [permissionEditForm, setPermissionEditForm] = useState<{
    id: string;
    displayName: string;
    description: string;
    categoryCode: string;
    programCode: string;
    isActive: boolean;
  } | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedProgramCodes, setSelectedProgramCodes] = useState<string[]>([]);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);

  const programsQuery = useQuery({
    queryKey: ["admin-access-programs"],
    queryFn: () => apiRequest<ProgramItem[]>("/admin/programs?includeInactive=true")
  });

  const resourcesQuery = useQuery({
    queryKey: ["admin-access-resources"],
    queryFn: () => apiRequest<ResourceItem[]>("/admin/resources?includeInactive=true")
  });

  const actionsQuery = useQuery({
    queryKey: ["admin-access-actions"],
    queryFn: () => apiRequest<ActionItem[]>("/admin/actions?includeInactive=true")
  });

  const permissionsQuery = useQuery({
    queryKey: ["admin-access-permissions"],
    queryFn: () => apiRequest<PermissionItem[]>("/admin/permissions?includeInactive=true")
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-access-categories"],
    queryFn: async () => {
      const categories = await apiRequest<
        Array<{
          id: string;
          code: string;
          displayName: string;
          sortOrder: number;
        }>
      >("/admin/permission-categories");
      return categories.map((item) => ({
        id: item.id,
        code: item.code,
        displayName: item.displayName,
        sortOrder: item.sortOrder
      }));
    }
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-access-roles"],
    queryFn: () => apiRequest<RoleAccessItem[]>("/admin/roles")
  });

  useEffect(() => {
    if (!rolesQuery.data || rolesQuery.data.length === 0) {
      return;
    }
    if (!selectedRoleId) {
      setSelectedRoleId(rolesQuery.data[0]!.id);
    }
  }, [rolesQuery.data, selectedRoleId]);

  const selectedRole = useMemo(
    () => rolesQuery.data?.find((role) => role.id === selectedRoleId) ?? null,
    [rolesQuery.data, selectedRoleId]
  );

  useEffect(() => {
    if (!selectedRole) {
      setSelectedProgramCodes([]);
      setSelectedPermissionCodes([]);
      return;
    }
    setSelectedProgramCodes(selectedRole.programs.map((program) => program.code));
    setSelectedPermissionCodes(selectedRole.permissions.map((permission) => permission.code));
  }, [selectedRole]);

  const activePrograms = useMemo(
    () => (programsQuery.data ?? []).filter((program) => program.isActive),
    [programsQuery.data]
  );

  const activeResources = useMemo(
    () => (resourcesQuery.data ?? []).filter((resource) => resource.isActive),
    [resourcesQuery.data]
  );

  const activeActions = useMemo(
    () => (actionsQuery.data ?? []).filter((action) => action.isActive),
    [actionsQuery.data]
  );

  const activePermissions = useMemo(
    () => (permissionsQuery.data ?? []).filter((permission) => permission.isActive),
    [permissionsQuery.data]
  );

  // Orden y etiquetas de las columnas de acción provienen de la tabla Action (DB).
  const actionOrder = useMemo(
    () => new Map((actionsQuery.data ?? []).map((action) => [action.code, action.sortOrder])),
    [actionsQuery.data]
  );
  const actionLabel = useMemo(
    () => new Map((actionsQuery.data ?? []).map((action) => [action.code, action.displayName])),
    [actionsQuery.data]
  );

  const permissionMatrix = useMemo(() => {
    const byResource = new Map<string, Map<string, PermissionItem>>();
    const resourceLabel = new Map<string, string>();
    const actionSet = new Set<string>();
    for (const permission of activePermissions) {
      actionSet.add(permission.action);
      resourceLabel.set(permission.resource, permission.resourceDisplayName);
      let row = byResource.get(permission.resource);
      if (!row) {
        row = new Map<string, PermissionItem>();
        byResource.set(permission.resource, row);
      }
      row.set(permission.action, permission);
    }
    const actions = [...actionSet].sort(
      (a, b) => (actionOrder.get(a) ?? 99) - (actionOrder.get(b) ?? 99) || a.localeCompare(b)
    );
    const resources = [...byResource.keys()].sort((a, b) =>
      (resourceLabel.get(a) ?? a).localeCompare(resourceLabel.get(b) ?? b)
    );
    return { actions, resources, byResource, resourceLabel };
  }, [activePermissions, actionOrder]);

  useEffect(() => {
    if (permissionCreateForm.categoryCode) {
      return;
    }
    const firstCategory = categoriesQuery.data?.[0];
    if (!firstCategory) {
      return;
    }
    setPermissionCreateForm((prev) => ({ ...prev, categoryCode: firstCategory.code }));
  }, [categoriesQuery.data, permissionCreateForm.categoryCode]);

  useEffect(() => {
    if (permissionCreateForm.programCode) {
      return;
    }
    const firstProgram = activePrograms[0];
    if (!firstProgram) {
      return;
    }
    setPermissionCreateForm((prev) => ({ ...prev, programCode: firstProgram.code }));
  }, [activePrograms, permissionCreateForm.programCode]);

  useEffect(() => {
    if (permissionCreateForm.resource) {
      return;
    }
    const firstResource = activeResources[0];
    if (!firstResource) {
      return;
    }
    setPermissionCreateForm((prev) => ({ ...prev, resource: firstResource.code }));
  }, [activeResources, permissionCreateForm.resource]);

  useEffect(() => {
    if (permissionCreateForm.action) {
      return;
    }
    const firstAction = activeActions[0];
    if (!firstAction) {
      return;
    }
    setPermissionCreateForm((prev) => ({ ...prev, action: firstAction.code }));
  }, [activeActions, permissionCreateForm.action]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-access-programs"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-access-resources"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-access-actions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-access-permissions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-access-roles"] })
    ]);
  };

  const createProgramMutation = useMutation({
    mutationFn: () =>
      apiRequest<ProgramItem>("/admin/programs", {
        method: "POST",
        body: JSON.stringify({
          ...(programCreateForm.code.trim() ? { code: programCreateForm.code.trim() } : {}),
          displayName: programCreateForm.displayName.trim(),
          description: programCreateForm.description.trim() || undefined,
          sortOrder: Number.parseInt(programCreateForm.sortOrder || "0", 10),
          route: programCreateForm.route.trim() || null,
          navOrder: Number.parseInt(programCreateForm.navOrder || "0", 10),
          isNavItem: programCreateForm.isNavItem
        })
      }),
    onSuccess: async () => {
      setProgramCreateForm({
        code: "",
        displayName: "",
        description: "",
        sortOrder: "0",
        route: "",
        navOrder: "0",
        isNavItem: false
      });
      await refreshAll();
    }
  });

  const updateProgramMutation = useMutation({
    mutationFn: (input: NonNullable<typeof programEditForm>) =>
      apiRequest<ProgramItem>(`/admin/programs/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: input.displayName.trim(),
          description: input.description.trim() || null,
          sortOrder: Number.parseInt(input.sortOrder || "0", 10),
          route: input.route.trim() || null,
          navOrder: Number.parseInt(input.navOrder || "0", 10),
          isNavItem: input.isNavItem,
          isActive: input.isActive
        })
      }),
    onSuccess: async () => {
      setProgramEditForm(null);
      await refreshAll();
    }
  });

  const deactivateProgramMutation = useMutation({
    mutationFn: (programId: string) =>
      apiRequest(`/admin/programs/${programId}`, {
        method: "DELETE"
      }),
    onSuccess: refreshAll
  });

  const createResourceMutation = useMutation({
    mutationFn: () =>
      apiRequest<ResourceItem>("/admin/resources", {
        method: "POST",
        body: JSON.stringify({
          ...(resourceCreateForm.code.trim() ? { code: resourceCreateForm.code.trim() } : {}),
          displayName: resourceCreateForm.displayName.trim(),
          description: resourceCreateForm.description.trim() || undefined,
          sortOrder: Number.parseInt(resourceCreateForm.sortOrder || "0", 10)
        })
      }),
    onSuccess: async () => {
      setResourceCreateForm({ code: "", displayName: "", description: "", sortOrder: "0" });
      await refreshAll();
    }
  });

  const updateResourceMutation = useMutation({
    mutationFn: (input: NonNullable<typeof resourceEditForm>) =>
      apiRequest<ResourceItem>(`/admin/resources/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: input.displayName.trim(),
          description: input.description.trim() || null,
          sortOrder: Number.parseInt(input.sortOrder || "0", 10),
          isActive: input.isActive
        })
      }),
    onSuccess: async () => {
      setResourceEditForm(null);
      await refreshAll();
    }
  });

  const deactivateResourceMutation = useMutation({
    mutationFn: (resourceId: string) =>
      apiRequest(`/admin/resources/${resourceId}`, { method: "DELETE" }),
    onSuccess: refreshAll
  });

  const createActionMutation = useMutation({
    mutationFn: () =>
      apiRequest<ActionItem>("/admin/actions", {
        method: "POST",
        body: JSON.stringify({
          ...(actionCreateForm.code.trim() ? { code: actionCreateForm.code.trim() } : {}),
          displayName: actionCreateForm.displayName.trim(),
          description: actionCreateForm.description.trim() || undefined,
          kind: actionCreateForm.kind,
          sortOrder: Number.parseInt(actionCreateForm.sortOrder || "0", 10)
        })
      }),
    onSuccess: async () => {
      setActionCreateForm({ code: "", displayName: "", description: "", kind: "write", sortOrder: "0" });
      await refreshAll();
    }
  });

  const updateActionMutation = useMutation({
    mutationFn: (input: NonNullable<typeof actionEditForm>) =>
      apiRequest<ActionItem>(`/admin/actions/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: input.displayName.trim(),
          description: input.description.trim() || null,
          kind: input.kind,
          sortOrder: Number.parseInt(input.sortOrder || "0", 10),
          isActive: input.isActive
        })
      }),
    onSuccess: async () => {
      setActionEditForm(null);
      await refreshAll();
    }
  });

  const deactivateActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      apiRequest(`/admin/actions/${actionId}`, { method: "DELETE" }),
    onSuccess: refreshAll
  });

  const createPermissionMutation = useMutation({
    mutationFn: () =>
      apiRequest<PermissionItem>("/admin/permissions", {
        method: "POST",
        body: JSON.stringify({
          resource: permissionCreateForm.resource.trim(),
          action: permissionCreateForm.action.trim(),
          displayName: permissionCreateForm.displayName.trim(),
          description: permissionCreateForm.description.trim() || undefined,
          categoryCode: permissionCreateForm.categoryCode,
          programCode: permissionCreateForm.programCode
        })
      }),
    onSuccess: async () => {
      setPermissionCreateForm((prev) => ({
        ...prev,
        resource: "",
        action: "",
        displayName: "",
        description: ""
      }));
      await refreshAll();
    }
  });

  const updatePermissionMutation = useMutation({
    mutationFn: (input: NonNullable<typeof permissionEditForm>) =>
      apiRequest<PermissionItem>(`/admin/permissions/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: input.displayName.trim(),
          description: input.description.trim() || null,
          categoryCode: input.categoryCode,
          programCode: input.programCode,
          isActive: input.isActive
        })
      }),
    onSuccess: async () => {
      setPermissionEditForm(null);
      await refreshAll();
    }
  });

  const deactivatePermissionMutation = useMutation({
    mutationFn: (permissionId: string) =>
      apiRequest(`/admin/permissions/${permissionId}`, {
        method: "DELETE"
      }),
    onSuccess: refreshAll
  });

  const saveRoleAccessMutation = useMutation({
    mutationFn: () => {
      if (!selectedRoleId) {
        throw new Error("Selecciona un rol");
      }
      return apiRequest(`/admin/roles/${selectedRoleId}/access`, {
        method: "PUT",
        body: JSON.stringify({
          programCodes: selectedProgramCodes,
          permissionCodes: selectedPermissionCodes
        })
      });
    },
    onSuccess: refreshAll
  });

  const toggleCode = (
    code: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  };

  const setManyPermissionCodes = (codes: string[], enabled: boolean) => {
    setSelectedPermissionCodes((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (enabled) {
          next.add(code);
        } else {
          next.delete(code);
        }
      }
      return [...next];
    });
  };

  const toggleActionColumn = (action: string) => {
    const codes = activePermissions.filter((permission) => permission.action === action).map((permission) => permission.code);
    const allSelected = codes.every((code) => selectedPermissionCodes.includes(code));
    setManyPermissionCodes(codes, !allSelected);
  };

  const readPermissionCodes = useMemo(
    () => activePermissions.filter((permission) => permission.actionKind === "read").map((permission) => permission.code),
    [activePermissions]
  );
  const writePermissionCodes = useMemo(
    () => activePermissions.filter((permission) => permission.actionKind !== "read").map((permission) => permission.code),
    [activePermissions]
  );

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
        <p className="text-sm text-mid">Solo el rol Administrador puede acceder a esta vista.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-mid">Administración</p>
        <h1 className="text-2xl font-semibold text-ink">Accesos</h1>
        <p className="text-sm text-mid">
          Gestiona programas, recursos, acciones, permisos y su asignación por rol.
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            {...(activeTab === "programs" ? {} : { variant: "ghost" as const })}
            onClick={() => setActiveTab("programs")}
          >
            Programas
          </Button>
          <Button
            type="button"
            {...(activeTab === "resources" ? {} : { variant: "ghost" as const })}
            onClick={() => setActiveTab("resources")}
          >
            Recursos
          </Button>
          <Button
            type="button"
            {...(activeTab === "actions" ? {} : { variant: "ghost" as const })}
            onClick={() => setActiveTab("actions")}
          >
            Acciones
          </Button>
          <Button
            type="button"
            {...(activeTab === "permissions" ? {} : { variant: "ghost" as const })}
            onClick={() => setActiveTab("permissions")}
          >
            Permisos
          </Button>
          <Button
            type="button"
            {...(activeTab === "roles" ? {} : { variant: "ghost" as const })}
            onClick={() => setActiveTab("roles")}
          >
            Roles
          </Button>
        </div>

        {activeTab === "programs" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Código (opcional)"
                value={programCreateForm.code}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Nombre"
                value={programCreateForm.displayName}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Descripción"
                value={programCreateForm.description}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                  placeholder="Orden"
                  value={programCreateForm.sortOrder}
                  onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                />
                <Button
                  type="button"
                  disabled={createProgramMutation.isPending || !programCreateForm.displayName.trim()}
                  onClick={() => createProgramMutation.mutate()}
                >
                  Crear
                </Button>
              </div>
            </div>

            <div className="grid items-center gap-3 md:grid-cols-3">
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Ruta de menú (ej. /call)"
                value={programCreateForm.route}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, route: event.target.value }))}
              />
              <input
                type="number"
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Orden en menú"
                value={programCreateForm.navOrder}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, navOrder: event.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={programCreateForm.isNavItem}
                  onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, isNavItem: event.target.checked }))}
                />
                Mostrar en el menú
              </label>
            </div>

            {createProgramMutation.error ? (
              <p className="text-sm text-urgent">{createProgramMutation.error.message}</p>
            ) : null}

            <div className="space-y-2">
              {(programsQuery.data ?? []).map((program) => (
                <div key={program.id} className="rounded-xl border border-line p-3">
                  {programEditForm?.id === program.id ? (
                    <div className="grid gap-2 md:grid-cols-7">
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={programEditForm.displayName}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                        }
                      />
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={programEditForm.description}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                        }
                      />
                      <input
                        type="number"
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={programEditForm.sortOrder}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, sortOrder: event.target.value } : prev))
                        }
                      />
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        placeholder="Ruta menú"
                        value={programEditForm.route}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, route: event.target.value } : prev))
                        }
                      />
                      <input
                        type="number"
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        placeholder="Orden menú"
                        value={programEditForm.navOrder}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, navOrder: event.target.value } : prev))
                        }
                      />
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={programEditForm.isNavItem}
                          onChange={(event) =>
                            setProgramEditForm((prev) => (prev ? { ...prev, isNavItem: event.target.checked } : prev))
                          }
                        />
                        Menú
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={programEditForm.isActive}
                          onChange={(event) =>
                            setProgramEditForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                          }
                        />
                        Activo
                      </label>
                      <div className="flex gap-2">
                        <Button type="button" onClick={() => updateProgramMutation.mutate(programEditForm)}>
                          Guardar
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setProgramEditForm(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{program.displayName}</p>
                        <p className="text-xs text-mid">
                          {program.code} · orden {program.sortOrder} · {program.isActive ? "activo" : "inactivo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setProgramEditForm({
                              id: program.id,
                              displayName: program.displayName,
                              description: program.description ?? "",
                              sortOrder: String(program.sortOrder),
                              route: program.route ?? "",
                              navOrder: String(program.navOrder),
                              isNavItem: program.isNavItem,
                              isActive: program.isActive
                            })
                          }
                        >
                          Editar
                        </Button>
                        {!program.isSystem ? (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={deactivateProgramMutation.isPending || !program.isActive}
                            onClick={() => deactivateProgramMutation.mutate(program.id)}
                          >
                            Desactivar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "resources" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Código (opcional)"
                value={resourceCreateForm.code}
                onChange={(event) => setResourceCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Nombre"
                value={resourceCreateForm.displayName}
                onChange={(event) => setResourceCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Descripción"
                value={resourceCreateForm.description}
                onChange={(event) => setResourceCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                  placeholder="Orden"
                  value={resourceCreateForm.sortOrder}
                  onChange={(event) => setResourceCreateForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                />
                <Button
                  type="button"
                  disabled={createResourceMutation.isPending || !resourceCreateForm.displayName.trim()}
                  onClick={() => createResourceMutation.mutate()}
                >
                  Crear
                </Button>
              </div>
            </div>

            {createResourceMutation.error ? (
              <p className="text-sm text-urgent">{createResourceMutation.error.message}</p>
            ) : null}

            <div className="space-y-2">
              {(resourcesQuery.data ?? []).map((resource) => (
                <div key={resource.id} className="rounded-xl border border-line p-3">
                  {resourceEditForm?.id === resource.id ? (
                    <div className="grid gap-2 md:grid-cols-5">
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={resourceEditForm.displayName}
                        onChange={(event) =>
                          setResourceEditForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                        }
                      />
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={resourceEditForm.description}
                        onChange={(event) =>
                          setResourceEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                        }
                      />
                      <input
                        type="number"
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={resourceEditForm.sortOrder}
                        onChange={(event) =>
                          setResourceEditForm((prev) => (prev ? { ...prev, sortOrder: event.target.value } : prev))
                        }
                      />
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={resourceEditForm.isActive}
                          onChange={(event) =>
                            setResourceEditForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                          }
                        />
                        Activo
                      </label>
                      <div className="flex gap-2">
                        <Button type="button" onClick={() => updateResourceMutation.mutate(resourceEditForm)}>
                          Guardar
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setResourceEditForm(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{resource.displayName}</p>
                        <p className="text-xs text-mid">
                          {resource.code} · orden {resource.sortOrder} · {resource.isActive ? "activo" : "inactivo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setResourceEditForm({
                              id: resource.id,
                              displayName: resource.displayName,
                              description: resource.description ?? "",
                              sortOrder: String(resource.sortOrder),
                              isActive: resource.isActive
                            })
                          }
                        >
                          Editar
                        </Button>
                        {!resource.isSystem ? (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={deactivateResourceMutation.isPending || !resource.isActive}
                            onClick={() => deactivateResourceMutation.mutate(resource.id)}
                          >
                            Desactivar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "actions" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Código (opcional)"
                value={actionCreateForm.code}
                onChange={(event) => setActionCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Nombre"
                value={actionCreateForm.displayName}
                onChange={(event) => setActionCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
              <select
                className="h-10 rounded-xl border border-line px-3 text-sm"
                value={actionCreateForm.kind}
                onChange={(event) =>
                  setActionCreateForm((prev) => ({ ...prev, kind: event.target.value as "read" | "write" }))
                }
              >
                <option value="read">Lectura</option>
                <option value="write">Escritura</option>
              </select>
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Descripción"
                value={actionCreateForm.description}
                onChange={(event) => setActionCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                  placeholder="Orden"
                  value={actionCreateForm.sortOrder}
                  onChange={(event) => setActionCreateForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                />
                <Button
                  type="button"
                  disabled={createActionMutation.isPending || !actionCreateForm.displayName.trim()}
                  onClick={() => createActionMutation.mutate()}
                >
                  Crear
                </Button>
              </div>
            </div>

            {createActionMutation.error ? (
              <p className="text-sm text-urgent">{createActionMutation.error.message}</p>
            ) : null}

            <div className="space-y-2">
              {(actionsQuery.data ?? []).map((action) => (
                <div key={action.id} className="rounded-xl border border-line p-3">
                  {actionEditForm?.id === action.id ? (
                    <div className="grid gap-2 md:grid-cols-6">
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={actionEditForm.displayName}
                        onChange={(event) =>
                          setActionEditForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={actionEditForm.kind}
                        onChange={(event) =>
                          setActionEditForm((prev) =>
                            prev ? { ...prev, kind: event.target.value as "read" | "write" } : prev
                          )
                        }
                      >
                        <option value="read">Lectura</option>
                        <option value="write">Escritura</option>
                      </select>
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={actionEditForm.description}
                        onChange={(event) =>
                          setActionEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                        }
                      />
                      <input
                        type="number"
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={actionEditForm.sortOrder}
                        onChange={(event) =>
                          setActionEditForm((prev) => (prev ? { ...prev, sortOrder: event.target.value } : prev))
                        }
                      />
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={actionEditForm.isActive}
                          onChange={(event) =>
                            setActionEditForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                          }
                        />
                        Activo
                      </label>
                      <div className="flex gap-2">
                        <Button type="button" onClick={() => updateActionMutation.mutate(actionEditForm)}>
                          Guardar
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setActionEditForm(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{action.displayName}</p>
                        <p className="text-xs text-mid">
                          {action.code} · {action.kind === "read" ? "lectura" : "escritura"} · orden{" "}
                          {action.sortOrder} · {action.isActive ? "activo" : "inactivo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setActionEditForm({
                              id: action.id,
                              displayName: action.displayName,
                              description: action.description ?? "",
                              kind: action.kind,
                              sortOrder: String(action.sortOrder),
                              isActive: action.isActive
                            })
                          }
                        >
                          Editar
                        </Button>
                        {!action.isSystem ? (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={deactivateActionMutation.isPending || !action.isActive}
                            onClick={() => deactivateActionMutation.mutate(action.id)}
                          >
                            Desactivar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "permissions" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-6">
              <select
                className="h-10 rounded-xl border border-line px-3 text-sm"
                value={permissionCreateForm.resource}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, resource: event.target.value }))}
              >
                {activeResources.map((resource) => (
                  <option key={resource.id} value={resource.code}>
                    {resource.displayName}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-xl border border-line px-3 text-sm"
                value={permissionCreateForm.action}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, action: event.target.value }))}
              >
                {activeActions.map((action) => (
                  <option key={action.id} value={action.code}>
                    {action.displayName}
                  </option>
                ))}
              </select>
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Nombre"
                value={permissionCreateForm.displayName}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Descripción"
                value={permissionCreateForm.description}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <select
                className="h-10 rounded-xl border border-line px-3 text-sm"
                value={permissionCreateForm.categoryCode}
                onChange={(event) =>
                  setPermissionCreateForm((prev) => ({ ...prev, categoryCode: event.target.value }))
                }
              >
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.code}>
                    {category.displayName}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                  value={permissionCreateForm.programCode}
                  onChange={(event) =>
                    setPermissionCreateForm((prev) => ({ ...prev, programCode: event.target.value }))
                  }
                >
                  {activePrograms.map((program) => (
                    <option key={program.id} value={program.code}>
                      {program.displayName}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  disabled={
                    createPermissionMutation.isPending ||
                    !permissionCreateForm.displayName.trim() ||
                    !permissionCreateForm.resource.trim() ||
                    !permissionCreateForm.action.trim()
                  }
                  onClick={() => createPermissionMutation.mutate()}
                >
                  Crear
                </Button>
              </div>
            </div>

            {createPermissionMutation.error ? (
              <p className="text-sm text-urgent">{createPermissionMutation.error.message}</p>
            ) : null}

            <div className="space-y-2">
              {(permissionsQuery.data ?? []).map((permission) => (
                <div key={permission.id} className="rounded-xl border border-line p-3">
                  {permissionEditForm?.id === permission.id ? (
                    <div className="grid gap-2 md:grid-cols-6">
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={permissionEditForm.displayName}
                        onChange={(event) =>
                          setPermissionEditForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                        }
                      />
                      <input
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={permissionEditForm.description}
                        onChange={(event) =>
                          setPermissionEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={permissionEditForm.categoryCode}
                        onChange={(event) =>
                          setPermissionEditForm((prev) => (prev ? { ...prev, categoryCode: event.target.value } : prev))
                        }
                      >
                        {(categoriesQuery.data ?? []).map((category) => (
                          <option key={category.id} value={category.code}>
                            {category.displayName}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 rounded-md border border-line px-2 text-sm"
                        value={permissionEditForm.programCode}
                        onChange={(event) =>
                          setPermissionEditForm((prev) => (prev ? { ...prev, programCode: event.target.value } : prev))
                        }
                      >
                        {activePrograms.map((program) => (
                          <option key={program.id} value={program.code}>
                            {program.displayName}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={permissionEditForm.isActive}
                          onChange={(event) =>
                            setPermissionEditForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                          }
                        />
                        Activo
                      </label>
                      <div className="flex gap-2">
                        <Button type="button" onClick={() => updatePermissionMutation.mutate(permissionEditForm)}>
                          Guardar
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setPermissionEditForm(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{permission.displayName}</p>
                        <p className="text-xs text-mid">
                          {permission.code} · {permission.programDisplayName} · {permission.categoryDisplayName} · {permission.isActive ? "activo" : "inactivo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setPermissionEditForm({
                              id: permission.id,
                              displayName: permission.displayName,
                              description: permission.description ?? "",
                              categoryCode: permission.categoryCode,
                              programCode: permission.programCode,
                              isActive: permission.isActive
                            })
                          }
                        >
                          Editar
                        </Button>
                        {!permission.isSystem ? (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={deactivatePermissionMutation.isPending || !permission.isActive}
                            onClick={() => deactivatePermissionMutation.mutate(permission.id)}
                          >
                            Desactivar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "roles" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="h-10 min-w-72 rounded-xl border border-line px-3 text-sm"
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
              >
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.displayName}
                  </option>
                ))}
              </select>
              <Button type="button" disabled={!selectedRoleId || saveRoleAccessMutation.isPending} onClick={() => saveRoleAccessMutation.mutate()}>
                Guardar accesos
              </Button>
            </div>

            {saveRoleAccessMutation.error ? (
              <p className="text-sm text-urgent">{saveRoleAccessMutation.error.message}</p>
            ) : null}

            <div className="space-y-4">
              <div className="rounded-xl border border-line p-3">
                <p className="mb-2 text-sm font-semibold text-ink">Programas</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {activePrograms.map((program) => (
                    <label key={program.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={selectedProgramCodes.includes(program.code)}
                        onChange={() => toggleCode(program.code, setSelectedProgramCodes)}
                      />
                      <span>{program.displayName}</span>
                      <span className="text-xs text-mid">({program.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Permisos por recurso y acción</p>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      className="text-mid underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => setManyPermissionCodes(readPermissionCodes, true)}
                    >
                      Marcar lectura
                    </button>
                    <button
                      type="button"
                      className="text-mid underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => setManyPermissionCodes(writePermissionCodes, true)}
                    >
                      Marcar escritura
                    </button>
                    <button
                      type="button"
                      className="text-mid underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => setSelectedPermissionCodes([])}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-xs font-semibold text-mid">
                          Recurso
                        </th>
                        {permissionMatrix.actions.map((action) => (
                          <th key={action} className="px-2 py-2 text-center text-xs font-semibold text-mid">
                            <button
                              type="button"
                              className="hover:text-ink"
                              onClick={() => toggleActionColumn(action)}
                            >
                              {actionLabel.get(action) ?? action}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {permissionMatrix.resources.map((resource) => {
                        const row = permissionMatrix.byResource.get(resource);
                        const resourceLabel = permissionMatrix.resourceLabel.get(resource) ?? resource;
                        return (
                          <tr key={resource} className="border-b border-line last:border-0">
                            <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-ink">{resourceLabel}</td>
                            {permissionMatrix.actions.map((action) => {
                              const permission = row?.get(action);
                              if (!permission) {
                                return (
                                  <td key={action} className="px-2 py-1.5 text-center text-mid">
                                    —
                                  </td>
                                );
                              }
                              return (
                                <td key={action} className="px-2 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`${resourceLabel} · ${actionLabel.get(action) ?? action}`}
                                    checked={selectedPermissionCodes.includes(permission.code)}
                                    onChange={() => toggleCode(permission.code, setSelectedPermissionCodes)}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};
