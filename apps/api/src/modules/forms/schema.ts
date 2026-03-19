import {
  addDynamicFormQuestionInputSchema,
  createDynamicFormInputSchema,
  createFormRequestInputSchema,
  dynamicFormListQuerySchema,
  idSchema,
  resolveFormRequestInputSchema,
  submitDynamicFormInputSchema,
  updateDynamicFormInputSchema,
  updateDynamicFormQuestionInputSchema
} from "@corelia/types";
import { z } from "zod";

export const formSchemas = {
  createFormRequestInputSchema,
  resolveFormRequestInputSchema,
  createDynamicFormInputSchema,
  updateDynamicFormInputSchema,
  dynamicFormListQuerySchema,
  dynamicFormIdParamsSchema: z.object({
    id: idSchema
  }),
  addDynamicFormQuestionInputSchema,
  dynamicFormQuestionIdParamsSchema: z.object({
    id: idSchema
  }),
  updateDynamicFormQuestionInputSchema,
  submitDynamicFormInputSchema
};
