import { z } from "zod";
import { idSchema } from "./common.js";

export const automationEventSchema = z.enum([
  "TAREA_COMPLETADA",
  "TAREA_SIN_MOVIMIENTO",
  "TAREA_REASIGNADA",
  "TAREA_VENCIDA",
  "SOLICITUD_RESUELTA"
]);

export const automationActionSchema = z.enum([
  "ENVIAR_NOTIFICACION",
  "CREAR_AUDITORIA",
  "CAMBIAR_ESTADO_TAREA"
]);

export const automationRuleSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: z.string().min(3).max(120),
  event: automationEventSchema,
  action: automationActionSchema,
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true)
});

export const createAutomationRuleInputSchema = automationRuleSchema.omit({ id: true });
