import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const objectiveScopeSchema = z.enum(["EQUIPO", "PROYECTO"]);

export const objectiveSchema = z.object({
  id: idSchema,
  scope: objectiveScopeSchema,
  teamId: idSchema.nullable(),
  projectId: idSchema.nullable(),
  title: z.string().min(3).max(160),
  description: z.string().max(2000).nullable(),
  descriptionCatalogId: idSchema.nullable().optional(),
  descriptionLabel: z.string().nullable().optional(),
  ownerId: idSchema,
  targetDate: timestampSchema,
  progressPct: z.number().min(0).max(100),
  createdAt: timestampSchema
});

export const createObjectiveInputSchema = objectiveSchema
  .pick({
    scope: true,
    teamId: true,
    projectId: true,
    title: true,
    description: true,
    ownerId: true,
    targetDate: true
  })
  .extend({ progressPct: z.number().min(0).max(100).default(0) });
