import { createObjectiveInputSchema } from "@corelia/types";
import { z } from "zod";

export const objectiveSchemas = {
  createObjectiveInputSchema,
  updateProgressSchema: z.object({
    objectiveId: z.string().uuid(),
    progressPct: z.number().min(0).max(100)
  }),
  linkTaskSchema: z.object({
    objectiveId: z.string().uuid(),
    taskId: z.string().uuid()
  })
};
