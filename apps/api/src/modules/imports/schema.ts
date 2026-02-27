import { importReportSchema, importSourceSchema } from "@corelia/types";
import { z } from "zod";

export const importSchemas = {
  createImportJobSchema: z.object({
    source: importSourceSchema,
    filename: z.string().min(1).max(255)
  }),
  addImportErrorsSchema: importReportSchema.extend({
    errors: importReportSchema.shape.errors
  }),
  jobParamSchema: z.object({
    jobId: z.string().uuid()
  })
};
