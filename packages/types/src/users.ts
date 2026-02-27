import { z } from "zod";
import { contactSchema, idSchema, timestampSchema, windowScheduleSchema } from "./common.js";
import { systemRoleSchema } from "./enums.js";

export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  baseRole: systemRoleSchema,
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createUserInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
  baseRole: systemRoleSchema.default("COLABORADOR")
});

export const personDirectoryProfileSchema = z.object({
  userId: idSchema,
  fullName: z.string().min(1),
  activeRole: systemRoleSchema,
  teamName: z.string().nullable(),
  schedule: windowScheduleSchema.nullable(),
  skills: z.array(z.string().min(1).max(64)),
  contact: contactSchema
});

export const onboardingChecklistItemSchema = z.object({
  key: z.enum(["ASIGNAR_ROL", "ASIGNAR_EQUIPO", "ASIGNAR_HORARIO", "ACCESO_INICIAL"]),
  label: z.string().min(3).max(120),
  required: z.boolean().default(true),
  order: z.number().int().min(0)
});

export const onboardingChecklistSchema = z.object({
  id: idSchema,
  name: z.string().min(3).max(120),
  items: z.array(onboardingChecklistItemSchema).min(1),
  createdAt: timestampSchema
});

export const offboardingInputSchema = z.object({
  userId: idSchema,
  transferToUserId: idSchema,
  reason: z.string().min(5).max(500),
  archiveHistory: z.boolean().default(true)
});

export const guestInviteInputSchema = z.object({
  email: z.string().email(),
  resourceType: z.enum(["PROYECTO", "ARCHIVO", "DOCUMENTO"]),
  resourceId: idSchema,
  expiresAt: timestampSchema,
  permissions: z.array(z.enum(["LECTURA"])).min(1)
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type OffboardingInput = z.infer<typeof offboardingInputSchema>;
