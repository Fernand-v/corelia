"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Empty } from "@corelia/ui";
import { UiModal } from "@/components/ui-modal";
import { apiRequest } from "@/lib/api";

type FieldType = "text" | "number" | "textarea" | "checkbox" | "date" | "select";

export type SelectSource = {
  endpoint: string;
  labelKey: string;
};

export type CrudField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  inTable?: boolean;
  selectSource?: SelectSource;
  // Cómo mostrar el valor en la tabla (ej. relación anidada).
  tableRender?: (item: Record<string, unknown>) => string;
};

export type CrudConfig = {
  endpoint: string;
  title: string;
  rowLabel: (item: Record<string, unknown>) => string;
  fields: CrudField[];
  canManage: boolean;
};

type FormValue = string | boolean;
type FormState = Record<string, FormValue>;

const initialForm = (fields: CrudField[]): FormState => {
  const state: FormState = {};
  for (const field of fields) {
    state[field.name] = field.type === "checkbox" ? false : "";
  }
  return state;
};

const fillForm = (fields: CrudField[], item: Record<string, unknown>): FormState => {
  const state: FormState = {};
  for (const field of fields) {
    const raw = item[field.name];
    if (field.type === "checkbox") {
      state[field.name] = Boolean(raw);
    } else if (field.type === "date") {
      state[field.name] = typeof raw === "string" ? raw.slice(0, 10) : "";
    } else {
      state[field.name] = raw === null || raw === undefined ? "" : String(raw);
    }
  }
  return state;
};

const buildPayload = (fields: CrudField[], form: FormState) => {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = form[field.name];
    if (field.type === "checkbox") {
      payload[field.name] = Boolean(value);
      continue;
    }
    const str = String(value).trim();
    if (str === "") {
      continue; // opcionales vacíos se omiten
    }
    if (field.type === "number") {
      payload[field.name] = Number(str);
    } else if (field.type === "date") {
      payload[field.name] = new Date(str).toISOString();
    } else {
      payload[field.name] = str;
    }
  }
  return payload;
};

export function EntityCrud({ config }: { config: CrudConfig }) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => initialForm(config.fields));
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["crud", config.endpoint],
    queryFn: () => apiRequest<Record<string, unknown>[]>(config.endpoint)
  });

  const selectEndpoints = useMemo(
    () =>
      Array.from(
        new Set(
          config.fields
            .filter((field) => field.selectSource)
            .map((field) => field.selectSource!.endpoint)
        )
      ),
    [config.fields]
  );

  const optionQueries = useQueries({
    queries: selectEndpoints.map((endpoint) => ({
      queryKey: ["crud-options", endpoint],
      queryFn: () => apiRequest<Record<string, unknown>[]>(endpoint)
    }))
  });

  const optionsByEndpoint = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    selectEndpoints.forEach((endpoint, index) => {
      map[endpoint] = optionQueries[index]?.data ?? [];
    });
    return map;
  }, [optionQueries, selectEndpoints]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["crud", config.endpoint] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload(config.fields, form);
      return editingId
        ? apiRequest(`${config.endpoint}/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          })
        : apiRequest(config.endpoint, { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setModalOpen(false);
      await invalidate();
    },
    onError: (error: Error) => setFormError(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${config.endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteTarget(null);
      await invalidate();
    }
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm(config.fields));
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditingId(String(item.id));
    setForm(fillForm(config.fields, item));
    setFormError(null);
    setModalOpen(true);
  };

  const tableFields = config.fields.filter((field) => field.inTable);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{config.title}</h2>
        {config.canManage ? <Button onClick={openCreate}>Nuevo</Button> : null}
      </div>

      {listQuery.isLoading ? <p className="text-sm text-mid">Cargando...</p> : null}
      {listQuery.error ? (
        <p className="text-sm text-urgent">{(listQuery.error as Error).message}</p>
      ) : null}
      {listQuery.data && listQuery.data.length === 0 ? (
        <Empty title="Sin registros" description="Crea el primero con el botón Nuevo." />
      ) : null}

      {listQuery.data && listQuery.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mid">
                {tableFields.map((field) => (
                  <th key={field.name} className="px-2 py-2">
                    {field.label}
                  </th>
                ))}
                {config.canManage ? <th className="px-2 py-2 text-right">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {listQuery.data.map((item) => (
                <tr key={String(item.id)} className="border-b border-line/60">
                  {tableFields.map((field) => (
                    <td key={field.name} className="px-2 py-2 text-ink">
                      {field.tableRender
                        ? field.tableRender(item)
                        : field.type === "checkbox"
                          ? item[field.name]
                            ? "Sí"
                            : "No"
                          : String(item[field.name] ?? "—")}
                    </td>
                  ))}
                  {config.canManage ? (
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="h-8 px-3 text-xs"
                          onClick={() => openEdit(item)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          className="h-8 px-3 text-xs"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <UiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${editingId ? "Editar" : "Nuevo"} · ${config.title}`}
        widthClassName="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </>
        }
      >
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          {config.fields.map((field) => (
            <label
              key={field.name}
              className={`space-y-1 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
            >
              <span className="text-xs text-mid">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "select" && field.selectSource ? (
                <select
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                  value={String(form[field.name] ?? "")}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                >
                  <option value="">— Seleccionar —</option>
                  {(optionsByEndpoint[field.selectSource.endpoint] ?? []).map((option) => (
                    <option key={String(option.id)} value={String(option.id)}>
                      {String(option[field.selectSource!.labelKey] ?? option.id)}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                  rows={3}
                  value={String(form[field.name] ?? "")}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                />
              ) : field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-line"
                  checked={Boolean(form[field.name])}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [field.name]: event.target.checked }))
                  }
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm"
                  value={String(form[field.name] ?? "")}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </form>
        {formError ? <p className="text-sm text-urgent">{formError}</p> : null}
      </UiModal>

      <UiModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar registro"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(String(deleteTarget.id))}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-mid">
          ¿Eliminar <span className="font-medium text-ink">{deleteTarget ? config.rowLabel(deleteTarget) : ""}</span>?
          Esta acción no se puede deshacer.
        </p>
        {deleteMutation.error ? (
          <p className="text-sm text-urgent">{(deleteMutation.error as Error).message}</p>
        ) : null}
      </UiModal>
    </Card>
  );
}
