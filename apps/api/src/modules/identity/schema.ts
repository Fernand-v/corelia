import {
  createUserInputSchema,
  guestInviteInputSchema,
  offboardingInputSchema,
  roleContextInputSchema
} from "@corelia/types";
import { z } from "zod";

export const identitySchemas = {
  createUserInputSchema,
  offboardingInputSchema,
  guestInviteInputSchema,
  roleContextInputSchema,
  createOnboardingChecklistSchema: z.object({
    name: z.string().min(3).max(120),
    items: z
      .array(
        z.object({
          key: z.enum(["ASIGNAR_ROL", "ASIGNAR_EQUIPO", "ASIGNAR_HORARIO", "ACCESO_INICIAL"]),
          label: z.string().min(3).max(120),
          required: z.boolean().default(true),
          order: z.number().int().min(0)
        })
      )
      .min(1)
  }),
  onboardingStartSchema: z.object({
    checklistId: z.string().uuid(),
    userId: z.string().uuid()
  }),
  onboardingStepCompleteSchema: z.object({
    runId: z.string().uuid(),
    stepKey: z.string().min(2)
  }),
  userPresenceQuerySchema: z.object({
    userIds: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
  })
};
