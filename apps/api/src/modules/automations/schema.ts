import { createAutomationRuleInputSchema } from "@corelia/types";
import { z } from "zod";

export const automationSchemas = {
  createAutomationRuleInputSchema,
  listQuerySchema: z.object({
    projectId: z.string().uuid()
  })
};
