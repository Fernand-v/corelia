import { Prisma } from "@prisma/client";
import type { ConditionalLogic } from "@corelia/types";

// Helpers puros (sin acceso a base de datos) extraídos de FormService para
// reducir el tamaño del servicio y poder testearlos de forma aislada.

export const normalizeOptions = (options?: string[]): string[] | null => {
  if (!options || options.length === 0) {
    return null;
  }

  const normalized = Array.from(
    new Set(options.map((option) => option.trim()).filter((option) => option.length > 0))
  );

  return normalized.length > 0 ? normalized : null;
};

export const parseOptions = (options: Prisma.JsonValue | null): string[] | null => {
  if (!Array.isArray(options)) {
    return null;
  }

  const parsed = options
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : null;
};

export const toInputJson = (value: Prisma.JsonValue) => {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
};

export const mapDynamicForm = (form: {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  projectId: string | null;
  isActive: boolean;
  allowMultipleSubmissions: boolean;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  project?: { id: string; name: string } | null;
  _count?: { questions?: number; responses?: number };
  responses?: Array<{ id: string }>;
}) => {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    createdById: form.createdById,
    projectId: form.projectId,
    isActive: form.isActive,
    allowMultipleSubmissions: form.allowMultipleSubmissions,
    isAnonymous: form.isAnonymous,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
    createdBy: form.createdBy
      ? {
          id: form.createdBy.id,
          fullName: `${form.createdBy.firstName} ${form.createdBy.lastName}`.trim()
        }
      : null,
    project: form.project
      ? {
          id: form.project.id,
          name: form.project.name
        }
      : null,
    questionCount: form._count?.questions ?? 0,
    responseCount: form._count?.responses ?? 0,
    submittedByMe: form.responses ? form.responses.length > 0 : false
  };
};

export const parseConditionalLogic = (value: Prisma.JsonValue | null): ConditionalLogic | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  if (typeof obj.questionId === "string" && typeof obj.operator === "string" && typeof obj.action === "string") {
    return obj as unknown as ConditionalLogic;
  }

  return null;
};

export const mapDynamicQuestion = (question: {
  id: string;
  formId: string;
  type: string;
  label: string;
  required: boolean;
  options: Prisma.JsonValue | null;
  conditionalLogic?: Prisma.JsonValue | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    id: question.id,
    formId: question.formId,
    type: question.type,
    label: question.label,
    required: question.required,
    options: parseOptions(question.options),
    conditionalLogic: parseConditionalLogic(question.conditionalLogic ?? null),
    order: question.order,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString()
  };
};

export const normalizeAnswerValue = (
  question: {
    type: string;
    label: string;
    required: boolean;
    options: Prisma.JsonValue | null;
  },
  rawValue: unknown
): Prisma.JsonValue => {
  const options = parseOptions(question.options) ?? [];

  switch (question.type) {
    case "short_text": {
      if (typeof rawValue !== "string") {
        throw new Error(`La respuesta para "${question.label}" debe ser texto`);
      }
      const value = rawValue.trim();
      if (question.required && value.length === 0) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }
      if (value.length > 500) {
        throw new Error(`La respuesta para "${question.label}" excede el máximo de 500 caracteres`);
      }
      return value;
    }
    case "long_text": {
      if (typeof rawValue !== "string") {
        throw new Error(`La respuesta para "${question.label}" debe ser texto`);
      }
      const value = rawValue.trim();
      if (question.required && value.length === 0) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }
      if (value.length > 5000) {
        throw new Error(`La respuesta para "${question.label}" excede el máximo de 5000 caracteres`);
      }
      return value;
    }
    case "multiple_choice": {
      if (typeof rawValue !== "string") {
        throw new Error(`La respuesta para "${question.label}" debe ser una opción`);
      }
      const value = rawValue.trim();
      if (question.required && value.length === 0) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }
      if (value && !options.includes(value)) {
        throw new Error(`La opción seleccionada en "${question.label}" no es válida`);
      }
      return value;
    }
    case "checkbox": {
      if (!Array.isArray(rawValue)) {
        throw new Error(`La respuesta para "${question.label}" debe ser una lista de opciones`);
      }
      const values = Array.from(
        new Set(
          rawValue
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        )
      );

      const invalid = values.find((item) => !options.includes(item));
      if (invalid) {
        throw new Error(`La opción "${invalid}" no es válida en "${question.label}"`);
      }

      if (question.required && values.length === 0) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }

      return values;
    }
    case "rating": {
      const numeric =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string"
            ? Number(rawValue)
            : Number.NaN;

      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        throw new Error(`La valoración de "${question.label}" debe estar entre 1 y 5`);
      }

      return numeric;
    }
    case "date": {
      if (typeof rawValue !== "string") {
        throw new Error(`La respuesta para "${question.label}" debe ser una fecha`);
      }

      const value = rawValue.trim();
      if (question.required && value.length === 0) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }

      if (value.length > 0) {
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.valueOf())) {
          throw new Error(`La fecha ingresada en "${question.label}" no es válida`);
        }
      }

      return value;
    }
    case "nps": {
      const numeric =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string"
            ? Number(rawValue)
            : Number.NaN;

      if (question.required && Number.isNaN(numeric)) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }

      if (!Number.isNaN(numeric) && (!Number.isInteger(numeric) || numeric < 0 || numeric > 10)) {
        throw new Error(`La puntuación NPS de "${question.label}" debe estar entre 0 y 10`);
      }

      return Number.isNaN(numeric) ? (null as unknown as Prisma.JsonValue) : numeric;
    }
    case "file_upload": {
      if (typeof rawValue !== "string") {
        throw new Error(`La respuesta para "${question.label}" debe ser una ruta de archivo`);
      }

      const value = rawValue.trim();
      if (question.required && value.length === 0) {
        throw new Error(`La pregunta "${question.label}" es obligatoria`);
      }

      if (value.length > 1000) {
        throw new Error(`La ruta de archivo para "${question.label}" excede el máximo permitido`);
      }

      return value;
    }
    default:
      return rawValue as Prisma.JsonValue;
  }
};

export const evaluateCondition = (
  condition: ConditionalLogic,
  answersByQuestion: Map<string, unknown>
): boolean => {
  const answer = answersByQuestion.get(condition.questionId);
  if (answer === undefined || answer === null) {
    return false;
  }

  const answerStr = String(answer);
  const condValueStr = String(condition.value);

  switch (condition.operator) {
    case "equals":
      return answerStr === condValueStr;
    case "not_equals":
      return answerStr !== condValueStr;
    case "contains":
      return answerStr.toLowerCase().includes(condValueStr.toLowerCase());
    case "greater_than": {
      const a = Number(answer);
      const b = Number(condition.value);
      return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
    }
    case "less_than": {
      const a = Number(answer);
      const b = Number(condition.value);
      return !Number.isNaN(a) && !Number.isNaN(b) && a < b;
    }
    default:
      return false;
  }
};

export const shouldShowQuestion = (
  question: { conditionalLogic?: Prisma.JsonValue | null },
  answersByQuestion: Map<string, unknown>
): boolean => {
  const logic = parseConditionalLogic(question.conditionalLogic ?? null);
  if (!logic) {
    return true;
  }

  const result = evaluateCondition(logic, answersByQuestion);
  return logic.action === "show" ? result : !result;
};
