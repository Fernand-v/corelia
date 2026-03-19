"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DynamicFormQuestionType, RoleCode } from "@corelia/types";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";
import { useSession } from "@/lib/session";

type DynamicFormItem = {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  projectId: string | null;
  isActive: boolean;
  allowMultipleSubmissions: boolean;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
  questionCount: number;
  responseCount: number;
  submittedByMe: boolean;
};

type DynamicQuestion = {
  id: string;
  formId: string;
  type: DynamicFormQuestionType;
  label: string;
  required: boolean;
  options: string[] | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type DynamicFormDetail = DynamicFormItem & {
  questions: DynamicQuestion[];
  totalResponses: number;
};

type QuestionDraft = {
  type: DynamicFormQuestionType;
  label: string;
  required: boolean;
  order: number;
  optionsText: string;
};

const managerRoles = new Set<RoleCode>([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO"
]);

const questionTypeOptions: Array<{ value: DynamicFormQuestionType; label: string; icon: string }> = [
  { value: "short_text", label: "Respuesta corta", icon: "Aa" },
  { value: "long_text", label: "Parrafo", icon: "T" },
  { value: "multiple_choice", label: "Opcion multiple", icon: "O" },
  { value: "checkbox", label: "Casillas de verificacion", icon: "V" },
  { value: "rating", label: "Escala lineal", icon: "S" },
  { value: "date", label: "Fecha", icon: "D" },
  { value: "nps", label: "NPS (0-10)", icon: "N" },
  { value: "file_upload", label: "Subida de archivo", icon: "F" }
];

const questionTypeLabel = (type: DynamicFormQuestionType) =>
  questionTypeOptions.find((item) => item.value === type)?.label ?? type;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const supportsOptions = (type: DynamicFormQuestionType) =>
  type === "multiple_choice" || type === "checkbox";

const optionsToText = (options: string[] | null) => (options ?? []).join("\n");

const parseOptionsText = (optionsText: string) =>
  optionsText
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const DynamicFormsModule = () => {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const session = useSession();

  const actorRole = session.data?.activeRole;
  const canManageForms = actorRole ? managerRoles.has(actorRole) : false;

  const dashboardContext = useMemo(() => getContextFromSearchParams(searchParams), [searchParams]);
  const projectIdFromContext = dashboardContext.projectId ?? "";

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const [createFormState, setCreateFormState] = useState({
    title: "",
    description: "",
    projectId: projectIdFromContext,
    isActive: false,
    allowMultipleSubmissions: false,
    isAnonymous: false
  });

  const [newQuestionState, setNewQuestionState] = useState({
    type: "short_text" as DynamicFormQuestionType,
    label: "",
    required: false,
    optionsText: "",
    order: ""
  });

  const [questionDrafts, setQuestionDrafts] = useState<Record<string, QuestionDraft>>({});

  const formsPath = useMemo(() => {
    const query = new URLSearchParams();
    if (projectIdFromContext) query.set("projectId", projectIdFromContext);
    if (canManageForms) query.set("includeInactive", "true");
    const qs = query.toString();
    return qs ? `/forms?${qs}` : "/forms";
  }, [canManageForms, projectIdFromContext]);

  const formsQuery = useQuery({
    queryKey: ["dynamic-forms", formsPath],
    queryFn: () => apiRequest<DynamicFormItem[]>(formsPath),
    enabled: session.isSuccess
  });

  const selectedFormQuery = useQuery({
    queryKey: ["dynamic-form", selectedFormId],
    queryFn: () => apiRequest<DynamicFormDetail>(`/forms/${encodeURIComponent(selectedFormId ?? "")}`),
    enabled: Boolean(selectedFormId)
  });

  useEffect(() => {
    if (!selectedFormQuery.data) return;
    const nextDrafts: Record<string, QuestionDraft> = {};
    for (const question of selectedFormQuery.data.questions) {
      nextDrafts[question.id] = {
        type: question.type,
        label: question.label,
        required: question.required,
        order: question.order,
        optionsText: optionsToText(question.options)
      };
    }
    setQuestionDrafts(nextDrafts);
  }, [selectedFormQuery.data]);

  useEffect(() => {
    setCreateFormState((c) => (c.projectId === projectIdFromContext ? c : { ...c, projectId: projectIdFromContext }));
  }, [projectIdFromContext]);

  const createFormMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string;
      projectId?: string;
      isActive?: boolean;
      allowMultipleSubmissions?: boolean;
      isAnonymous?: boolean;
    }) =>
      apiRequest<DynamicFormItem>("/forms", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (created) => {
      setBuilderError(null);
      setSelectedFormId(created.id);
      setView("edit");
      setCreateFormState((c) => ({ ...c, title: "", description: "" }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] }),
        queryClient.invalidateQueries({ queryKey: ["dynamic-form", created.id] })
      ]);
    },
    onError: (error) => setBuilderError(error.message)
  });

  const updateFormMutation = useMutation({
    mutationFn: (input: {
      formId: string;
      payload: {
        title?: string;
        description?: string;
        projectId?: string | null;
        isActive?: boolean;
        allowMultipleSubmissions?: boolean;
        isAnonymous?: boolean;
      };
    }) =>
      apiRequest<DynamicFormItem>(`/forms/${encodeURIComponent(input.formId)}`, {
        method: "PUT",
        body: JSON.stringify(input.payload)
      }),
    onSuccess: async (_updated, variables) => {
      setBuilderError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] }),
        queryClient.invalidateQueries({ queryKey: ["dynamic-form", variables.formId] })
      ]);
    },
    onError: (error) => setBuilderError(error.message)
  });

  const addQuestionMutation = useMutation({
    mutationFn: (input: {
      formId: string;
      payload: {
        type: DynamicFormQuestionType;
        label: string;
        required?: boolean;
        order?: number;
        options?: string[];
      };
    }) =>
      apiRequest<DynamicQuestion>(`/forms/${encodeURIComponent(input.formId)}/questions`, {
        method: "POST",
        body: JSON.stringify(input.payload)
      }),
    onSuccess: async (_q, variables) => {
      setBuilderError(null);
      setNewQuestionState({ type: "short_text", label: "", required: false, optionsText: "", order: "" });
      await queryClient.invalidateQueries({ queryKey: ["dynamic-form", variables.formId] });
      await queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] });
    },
    onError: (error) => setBuilderError(error.message)
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (input: {
      questionId: string;
      payload: {
        type: DynamicFormQuestionType;
        label: string;
        required: boolean;
        order: number;
        options?: string[];
      };
    }) =>
      apiRequest<DynamicQuestion>(`/forms/questions/${encodeURIComponent(input.questionId)}`, {
        method: "PUT",
        body: JSON.stringify(input.payload)
      }),
    onSuccess: async () => {
      setBuilderError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dynamic-form", selectedFormId] }),
        queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] })
      ]);
    },
    onError: (error) => setBuilderError(error.message)
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) =>
      apiRequest<{ deleted: boolean }>(`/forms/questions/${encodeURIComponent(questionId)}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      setBuilderError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dynamic-form", selectedFormId] }),
        queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] })
      ]);
    },
    onError: (error) => setBuilderError(error.message)
  });

  const deleteFormMutation = useMutation({
    mutationFn: (formId: string) =>
      apiRequest<{ deleted: boolean }>(`/forms/${encodeURIComponent(formId)}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      setBuilderError(null);
      setConfirmDeleteFormId(null);
      await queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] });
    },
    onError: (error) => {
      setBuilderError(error.message);
      setConfirmDeleteFormId(null);
    }
  });

  const [confirmDeleteFormId, setConfirmDeleteFormId] = useState<string | null>(null);

  const linkWithContext = (href: string): Route =>
    withDashboardContext(href, dashboardContext) as Route;

  const selectedForm = selectedFormQuery.data;
  const isBusy =
    createFormMutation.isPending ||
    addQuestionMutation.isPending ||
    updateQuestionMutation.isPending ||
    deleteQuestionMutation.isPending ||
    updateFormMutation.isPending ||
    deleteFormMutation.isPending;

  const forms = formsQuery.data ?? [];

  // ── Create view ──
  if (view === "create" && canManageForms) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 py-2">
        <button
          type="button"
          onClick={() => setView("list")}
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          ← Volver a formularios
        </button>

        {/* Form header card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2.5 bg-indigo-600" />
          <div className="space-y-4 p-6">
            <input
              className="w-full border-0 border-b-2 border-slate-200 pb-2 text-3xl font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600"
              placeholder="Formulario sin titulo"
              value={createFormState.title}
              onChange={(e) => setCreateFormState((c) => ({ ...c, title: e.target.value }))}
            />
            <input
              className="w-full border-0 border-b border-slate-200 pb-1 text-sm text-slate-600 outline-none placeholder:text-slate-400 focus:border-indigo-600"
              placeholder="Descripcion del formulario"
              value={createFormState.description}
              onChange={(e) => setCreateFormState((c) => ({ ...c, description: e.target.value }))}
            />
          </div>
        </div>

        {/* Settings card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Configuracion</h3>
          <div className="space-y-4">
            {/* Visibility selector */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600">Visibilidad</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateFormState((c) => ({ ...c, projectId: "" }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    !createFormState.projectId
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>
                    <span className="block font-medium">Global</span>
                    <span className="block text-[11px] text-slate-500">Visible para toda la organizacion</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateFormState((c) => ({ ...c, projectId: projectIdFromContext || c.projectId || "proyecto" }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    createFormState.projectId
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>
                    <span className="block font-medium">Proyecto</span>
                    <span className="block text-[11px] text-slate-500">Solo miembros del proyecto</span>
                  </span>
                </button>
              </div>
              {createFormState.projectId && !projectIdFromContext ? (
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="ID del proyecto"
                  value={createFormState.projectId === "proyecto" ? "" : createFormState.projectId}
                  onChange={(e) => setCreateFormState((c) => ({ ...c, projectId: e.target.value }))}
                />
              ) : null}
              {projectIdFromContext && createFormState.projectId ? (
                <p className="text-xs text-slate-500">Asociado al proyecto del contexto actual</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={createFormState.allowMultipleSubmissions}
                  onChange={(e) => setCreateFormState((c) => ({ ...c, allowMultipleSubmissions: e.target.checked }))}
                />
                Permitir multiples envios
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={createFormState.isAnonymous}
                  onChange={(e) => setCreateFormState((c) => ({ ...c, isAnonymous: e.target.checked }))}
                />
                Respuestas anonimas
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={createFormState.isActive}
                  onChange={(e) => setCreateFormState((c) => ({ ...c, isActive: e.target.checked }))}
                />
                Publicar al crear
              </label>
            </div>
          </div>
        </div>

        {builderError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{builderError}</div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={createFormMutation.isPending || createFormState.title.trim().length === 0}
            onClick={() => {
              const payload: {
                title: string;
                description?: string;
                projectId?: string;
                isActive?: boolean;
                allowMultipleSubmissions?: boolean;
                isAnonymous?: boolean;
              } = {
                title: createFormState.title,
                isActive: createFormState.isActive,
                allowMultipleSubmissions: createFormState.allowMultipleSubmissions,
                isAnonymous: createFormState.isAnonymous
              };
              const desc = createFormState.description.trim();
              if (desc.length > 0) payload.description = desc;
              const pid = createFormState.projectId.trim();
              if (pid.length > 0) payload.projectId = pid;
              createFormMutation.mutate(payload);
            }}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {createFormMutation.isPending ? "Creando..." : "Crear formulario y agregar preguntas"}
          </button>
        </div>
      </main>
    );
  }

  // ── Edit view ──
  if (view === "edit" && selectedFormId && canManageForms) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-4 py-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setView("list"); setSelectedFormId(null); }}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Volver a formularios
          </button>
          <div className="flex items-center gap-2">
            {selectedForm ? (
              <>
                <Link
                  href={linkWithContext(`/forms/${selectedForm.id}`)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Vista previa
                </Link>
                <Link
                  href={linkWithContext(`/forms/${selectedForm.id}/summary`)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm hover:bg-indigo-50"
                >
                  Respuestas ({selectedForm.totalResponses})
                </Link>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => updateFormMutation.mutate({ formId: selectedForm.id, payload: { isActive: !selectedForm.isActive } })}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm ${
                    selectedForm.isActive
                      ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {selectedForm.isActive ? "Desactivar" : "Publicar"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {builderError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{builderError}</div>
        ) : null}

        {selectedFormQuery.isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando editor...</div>
        ) : null}

        {selectedForm ? (
          <>
            {/* Form header */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="h-2.5 bg-indigo-600" />
              <div className="p-6">
                <p className="text-2xl font-semibold text-slate-900">{selectedForm.title}</p>
                {selectedForm.description ? (
                  <p className="mt-1 text-sm text-slate-600">{selectedForm.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    selectedForm.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {selectedForm.isActive ? "Publicado" : "Borrador"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {selectedForm.questions.length} preguntas
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {selectedForm.totalResponses} respuestas
                  </span>
                </div>
              </div>
            </div>

            {/* Questions */}
            {selectedForm.questions.map((question, index) => {
              const draft = questionDrafts[question.id] ?? {
                type: question.type,
                label: question.label,
                required: question.required,
                order: question.order,
                optionsText: optionsToText(question.options)
              };

              return (
                <div key={question.id} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Pregunta {index + 1}</span>
                    <select
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 outline-none focus:border-indigo-500"
                      value={draft.type}
                      onChange={(e) => {
                        const nextType = e.target.value as DynamicFormQuestionType;
                        setQuestionDrafts((c) => ({
                          ...c,
                          [question.id]: { ...draft, type: nextType, optionsText: supportsOptions(nextType) ? draft.optionsText : "" }
                        }));
                      }}
                    >
                      {questionTypeOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    className="w-full border-0 border-b-2 border-transparent pb-1 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500"
                    placeholder="Escribe la pregunta"
                    value={draft.label}
                    onChange={(e) => setQuestionDrafts((c) => ({ ...c, [question.id]: { ...draft, label: e.target.value } }))}
                  />

                  {supportsOptions(draft.type) ? (
                    <div className="mt-3">
                      <p className="mb-1 text-xs text-slate-500">Opciones (una por linea)</p>
                      <textarea
                        className="min-h-[80px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={draft.optionsText}
                        onChange={(e) => setQuestionDrafts((c) => ({ ...c, [question.id]: { ...draft, optionsText: e.target.value } }))}
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={draft.required}
                            onChange={(e) => setQuestionDrafts((c) => ({ ...c, [question.id]: { ...draft, required: e.target.checked } }))}
                          />
                          <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-indigo-600 transition-colors" />
                          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                        </div>
                        Obligatoria
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        Orden:
                        <input
                          type="number"
                          min={0}
                          className="w-14 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                          value={draft.order}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setQuestionDrafts((c) => ({
                              ...c,
                              [question.id]: { ...draft, order: Number.isFinite(v) ? Math.max(0, v) : draft.order }
                            }));
                          }}
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          const options = supportsOptions(draft.type) ? parseOptionsText(draft.optionsText) : undefined;
                          const payload: {
                            type: DynamicFormQuestionType;
                            label: string;
                            required: boolean;
                            order: number;
                            options?: string[];
                          } = { type: draft.type, label: draft.label, required: draft.required, order: draft.order };
                          if (options && options.length > 0) payload.options = options;
                          updateQuestionMutation.mutate({ questionId: question.id, payload });
                        }}
                        className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => deleteQuestionMutation.mutate(question.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar pregunta"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add question card */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Agregar pregunta</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
                  value={newQuestionState.type}
                  onChange={(e) =>
                    setNewQuestionState((c) => ({
                      ...c,
                      type: e.target.value as DynamicFormQuestionType,
                      optionsText: supportsOptions(e.target.value as DynamicFormQuestionType) ? c.optionsText : ""
                    }))
                  }
                >
                  {questionTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
                  placeholder="Orden (opcional)"
                  value={newQuestionState.order}
                  onChange={(e) => setNewQuestionState((c) => ({ ...c, order: e.target.value }))}
                />
              </div>
              <input
                className="mt-3 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
                placeholder="Escribe la pregunta"
                value={newQuestionState.label}
                onChange={(e) => setNewQuestionState((c) => ({ ...c, label: e.target.value }))}
              />
              {supportsOptions(newQuestionState.type) ? (
                <textarea
                  className="mt-3 min-h-[80px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500"
                  placeholder="Opciones (una por linea)"
                  value={newQuestionState.optionsText}
                  onChange={(e) => setNewQuestionState((c) => ({ ...c, optionsText: e.target.value }))}
                />
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    checked={newQuestionState.required}
                    onChange={(e) => setNewQuestionState((c) => ({ ...c, required: e.target.checked }))}
                  />
                  Obligatoria
                </label>
                <button
                  type="button"
                  disabled={addQuestionMutation.isPending || newQuestionState.label.trim().length === 0}
                  onClick={() => {
                    const options = supportsOptions(newQuestionState.type)
                      ? parseOptionsText(newQuestionState.optionsText) : undefined;
                    const payload: {
                      type: DynamicFormQuestionType;
                      label: string;
                      required?: boolean;
                      order?: number;
                      options?: string[];
                    } = { type: newQuestionState.type, label: newQuestionState.label, required: newQuestionState.required };
                    const parsedOrder = newQuestionState.order.trim().length > 0 ? Number(newQuestionState.order) : undefined;
                    if (parsedOrder !== undefined && Number.isFinite(parsedOrder)) payload.order = parsedOrder;
                    if (options && options.length > 0) payload.options = options;
                    addQuestionMutation.mutate({ formId: selectedForm.id, payload });
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {addQuestionMutation.isPending ? "Agregando..." : "Agregar"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    );
  }

  // ── List view ──
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Formularios</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Crea formularios, compartilos con tu equipo y analiza resultados.
          </p>
        </div>
        {canManageForms ? (
          <button
            type="button"
            onClick={() => setView("create")}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
            Nuevo formulario
          </button>
        ) : null}
      </div>

      {formsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : null}

      {formsQuery.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formsQuery.error.message}</div>
      ) : null}

      {!formsQuery.isLoading && forms.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-indigo-500">
              <path d="M9 12h6M12 9v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-800">No hay formularios todavia</p>
          <p className="mt-1 text-sm text-slate-500">Crea tu primer formulario para empezar a recopilar respuestas.</p>
          {canManageForms ? (
            <button
              type="button"
              onClick={() => setView("create")}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Crear formulario
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => {
          const editable = canManageForms && (session.data?.id === form.createdById || actorRole === "ADMINISTRADOR");
          return (
            <div key={form.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className={`h-2 ${form.isActive ? "bg-indigo-600" : "bg-slate-300"}`} />
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{form.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    form.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {form.isActive ? "Activo" : "Borrador"}
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-500 line-clamp-2">{form.description ?? "Sin descripcion"}</p>
                <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
                  <span>{form.questionCount} preguntas</span>
                  <span className="text-slate-300">|</span>
                  <span>{form.responseCount} respuestas</span>
                </div>
                <p className="mb-4 text-[11px] text-slate-400">
                  {form.createdBy?.fullName ?? "Desconocido"} · {formatDateTime(form.createdAt)}
                </p>
                {/* Visibility badge */}
                <div className="mb-3 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    form.projectId
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}>
                    {form.projectId ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                        {form.project?.name ?? "Proyecto"}
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5"><circle cx="12" cy="12" r="10" /></svg>
                        Global
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={linkWithContext(`/forms/${form.id}`)}
                    className="flex-1 rounded-lg bg-indigo-50 py-2 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    {form.submittedByMe && !form.allowMultipleSubmissions ? "Ver" : "Responder"}
                  </Link>
                  {canManageForms ? (
                    <Link
                      href={linkWithContext(`/forms/${form.id}/summary`)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Resumen
                    </Link>
                  ) : null}
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => { setSelectedFormId(form.id); setView("edit"); }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                  ) : null}
                  {editable ? (
                    form.responseCount > 0 ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => updateFormMutation.mutate({ formId: form.id, payload: { isActive: false } })}
                        className="rounded-lg border border-amber-200 px-2.5 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50"
                        title="No se puede eliminar porque tiene respuestas. Se ocultara."
                      >
                        {form.isActive ? "Ocultar" : "Oculto"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteFormId(form.id)}
                        className="rounded-lg border border-red-200 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        title="Eliminar formulario"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteFormId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Eliminar formulario</h3>
            <p className="mt-2 text-sm text-slate-600">
              Esta accion es irreversible. El formulario y todas sus preguntas seran eliminados permanentemente.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteFormId(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteFormMutation.isPending}
                onClick={() => deleteFormMutation.mutate(confirmDeleteFormId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteFormMutation.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};
