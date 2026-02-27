import { createTimeEntryInputSchema } from "@corelia/types";
import { z } from "zod";

export const timeSchemas = {
  createTimeEntryInputSchema,
  summaryQuerySchema: z.object({
    taskId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    userId: z.string().uuid().optional()
  })
};
