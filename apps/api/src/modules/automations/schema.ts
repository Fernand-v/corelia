import { automationActionSchema, automationEventSchema, createAutomationRuleInputSchema } from "@corelia/types";
import { z } from "zod";

export const automationSchemas = {
  createAutomationRuleInputSchema,
  listQuerySchema: z.object({
    projectId: z.string().uuid()
  }),
  idParamsSchema: z.object({
    id: z.string().uuid()
  }),
  updateAutomationRuleSchema: z.object({
    name: z.string().min(3).max(120).optional(),
    event: automationEventSchema.optional(),
    action: automationActionSchema.optional(),
    config: z.record(z.string(), z.unknown()).optional()
  }),
  toggleSchema: z.object({
    enabled: z.boolean()
  })
};
