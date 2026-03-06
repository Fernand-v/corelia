import { z } from "zod";
import { timestampSchema } from "./common.js";

const hexColorSchema = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/);

export const taskStatusColorsSchema = z.object({
  PENDIENTE: hexColorSchema,
  EN_REVISION: hexColorSchema,
  COMPLETADA: hexColorSchema
});

export const frontendSettingsDefaults = {
  organizationName: "Corelia",
  taskStatusColors: {
    PENDIENTE: "#F59E0B",
    EN_REVISION: "#2563EB",
    COMPLETADA: "#16A34A"
  }
} as const;

export const frontendSettingsSchema = z.object({
  organizationName: z.string().trim().min(1).max(160),
  taskStatusColors: taskStatusColorsSchema,
  updatedAt: timestampSchema
});

export const adminUpdateFrontendSettingsInputSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(160).optional(),
    taskStatusColors: taskStatusColorsSchema.partial().optional()
  })
  .refine(
    (input) =>
      input.organizationName !== undefined ||
      (input.taskStatusColors !== undefined && Object.keys(input.taskStatusColors).length > 0),
    {
      message: "Debes enviar al menos un cambio para actualizar la configuración"
    }
  );

export type TaskStatusColors = z.infer<typeof taskStatusColorsSchema>;
export type FrontendSettings = z.infer<typeof frontendSettingsSchema>;
export type AdminUpdateFrontendSettingsInput = z.infer<typeof adminUpdateFrontendSettingsInputSchema>;
