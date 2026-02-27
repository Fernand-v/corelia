import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const importSourceSchema = z.enum(["CSV", "TRELLO_JSON", "NOTION_CSV"]);

export const importJobSchema = z.object({
  id: idSchema,
  source: importSourceSchema,
  filename: z.string().min(1).max(255),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  success: z.boolean().default(false)
});

export const importErrorSchema = z.object({
  row: z.number().int().min(1),
  field: z.string().min(1).max(120),
  message: z.string().min(3).max(500)
});

export const importReportSchema = z.object({
  jobId: idSchema,
  errors: z.array(importErrorSchema)
});
