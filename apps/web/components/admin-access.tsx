"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card } from "@corelia/ui";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/session";

type ProgramItem = {
  id: string;
  code: string;
  numericCode: number;
  displayName: string;
  description: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
};

type PermissionItem = {
  id: string;
  code: string;
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

type TabKey = "programs" | "permissions" | "roles";

export const AdminAccessView = () => {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("programs");

  const [programCreateForm, setProgramCreateForm] = useState({
    code: "",
    displayName: "",
    description: "",
    sortOrder: "0"
  });
  const [programEditForm, setProgramEditForm] = useState<{
    id: string;
    displayName: string;
    description: string;
    sortOrder: string;
    isActive: boolean;
  } | null>(null);

  const [permissionCreateForm, setPermissionCreateForm] = useState({
    code: "",
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

  const activePermissions = useMemo(
    () => (permissionsQuery.data ?? []).filter((permission) => permission.isActive),
    [permissionsQuery.data]
  );

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

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-access-programs"] }),
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
          sortOrder: Number.parseInt(programCreateForm.sortOrder || "0", 10)
        })
      }),
    onSuccess: async () => {
      setProgramCreateForm({ code: "", displayName: "", description: "", sortOrder: "0" });
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

  const createPermissionMutation = useMutation({
    mutationFn: () =>
      apiRequest<PermissionItem>("/admin/permissions", {
        method: "POST",
        body: JSON.stringify({
          ...(permissionCreateForm.code.trim() ? { code: permissionCreateForm.code.trim() } : {}),
          displayName: permissionCreateForm.displayName.trim(),
          description: permissionCreateForm.description.trim() || undefined,
          categoryCode: permissionCreateForm.categoryCode,
          programCode: permissionCreateForm.programCode
        })
      }),
    onSuccess: async () => {
      setPermissionCreateForm((prev) => ({
        ...prev,
        code: "",
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
        <p className="text-sm text-slate-600">Solo el rol Administrador puede acceder a esta vista.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Administración</p>
        <h1 className="text-2xl font-semibold text-slate-900">Accesos</h1>
        <p className="text-sm text-slate-600">Gestiona programas, permisos y su asignación por rol.</p>
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
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Código (opcional)"
                value={programCreateForm.code}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Nombre"
                value={programCreateForm.displayName}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Descripción"
                value={programCreateForm.description}
                onChange={(event) => setProgramCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
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

            {createProgramMutation.error ? (
              <p className="text-sm text-red-600">{createProgramMutation.error.message}</p>
            ) : null}

            <div className="space-y-2">
              {(programsQuery.data ?? []).map((program) => (
                <div key={program.id} className="rounded-xl border border-slate-200 p-3">
                  {programEditForm?.id === program.id ? (
                    <div className="grid gap-2 md:grid-cols-5">
                      <input
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                        value={programEditForm.displayName}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                        }
                      />
                      <input
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                        value={programEditForm.description}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                        }
                      />
                      <input
                        type="number"
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                        value={programEditForm.sortOrder}
                        onChange={(event) =>
                          setProgramEditForm((prev) => (prev ? { ...prev, sortOrder: event.target.value } : prev))
                        }
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-700">
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
                        <p className="text-sm font-semibold text-slate-900">{program.displayName}</p>
                        <p className="text-xs text-slate-600">
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

        {activeTab === "permissions" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <input
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Código (opcional)"
                value={permissionCreateForm.code}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Nombre"
                value={permissionCreateForm.displayName}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
              <input
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Descripción"
                value={permissionCreateForm.description}
                onChange={(event) => setPermissionCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <select
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
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
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
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
                  disabled={createPermissionMutation.isPending || !permissionCreateForm.displayName.trim()}
                  onClick={() => createPermissionMutation.mutate()}
                >
                  Crear
                </Button>
              </div>
            </div>

            {createPermissionMutation.error ? (
              <p className="text-sm text-red-600">{createPermissionMutation.error.message}</p>
            ) : null}

            <div className="space-y-2">
              {(permissionsQuery.data ?? []).map((permission) => (
                <div key={permission.id} className="rounded-xl border border-slate-200 p-3">
                  {permissionEditForm?.id === permission.id ? (
                    <div className="grid gap-2 md:grid-cols-6">
                      <input
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                        value={permissionEditForm.displayName}
                        onChange={(event) =>
                          setPermissionEditForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                        }
                      />
                      <input
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                        value={permissionEditForm.description}
                        onChange={(event) =>
                          setPermissionEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                        }
                      />
                      <select
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
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
                        className="h-9 rounded-md border border-slate-300 px-2 text-sm"
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
                      <label className="flex items-center gap-2 text-sm text-slate-700">
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
                        <p className="text-sm font-semibold text-slate-900">{permission.displayName}</p>
                        <p className="text-xs text-slate-600">
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
                className="h-10 min-w-72 rounded-xl border border-slate-300 px-3 text-sm"
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
              <p className="text-sm text-red-600">{saveRoleAccessMutation.error.message}</p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">Programas</p>
                <div className="space-y-2">
                  {activePrograms.map((program) => (
                    <label key={program.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedProgramCodes.includes(program.code)}
                        onChange={() => toggleCode(program.code, setSelectedProgramCodes)}
                      />
                      <span>{program.displayName}</span>
                      <span className="text-xs text-slate-500">({program.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">Permisos</p>
                <div className="max-h-96 space-y-2 overflow-auto pr-1">
                  {activePermissions.map((permission) => (
                    <label key={permission.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedPermissionCodes.includes(permission.code)}
                        onChange={() => toggleCode(permission.code, setSelectedPermissionCodes)}
                      />
                      <span>{permission.displayName}</span>
                      <span className="text-xs text-slate-500">({permission.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};
