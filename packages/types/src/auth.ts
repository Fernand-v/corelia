import { z } from "zod";
import { idSchema } from "./common.js";
import { projectTemplateSchema, systemRoleSchema } from "./enums.js";

const passwordSchema = z.string().min(8).max(128);

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: passwordSchema
});

export const refreshInputSchema = z.object({
  refreshToken: z.string().min(20)
});

export const authTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresInSeconds: z.number().int().positive(),
  userId: idSchema
});

export const logoutInputSchema = z.object({
  refreshToken: z.string().min(20)
});

export const activateInviteInputSchema = z.object({
  token: z.string().min(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: passwordSchema
});

export const changePasswordInputSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "La nueva contraseña debe ser distinta a la actual",
    path: ["newPassword"]
  });

export const adminResetPasswordInputSchema = z.object({
  userId: idSchema,
  newPassword: passwordSchema
});

export const authProjectMembershipSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(160),
  template: projectTemplateSchema,
  isOwner: z.boolean(),
  role: systemRoleSchema.nullable(),
  joinedAt: z.string().datetime().nullable()
});

export const authTeamMembershipSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(160),
  description: z.string().max(2000).nullable(),
  joinedAt: z.string().datetime()
});

export const authMembershipSummarySchema = z.object({
  userId: idSchema,
  projects: z.array(authProjectMembershipSummarySchema),
  teams: z.array(authTeamMembershipSummarySchema)
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RefreshInput = z.infer<typeof refreshInputSchema>;
export type AuthToken = z.infer<typeof authTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordInputSchema>;
export type AuthMembershipSummary = z.infer<typeof authMembershipSummarySchema>;
