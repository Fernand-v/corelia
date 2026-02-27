import { z } from "zod";
import { idSchema } from "./common.js";
import { searchEntitySchema } from "./enums.js";

export const globalSearchInputSchema = z.object({
  query: z.string().min(2).max(100),
  projectId: idSchema.optional()
});

export const searchResultItemSchema = z.object({
  entity: searchEntitySchema,
  id: idSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  path: z.string().min(1)
});

export const globalSearchResultSchema = z.object({
  tasks: z.array(searchResultItemSchema),
  projects: z.array(searchResultItemSchema),
  messages: z.array(searchResultItemSchema),
  people: z.array(searchResultItemSchema),
  files: z.array(searchResultItemSchema)
});
