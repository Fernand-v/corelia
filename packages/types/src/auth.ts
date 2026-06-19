import { z } from "zod";
import { idSchema } from "./common.js";
import { projectTemplateSchema } from "./enums.js";
import { roleCodeSchema } from "./rbac.js";

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener al menos una letra minúscula")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número")
  .regex(/[^A-Za-z0-9]/, "La contraseña debe contener al menos un carácter especial");

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: passwordSchema
});

// El refresh token viaja en una cookie httpOnly; el campo en el body es
// opcional solo para compatibilidad/transición.
export const refreshInputSchema = z.object({
  refreshToken: z.string().min(20).optional()
});

export const authTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  accessTokenExpiresInSeconds: z.number().int().positive(),
  userId: idSchema
});

export const logoutInputSchema = z.object({
  refreshToken: z.string().min(20).optional()
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

export const signupRequestStatusSchema = z.enum(["PENDIENTE", "APROBADA", "RECHAZADA"]);

export const registerRequestInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  message: z.string().trim().min(5).max(500).optional()
});

export const registerRequestResponseSchema = z.object({
  id: idSchema,
  status: signupRequestStatusSchema,
  submittedAt: z.string().datetime()
});

export const authProjectMembershipSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(160),
  template: projectTemplateSchema,
  isOwner: z.boolean(),
  roleId: idSchema.nullable(),
  role: roleCodeSchema.nullable(),
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
export type SignupRequestStatus = z.infer<typeof signupRequestStatusSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestInputSchema>;
