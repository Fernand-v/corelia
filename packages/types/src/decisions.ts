import { z } from "zod";
import { entityTypeSchema } from "./enums.js";
import { codeValueSchema, idSchema, timestampSchema } from "./common.js";

export const decisionNoteSchema = z.object({
  id: idSchema,
  title: z.string().min(3).max(160),
  description: z.string().min(3).max(4000),
  descriptionCatalogId: codeValueSchema.nullable().optional(),
  descriptionLabel: z.string().nullable().optional(),
  authorId: idSchema,
  linkedEntityType: entityTypeSchema,
  linkedEntityId: idSchema,
  createdAt: timestampSchema
});

export const createDecisionNoteInputSchema = decisionNoteSchema.pick({
  title: true,
  description: true,
  descriptionCatalogId: true,
  linkedEntityType: true,
  linkedEntityId: true
});
