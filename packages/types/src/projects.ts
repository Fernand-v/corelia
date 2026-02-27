import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { projectTemplateSchema, systemRoleSchema } from "./enums.js";

export const projectSchema = z.object({
  id: idSchema,
  name: z.string().min(3).max(160),
  description: z.string().max(2000).nullable(),
  template: projectTemplateSchema,
  ownerId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const projectMemberSchema = z.object({
  projectId: idSchema,
  userId: idSchema,
  role: systemRoleSchema,
  joinedAt: timestampSchema
});

export const createProjectInputSchema = z.object({
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  template: projectTemplateSchema,
  memberIds: z.array(idSchema).default([])
});

export const assignProjectRoleInputSchema = z.object({
  projectId: idSchema,
  userId: idSchema,
  role: systemRoleSchema
});

export const projectIdParamsSchema = z.object({
  projectId: idSchema
});

export const projectMemberParamsSchema = z.object({
  projectId: idSchema,
  userId: idSchema
});

export const upsertProjectMemberInputSchema = z.object({
  userId: idSchema,
  role: systemRoleSchema
});

export type Project = z.infer<typeof projectSchema>;
