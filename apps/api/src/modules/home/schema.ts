import { idSchema } from "@corelia/types";
import { z } from "zod";

export const homeSchemas = {
  homeQuerySchema: z.object({
    projectId: idSchema.optional(),
    teamId: idSchema.optional()
  })
};
