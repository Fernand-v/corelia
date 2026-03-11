import {
  adminAuditReportExportQuerySchema,
  adminAuditReportQuerySchema,
  adminAccessByResourceQuerySchema,
  adminApproveSignupRequestInputSchema,
  adminCreateCodeCatalogInputSchema,
  adminCreateExternalInviteInputSchema,
  adminCreateInternalInviteInputSchema,
  adminCreateTeamInputSchema,
  adminCreateUserInputSchema,
  adminUpdateFrontendSettingsInputSchema,
  adminExtendInviteInputSchema,
  adminListCodeCatalogsQuerySchema,
  adminOffboardingExecuteInputSchema,
  adminOffboardingPreviewInputSchema,
  adminResendInternalInviteInputSchema,
  adminRejectSignupRequestInputSchema,
  adminSignupRequestsQuerySchema,
  adminUpdateCodeCatalogInputSchema,
  adminUpdateTeamInputSchema,
  adminUpdateUserInputSchema,
  adminUsersQuerySchema,
  idSchema,
  permissionSchema,
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
  adminSignupRequestsQuerySchema,
  adminApproveSignupRequestInputSchema,
  adminRejectSignupRequestInputSchema,
  adminExtendInviteInputSchema,
  adminResendInternalInviteInputSchema,
  adminCreateTeamInputSchema,
  adminUpdateTeamInputSchema,
  adminAccessByResourceQuerySchema,
  adminListCodeCatalogsQuerySchema,
  adminCreateCodeCatalogInputSchema,
  adminUpdateCodeCatalogInputSchema,
  adminUpdateFrontendSettingsInputSchema,
  adminRoleIdParamsSchema: z.object({
    id: idSchema
  }),
  adminCreateRoleInputSchema: z.object({
    code: z.string().trim().min(3).max(120).optional(),
    displayName: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    rank: z.number().int().min(0).max(100).optional()
  }),
  adminUpdateRoleInputSchema: z
    .object({
      displayName: z.string().trim().min(2).max(120).optional(),
      description: z.string().trim().max(500).nullable().optional(),
      rank: z.number().int().min(0).max(100).optional()
    })
    .refine(
      (payload) =>
        payload.displayName !== undefined ||
        payload.description !== undefined ||
        payload.rank !== undefined,
      {
        message: "Debe enviar al menos un campo para actualizar"
      }
    ),
  adminReplaceRolePermissionsInputSchema: z.object({
    permissionCodes: z.array(permissionSchema).default([])
  }),
  adminBackfillProjectChannelsInputSchema: z.object({
    dryRun: z.boolean().optional().default(true)
  }),
  paginationSchema
};
