"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DynamicFormQuestionType } from "@corelia/types";
import { apiRequest } from "@/lib/api";
import { getContextFromSearchParams, withDashboardContext } from "@/lib/context";

type DynamicFormDetail = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  totalResponses: number;
};

type DynamicFormSummaryQuestion = {
  questionId: string;
  label: string;
  type: DynamicFormQuestionType;
  required: boolean;
  options: string[] | null;
  totalAnswers: number;
  choiceCounts?: Record<string, number>;
  ratingAverage?: number | null;
  textResponses?: string[];
};

type DynamicFormSummary = {
  formId: string;
  totalResponses: number;
  questions: DynamicFormSummaryQuestion[];
};

const CHART_COLORS = [
  "#6366f1", "#a78bfa", "#818cf8", "#c4b5fd", "#4f46e5",
  "#7c3aed", "#8b5cf6", "#ddd6fe", "#5b21b6", "#ede9fe"
];

const getChoiceEntries = (question: DynamicFormSummaryQuestion): Array<{ option: string; count: number }> => {
  const counts = question.choiceCounts ?? {};
  const optionOrder = question.options ?? Object.keys(counts);

  return optionOrder.map((option) => ({
    option,
    count: counts[option] ?? 0
  }));
};

const QuestionTypeLabel = ({ type }: { type: DynamicFormQuestionType }) => {
  const labels: Record<string, string> = {
    short_text: "Texto corto",
    long_text: "Texto largo",
    multiple_choice: "Opcion multiple",
    checkbox: "Casillas",
    rating: "Valoracion",
    date: "Fecha"
  };
  return <span>{labels[type] ?? type}</span>;
};

const BarChart = ({ entries, total }: { entries: Array<{ option: string; count: number }>; total: number }) => {
  const maxCount = Math.max(1, ...entries.map((e) => e.count));

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
        const width = Math.round((entry.count / maxCount) * 100);
        const color = CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];

        return (
          <div key={entry.option} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{entry.option}</span>
              <span className="text-slate-500 tabular-nums">
                {entry.count} ({pct}%)
              </span>
            </div>
            <div className="h-6 rounded-md bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RatingDisplay = ({ average, total }: { average: number | null | undefined; total: number }) => {
  const value = average ?? 0;
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <p className="text-4xl font-bold text-slate-900">
          {average !== null && average !== undefined ? average.toFixed(1) : "-"}
        </p>
        <p className="text-xs text-slate-500 mt-1">de 5 puntos</p>
      </div>
      <div className="flex items-center gap-1">
        {stars.map((star) => {
          const filled = star <= Math.round(value);
          return (
            <svg
              key={star}
              viewBox="0 0 24 24"
              fill={filled ? "#f59e0b" : "none"}
              stroke={filled ? "#f59e0b" : "#cbd5e1"}
              strokeWidth="1.5"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          );
        })}
      </div>
      <p className="text-sm text-slate-500">{total} {total === 1 ? "respuesta" : "respuestas"}</p>
    </div>
  );
};

const TextResponsesList = ({ responses }: { responses: string[] }) => {
  if (responses.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">Sin respuestas todavia.</p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {responses.map((response, index) => (
        <div
          key={`response-${index}`}
          className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {response}
        </div>
      ))}
    </div>
  );
};

export const DynamicFormSummaryModule = ({ formId }: { formId: string }) => {
  const searchParams = useSearchParams();

  const dashboardContext = useMemo(() => getContextFromSearchParams(searchParams), [searchParams]);

  const withContext = (href: string): Route => withDashboardContext(href, dashboardContext) as Route;

  const formQuery = useQuery({
    queryKey: ["dynamic-form-summary-form", formId],
    queryFn: () => apiRequest<DynamicFormDetail>(`/forms/${encodeURIComponent(formId)}`),
    enabled: formId.trim().length > 0
  });

  const summaryQuery = useQuery({
    queryKey: ["dynamic-form-summary", formId],
    queryFn: () => apiRequest<DynamicFormSummary>(`/forms/${encodeURIComponent(formId)}/summary`),
    enabled: formId.trim().length > 0
  });

  if (formQuery.isLoading || summaryQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </main>
    );
  }

  if (formQuery.error || summaryQuery.error || !summaryQuery.data) {
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
          <p className="text-sm text-red-600">
            {summaryQuery.error?.message ?? formQuery.error?.message ?? "No se pudo cargar el resumen."}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href={withContext("/forms")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Formularios
            </Link>
            <Link
              href={withContext(`/forms/${formId}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Ir al formulario
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const summary = summaryQuery.data;
  const form = formQuery.data;

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
        <Link
          href={withContext(`/forms/${formId}`)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Ver formulario
        </Link>
      </div>

      {/* Header card */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="h-2.5 bg-indigo-600" />
        <div className="p-6 space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {form?.title ?? "Formulario"}
          </h1>
          {form?.description && (
            <p className="text-sm text-slate-600">{form.description}</p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-indigo-500">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
              </svg>
              <div>
                <p className="text-2xl font-bold text-indigo-700">{summary.totalResponses}</p>
                <p className="text-xs text-indigo-500">{summary.totalResponses === 1 ? "respuesta" : "respuestas"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-400">
                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zM10 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 0110 8z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-2xl font-bold text-slate-700">{summary.questions.length}</p>
                <p className="text-xs text-slate-500">{summary.questions.length === 1 ? "pregunta" : "preguntas"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2.5">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${form?.isActive ? "bg-emerald-500" : "bg-amber-400"}`} />
              <p className="text-sm font-medium text-slate-700">{form?.isActive ? "Publicado" : "Borrador"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Question summaries */}
      {summary.questions.length === 0 && (
        <div className="rounded-xl bg-white shadow-sm p-8 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-10 w-10 text-slate-300 mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <p className="text-sm text-slate-500">Este formulario no tiene preguntas configuradas.</p>
        </div>
      )}

      {summary.questions.map((question, index) => (
        <div key={question.questionId} className="rounded-xl bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">
                {index + 1}. {question.label}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <QuestionTypeLabel type={question.type} />
                <span className="text-slate-300">|</span>
                <span>{question.totalAnswers} {question.totalAnswers === 1 ? "respuesta" : "respuestas"}</span>
              </div>
            </div>
          </div>

          {(question.type === "multiple_choice" || question.type === "checkbox") && (
            <BarChart
              entries={getChoiceEntries(question)}
              total={question.totalAnswers}
            />
          )}

          {question.type === "rating" && (
            <RatingDisplay
              average={question.ratingAverage}
              total={question.totalAnswers}
            />
          )}

          {(question.type === "short_text" || question.type === "long_text" || question.type === "date") && (
            <TextResponsesList responses={question.textResponses ?? []} />
          )}
        </div>
      ))}

      <div className="pb-8" />
    </main>
  );
};
