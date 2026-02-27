import {
  adminAccessByResourceQuerySchema,
  adminCreateExternalInviteInputSchema,
  adminCreateInternalInviteInputSchema,
  adminCreateTeamInputSchema,
  adminCreateUserInputSchema,
  adminExtendInviteInputSchema,
  adminOffboardingExecuteInputSchema,
  adminOffboardingPreviewInputSchema,
  adminResendInternalInviteInputSchema,
  adminUpdateTeamInputSchema,
  adminUpdateUserInputSchema,
  adminUsersQuerySchema,
  paginationSchema
} from "@corelia/types";

export const adminSchemas = {
  adminUsersQuerySchema,
  adminCreateUserInputSchema,
  adminUpdateUserInputSchema,
  adminOffboardingPreviewInputSchema,
  adminOffboardingExecuteInputSchema,
  adminCreateExternalInviteInputSchema,
  adminCreateInternalInviteInputSchema,
  adminExtendInviteInputSchema,
  adminResendInternalInviteInputSchema,
  adminCreateTeamInputSchema,
  adminUpdateTeamInputSchema,
  adminAccessByResourceQuerySchema,
  paginationSchema
};
