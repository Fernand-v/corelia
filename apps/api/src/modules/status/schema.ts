import { systemStatusSchema } from "@corelia/types";
import { z } from "zod";

export const statusSchemas = {
  systemStatusSchema,
  maintenanceToggleSchema: z.object({
    enabled: z.boolean(),
    message: z.string().min(3).max(500).optional()
  })
};
