import {
  adminAuditReportExportQuerySchema,
  adminAuditReportQuerySchema,
  adminAccessByResourceQuerySchema,
  adminCreateCodeCatalogInputSchema,
  adminCreateExternalInviteInputSchema,
  adminCreateInternalInviteInputSchema,
  adminCreateTeamInputSchema,
  adminCreateUserInputSchema,
  adminExtendInviteInputSchema,
  adminListCodeCatalogsQuerySchema,
  adminOffboardingExecuteInputSchema,
  adminOffboardingPreviewInputSchema,
  adminResendInternalInviteInputSchema,
  adminUpdateCodeCatalogInputSchema,
  adminUpdateTeamInputSchema,
  adminUpdateUserInputSchema,
  adminUsersQuerySchema,
  paginationSchema
} from "@corelia/types";
import { z } from "zod";

export const adminSchemas = {
  adminAuditReportQuerySchema,
  adminAuditReportExportQuerySchema,
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
  adminListCodeCatalogsQuerySchema,
  adminCreateCodeCatalogInputSchema,
  adminUpdateCodeCatalogInputSchema,
  adminBackfillProjectChannelsInputSchema: z.object({
    dryRun: z.boolean().optional().default(true)
  }),
  paginationSchema
};
