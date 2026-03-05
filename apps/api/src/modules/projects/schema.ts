import {
  assignProjectRoleInputSchema,
  createProjectStageInputSchema,
  createProjectInputSchema,
  linkProjectTeamInputSchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  projectTeamParamsSchema,
  stageIdParamsSchema,
  updateProjectStageInputSchema,
  upsertProjectMemberInputSchema
} from "@corelia/types";

export const projectSchemas = {
  createProjectInputSchema,
  assignProjectRoleInputSchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  projectTeamParamsSchema,
  linkProjectTeamInputSchema,
  upsertProjectMemberInputSchema,
  createProjectStageInputSchema,
  updateProjectStageInputSchema,
  stageIdParamsSchema
};
