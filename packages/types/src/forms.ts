import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { requestStatusSchema, requestTypeSchema } from "./enums.js";

export const formRequestSchema = z.object({
  id: idSchema,
  requesterId: idSchema,
  type: requestTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  status: requestStatusSchema,
  approverId: idSchema.nullable(),
  comment: z.string().max(1000).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createFormRequestInputSchema = z.object({
  type: requestTypeSchema,
  payload: z.record(z.string(), z.unknown())
});

export const resolveFormRequestInputSchema = z.object({
  requestId: idSchema,
  status: z.enum(["APROBADA", "RECHAZADA"]),
  comment: z.string().min(3).max(1000)
});

export const dynamicFormQuestionTypeSchema = z.enum([
  "short_text",
  "long_text",
  "multiple_choice",
  "checkbox",
  "rating",
  "date"
]);
export type DynamicFormQuestionType = z.infer<typeof dynamicFormQuestionTypeSchema>;

export const dynamicFormSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  createdById: idSchema,
  projectId: idSchema.nullable(),
  isActive: z.boolean(),
  allowMultipleSubmissions: z.boolean(),
  isAnonymous: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const dynamicFormQuestionSchema = z.object({
  id: idSchema,
  formId: idSchema,
  type: dynamicFormQuestionTypeSchema,
  label: z.string().min(1).max(500),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).nullable(),
  order: z.number().int().min(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createDynamicFormInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  projectId: idSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  allowMultipleSubmissions: z.boolean().optional(),
  isAnonymous: z.boolean().optional()
});

export const updateDynamicFormInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    projectId: idSchema.optional().nullable(),
    isActive: z.boolean().optional(),
    allowMultipleSubmissions: z.boolean().optional(),
    isAnonymous: z.boolean().optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Debes enviar al menos un campo para actualizar"
  });

export const dynamicFormListQuerySchema = z.object({
  projectId: idSchema.optional(),
  includeInactive: z.coerce.boolean().optional(),
  createdByMe: z.coerce.boolean().optional()
});

export const addDynamicFormQuestionInputSchema = z
  .object({
    type: dynamicFormQuestionTypeSchema,
    label: z.string().trim().min(1).max(500),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(200)).optional(),
    order: z.number().int().min(0).optional()
  })
  .superRefine((input, ctx) => {
    if ((input.type === "multiple_choice" || input.type === "checkbox") && (!input.options || input.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las preguntas de opción deben incluir al menos 2 opciones",
        path: ["options"]
      });
    }

    if (input.type !== "multiple_choice" && input.type !== "checkbox" && input.options && input.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Solo multiple_choice y checkbox admiten opciones",
        path: ["options"]
      });
    }
  });

export const updateDynamicFormQuestionInputSchema = z
  .object({
    type: dynamicFormQuestionTypeSchema.optional(),
    label: z.string().trim().min(1).max(500).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(200)).optional(),
    order: z.number().int().min(0).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Debes enviar al menos un campo para actualizar"
  });

export const dynamicFormAnswerInputSchema = z.object({
  questionId: idSchema,
  value: z.unknown()
});

export const submitDynamicFormInputSchema = z.object({
  answers: z.array(dynamicFormAnswerInputSchema).min(1)
});

export const dynamicFormResponseSchema = z.object({
  id: idSchema,
  formId: idSchema,
  userId: idSchema.nullable(),
  submittedAt: timestampSchema
});

export const dynamicFormResponseAnswerSchema = z.object({
  id: idSchema,
  responseId: idSchema,
  questionId: idSchema,
  value: z.unknown()
});

export const dynamicFormSummaryQuestionSchema = z.object({
  questionId: idSchema,
  label: z.string(),
  type: dynamicFormQuestionTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).nullable(),
  totalAnswers: z.number().int().min(0),
  choiceCounts: z.record(z.string(), z.number().int().min(0)).optional(),
  ratingAverage: z.number().nullable().optional(),
  textResponses: z.array(z.string()).optional()
});

export const dynamicFormSummarySchema = z.object({
  formId: idSchema,
  totalResponses: z.number().int().min(0),
  questions: z.array(dynamicFormSummaryQuestionSchema)
});
