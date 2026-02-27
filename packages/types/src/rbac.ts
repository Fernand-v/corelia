import { z } from "zod";
import { idSchema } from "./common.js";
import { systemRoleSchema } from "./enums.js";

export const permissionSchema = z.enum([
  "USUARIO_LEER",
  "USUARIO_GESTIONAR",
  "PROYECTO_LEER",
  "PROYECTO_GESTIONAR",
  "TAREA_LEER",
  "TAREA_GESTIONAR",
  "TAREA_REASIGNAR",
  "TAREA_CAMBIAR_ESTADO",
  "CALENDARIO_LEER",
  "CALENDARIO_GESTIONAR",
  "REUNION_LEER",
  "REUNION_GESTIONAR",
  "MENSAJE_ESCRIBIR",
  "NOTIFICACION_LEER",
  "ARCHIVO_SUBIR",
  "ANUNCIO_PUBLICAR",
  "SOLICITUD_APROBAR",
  "OBJETIVO_GESTIONAR",
  "AUTOMATIZACION_GESTIONAR",
  "AUDITORIA_LEER"
]);

export const roleContextInputSchema = z.object({
  userId: idSchema,
  projectId: idSchema.optional()
});

export const activeRoleSchema = z.object({
  userId: idSchema,
  projectId: idSchema.nullable(),
  role: systemRoleSchema,
  permissions: z.array(permissionSchema)
});

export type Permission = z.infer<typeof permissionSchema>;
export type ActiveRole = z.infer<typeof activeRoleSchema>;
