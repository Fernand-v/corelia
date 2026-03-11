import {
  activateInviteInputSchema,
  adminResetPasswordInputSchema,
  changePasswordInputSchema,
  authTokenSchema,
  loginInputSchema,
  logoutInputSchema,
  registerRequestInputSchema,
  registerRequestResponseSchema,
  refreshInputSchema
} from "@corelia/types";

export const authSchemas = {
  loginInputSchema,
  refreshInputSchema,
  logoutInputSchema,
  registerRequestInputSchema,
  registerRequestResponseSchema,
  activateInviteInputSchema,
  changePasswordInputSchema,
  adminResetPasswordInputSchema,
  authTokenSchema
};
