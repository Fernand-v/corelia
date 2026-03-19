"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DynamicFormQuestionType, RoleCode } from "@corelia/types";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";
import { useSession } from "@/lib/session";

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

type DynamicFormDetail = {
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
  totalResponses: number;
  questions: DynamicQuestion[];
};

type SubmittedDynamicFormResponse = {
  id: string;
  formId: string;
  userId: string | null;
  submittedAt: string;
  answers: Array<{
    id: string;
    questionId: string;
    value: unknown;
  }>;
};

type AnswerPayload = {
  questionId: string;
  value: unknown;
};

const managerRoles = new Set<RoleCode>([
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO"
]);

const parseCheckboxValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const validateRequiredAnswers = (
  questions: DynamicQuestion[],
  answersByQuestionId: Record<string, unknown>
): string | null => {
  for (const question of questions) {
    if (!question.required) {
      continue;
    }

    const value = answersByQuestionId[question.id];

    if (question.type === "checkbox") {
      if (parseCheckboxValue(value).length === 0) {
        return `La pregunta "${question.label}" es obligatoria`;
      }
      continue;
    }

    if (question.type === "rating") {
      const numeric =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : Number.NaN;
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        return `La pregunta "${question.label}" es obligatoria`;
      }
      continue;
    }

    if (question.type === "nps") {
      const numeric =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : Number.NaN;
      if (Number.isNaN(numeric) || !Number.isInteger(numeric) || numeric < 0 || numeric > 10) {
        return `La pregunta "${question.label}" es obligatoria`;
      }
      continue;
    }

    if (question.type === "file_upload") {
      if (typeof value !== "string" || value.trim().length === 0) {
        return `La pregunta "${question.label}" es obligatoria`;
      }
      continue;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
      return `La pregunta "${question.label}" es obligatoria`;
    }
  }

  return null;
};

const buildSubmissionAnswers = (
  questions: DynamicQuestion[],
  answersByQuestionId: Record<string, unknown>
): AnswerPayload[] => {
  const payload: AnswerPayload[] = [];

  for (const question of questions) {
    const value = answersByQuestionId[question.id];

    if (value === undefined || value === null) {
      continue;
    }

    if (question.type === "checkbox") {
      const selected = parseCheckboxValue(value);
      if (selected.length > 0) {
        payload.push({
          questionId: question.id,
          value: selected
        });
      }
      continue;
    }

    if (question.type === "rating") {
      const numeric =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : Number.NaN;
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
        payload.push({
          questionId: question.id,
          value: numeric
        });
      }
      continue;
    }

    if (question.type === "nps") {
      const numeric =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number(value)
            : Number.NaN;
      if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 10) {
        payload.push({
          questionId: question.id,
          value: numeric
        });
      }
      continue;
    }

    if (question.type === "file_upload") {
      if (typeof value === "string" && value.trim().length > 0) {
        payload.push({
          questionId: question.id,
          value: value.trim()
        });
      }
      continue;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) {
        payload.push({
          questionId: question.id,
          value: normalized
        });
      }
    }
  }

  return payload;
};

const StarRating = ({
  value,
  onChange,
  disabled
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill={filled ? "#f59e0b" : "none"}
              stroke={filled ? "#f59e0b" : "#cbd5e1"}
              strokeWidth="1.5"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-medium text-amber-600">{value}/5</span>
      )}
    </div>
  );
};

const NpsScale = ({
  value,
  onChange,
  disabled
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1">
      {Array.from({ length: 11 }, (_, i) => i).map((score) => (
        <button
          key={score}
          type="button"
          disabled={disabled}
          onClick={() => onChange(score)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
            value === score
              ? score <= 6
                ? "bg-red-500 text-white"
                : score <= 8
                  ? "bg-amber-400 text-white"
                  : "bg-emerald-500 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {score}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-xs text-slate-400">
      <span>Nada probable</span>
      <span>Muy probable</span>
    </div>
  </div>
);

export const DynamicFormAnswerModule = ({ formId }: { formId: string }) => {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const session = useSession();

  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, unknown>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const activeRole = session.data?.activeRole;
  const canManageForms = activeRole ? managerRoles.has(activeRole) : false;

  const dashboardContext = useMemo(() => getContextFromSearchParams(searchParams), [searchParams]);

  const withContext = (href: string): Route => withDashboardContext(href, dashboardContext) as Route;

  const formQuery = useQuery({
    queryKey: ["dynamic-form-answer", formId],
    queryFn: () => apiRequest<DynamicFormDetail>(`/forms/${encodeURIComponent(formId)}`),
    enabled: formId.trim().length > 0
  });

  const submitMutation = useMutation({
    mutationFn: (answers: AnswerPayload[]) =>
      apiRequest<SubmittedDynamicFormResponse>(`/forms/${encodeURIComponent(formId)}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers })
      }),
    onSuccess: async () => {
      setSubmitError(null);
      setSubmitSuccess("Formulario enviado correctamente.");
      setAnswersByQuestionId({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dynamic-form-answer", formId] }),
        queryClient.invalidateQueries({ queryKey: ["dynamic-forms"] })
      ]);
    },
    onError: (error) => {
      setSubmitSuccess(null);
      setSubmitError(error.message);
    }
  });

  const setAnswerValue = (questionId: string, value: unknown) => {
    setAnswersByQuestionId((current) => {
      const shouldDelete =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);

      if (shouldDelete) {
        if (!(questionId in current)) {
          return current;
        }
        const { [questionId]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [questionId]: value
      };
    });
  };

  const handleCheckboxToggle = (questionId: string, option: string, checked: boolean) => {
    setAnswersByQuestionId((current) => {
      const previous = parseCheckboxValue(current[questionId]);
      const next = checked
        ? Array.from(new Set([...previous, option]))
        : previous.filter((item) => item !== option);

      if (next.length === 0) {
        if (!(questionId in current)) {
          return current;
        }
        const { [questionId]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [questionId]: next
      };
    });
  };

  const handleSubmit = () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const form = formQuery.data;
    if (!form) {
      return;
    }

    if (!form.isActive) {
      setSubmitError("El formulario todavia no esta publicado.");
      return;
    }

    if (!form.allowMultipleSubmissions && form.submittedByMe) {
      setSubmitError("Ya enviaste respuestas para este formulario.");
      return;
    }

    const requiredError = validateRequiredAnswers(form.questions, answersByQuestionId);
    if (requiredError) {
      setSubmitError(requiredError);
      return;
    }

    const payload = buildSubmissionAnswers(form.questions, answersByQuestionId);
    if (payload.length === 0) {
      setSubmitError("Debes responder al menos una pregunta antes de enviar.");
      return;
    }

    submitMutation.mutate(payload);
  };

  const form = formQuery.data;

  if (formQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </main>
    );
  }

  if (formQuery.error || !form) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="rounded-xl bg-white p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-red-600">{formQuery.error?.message ?? "No se pudo cargar el formulario."}</p>
          <Link
            href={withContext("/forms")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Volver a formularios
          </Link>
        </div>
      </main>
    );
  }

  const alreadySubmittedAndBlocked = !form.allowMultipleSubmissions && form.submittedByMe;
  const canSubmit = form.isActive && !alreadySubmittedAndBlocked && !submitMutation.isPending;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-3">
      {/* Navigation */}
      <div className="flex items-center gap-2 mb-2">
        <Link
          href={withContext("/forms")}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Formularios
        </Link>
        {canManageForms && (
          <Link
            href={withContext(`/forms/${form.id}/summary`)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M15.5 2A1.5 1.5 0 0017 3.5v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13A1.5 1.5 0 014.5 2h11zM6 7a1 1 0 000 2h2a1 1 0 000-2H6zm0 4a1 1 0 000 2h8a1 1 0 000-2H6z" />
            </svg>
            Ver resumen
          </Link>
        )}
      </div>

      {/* Form header card */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="h-2.5 bg-indigo-600" />
        <div className="p-6 space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-slate-600">{form.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-xs text-slate-500">
              {form.totalResponses} {form.totalResponses === 1 ? "respuesta" : "respuestas"}
            </span>
            {form.isAnonymous && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.092 1.092a4 4 0 00-5.558-5.558z" clipRule="evenodd" />
                  <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                </svg>
                Anonimo
              </span>
            )}
            {!form.isActive && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Borrador
              </span>
            )}
          </div>
          <p className="text-xs text-red-500 pt-1">* Indica una pregunta obligatoria</p>
        </div>
      </div>

      {/* Alerts */}
      {!form.isActive && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-500 shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-amber-800">
            Este formulario esta en borrador. Solo puede responderse cuando este publicado.
          </p>
        </div>
      )}

      {alreadySubmittedAndBlocked && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-500 shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-amber-800">
            Ya enviaste respuestas y este formulario no permite multiples envios.
          </p>
        </div>
      )}

      {submitError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-500 shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      {submitSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-500 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-emerald-800">{submitSuccess}</p>
            <Link
              href={withContext("/forms")}
              className="text-xs text-emerald-600 hover:text-emerald-700 underline"
            >
              Volver a formularios
            </Link>
          </div>
        </div>
      )}

      {/* Question cards */}
      {form.questions.length === 0 ? (
        <div className="rounded-xl bg-white shadow-sm p-8 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-10 w-10 text-slate-300 mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm text-slate-500">Este formulario aun no tiene preguntas.</p>
        </div>
      ) : (
        form.questions.map((question) => {
          const rawValue = answersByQuestionId[question.id];
          const textValue = typeof rawValue === "string" ? rawValue : "";
          const selectedCheckboxes = parseCheckboxValue(rawValue);
          const ratingValue =
            typeof rawValue === "number"
              ? rawValue
              : typeof rawValue === "string"
                ? Number(rawValue) || 0
                : 0;
          const npsValue =
            typeof rawValue === "number"
              ? rawValue
              : typeof rawValue === "string"
                ? Number(rawValue)
                : -1;

          return (
            <div key={question.id} className="rounded-xl bg-white shadow-sm p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {question.label}
                  {question.required && <span className="text-red-500 ml-0.5">*</span>}
                </p>
              </div>

              {question.type === "short_text" && (
                <input
                  type="text"
                  placeholder="Tu respuesta"
                  className="w-full border-0 border-b-2 border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-0 transition-colors"
                  value={textValue}
                  onChange={(event) => setAnswerValue(question.id, event.target.value)}
                  disabled={!canSubmit}
                />
              )}

              {question.type === "long_text" && (
                <textarea
                  placeholder="Tu respuesta"
                  rows={4}
                  className="w-full border-0 border-b-2 border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-0 transition-colors resize-none"
                  value={textValue}
                  onChange={(event) => setAnswerValue(question.id, event.target.value)}
                  disabled={!canSubmit}
                />
              )}

              {question.type === "multiple_choice" && (
                <div className="space-y-2.5">
                  {(question.options ?? []).map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                        <span className={`h-5 w-5 rounded-full border-2 transition-colors ${
                          textValue === option
                            ? "border-indigo-600"
                            : "border-slate-300 group-hover:border-slate-400"
                        }`} />
                        {textValue === option && (
                          <span className="absolute h-2.5 w-2.5 rounded-full bg-indigo-600" />
                        )}
                      </span>
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        className="sr-only"
                        checked={textValue === option}
                        onChange={() => setAnswerValue(question.id, option)}
                        disabled={!canSubmit}
                      />
                      <span className="text-sm text-slate-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "checkbox" && (
                <div className="space-y-2.5">
                  {(question.options ?? []).map((option) => {
                    const checked = selectedCheckboxes.includes(option);
                    return (
                      <label
                        key={option}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
                          checked
                            ? "bg-indigo-600 border-2 border-indigo-600"
                            : "border-2 border-slate-300 group-hover:border-slate-400"
                        }`}>
                          {checked && (
                            <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" className="h-3 w-3">
                              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(event) => handleCheckboxToggle(question.id, option, event.target.checked)}
                          disabled={!canSubmit}
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === "rating" && (
                <StarRating
                  value={ratingValue}
                  onChange={(v) => setAnswerValue(question.id, v)}
                  disabled={!canSubmit}
                />
              )}

              {question.type === "date" && (
                <input
                  type="date"
                  className="w-full max-w-xs border-0 border-b-2 border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-0 transition-colors"
                  value={textValue}
                  onChange={(event) => setAnswerValue(question.id, event.target.value)}
                  disabled={!canSubmit}
                />
              )}

              {question.type === "nps" && (
                <NpsScale
                  value={npsValue >= 0 ? npsValue : -1}
                  onChange={(v) => setAnswerValue(question.id, v)}
                  disabled={!canSubmit}
                />
              )}

              {question.type === "file_upload" && (
                <div className="space-y-2">
                  {textValue && (
                    <p className="text-xs text-emerald-600 truncate">Archivo subido: {textValue.split("/").pop()}</p>
                  )}
                  <label className={`inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition-colors ${!canSubmit ? "opacity-50 pointer-events-none" : ""}`}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                      <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                    Seleccionar archivo
                    <input
                      type="file"
                      className="sr-only"
                      disabled={!canSubmit}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("file", file);
                        try {
                          const result = await apiRequest<{ path: string }>(`/forms/${encodeURIComponent(formId)}/upload`, {
                            method: "POST",
                            body: formData
                          });
                          setAnswerValue(question.id, result.path);
                        } catch {
                          setSubmitError("Error al subir el archivo.");
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Submit */}
      {form.questions.length > 0 && (
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            onClick={handleSubmit}
            disabled={!canSubmit || form.questions.length === 0}
          >
            {submitMutation.isPending ? "Enviando..." : "Enviar"}
          </button>
          <button
            type="button"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            onClick={() => setAnswersByQuestionId({})}
            disabled={!canSubmit}
          >
            Borrar respuestas
          </button>
        </div>
      )}
    </main>
  );
};
