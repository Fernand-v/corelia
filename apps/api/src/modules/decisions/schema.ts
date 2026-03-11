import { createDecisionNoteInputSchema, entityTypeSchema } from "@corelia/types";
import { z } from "zod";

export const decisionSchemas = {
  createDecisionNoteInputSchema,
  listQuerySchema: z.object({
    linkedEntityType: entityTypeSchema.optional(),
    linkedEntityId: z.string().uuid().optional()
  })
};
