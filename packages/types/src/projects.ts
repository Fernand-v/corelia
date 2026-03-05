import { z } from "zod";
import { colorHexSchema, codeValueSchema, idSchema, timestampSchema } from "./common.js";
import { projectTemplateSchema, systemRoleSchema } from "./enums.js";

export const projectMembershipSourceSchema = z.enum(["MANUAL", "SYNC"]);

export const projectSchema = z.object({
  id: idSchema,
  name: z.string().min(3).max(160),
  description: z.string().max(2000).nullable(),
  descriptionCode: codeValueSchema.nullable().optional(),
  template: projectTemplateSchema,
  ownerId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const projectMemberSchema = z.object({
  projectId: idSchema,
  userId: idSchema,
  role: systemRoleSchema,
  membershipSource: projectMembershipSourceSchema.default("MANUAL"),
  syncTeamsCount: z.number().int().min(0).default(0),
  joinedAt: timestampSchema
});

export const projectStageSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  code: z.coerce.number().int().min(1),
  name: z.string().min(1).max(120),
  color: colorHexSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createProjectInputSchema = z.object({
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  descriptionCode: codeValueSchema.optional(),
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

export const createProjectStageInputSchema = z.object({
  name: z.string().min(1).max(120),
  color: colorHexSchema.optional()
});

export const updateProjectStageInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: colorHexSchema.optional()
});

export const stageIdParamsSchema = z.object({
  stageId: idSchema
});

export const linkProjectTeamInputSchema = z.object({
  teamId: idSchema
});

export const projectTeamParamsSchema = z.object({
  projectId: idSchema,
  teamId: idSchema
});

export const projectLinkedTeamSchema = z.object({
  teamId: idSchema,
  teamName: z.string().min(1).max(160),
  linkedAt: timestampSchema,
  totalTeamMembers: z.number().int().min(0),
  syncedMembers: z.number().int().min(0)
});

export const projectLinkedTeamsResponseSchema = z.object({
  projectId: idSchema,
  items: z.array(projectLinkedTeamSchema)
});

export const linkProjectTeamResultSchema = z.object({
  projectId: idSchema,
  teamId: idSchema,
  linkedAt: timestampSchema,
  totalTeamMembers: z.number().int().min(0),
  syncedCreated: z.number().int().min(0),
  syncedUpdated: z.number().int().min(0),
  ignoredMembers: z.number().int().min(0)
});

export const unlinkProjectTeamResultSchema = z.object({
  success: z.boolean(),
  projectId: idSchema,
  teamId: idSchema,
  removedMembers: z.number().int().min(0)
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
