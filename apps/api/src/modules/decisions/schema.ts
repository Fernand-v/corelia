import { createDecisionNoteInputSchema } from "@corelia/types";
import { z } from "zod";

export const decisionSchemas = {
  createDecisionNoteInputSchema,
  listQuerySchema: z.object({
    linkedEntityType: z
      .enum([
        "USUARIO",
        "PROYECTO",
        "TAREA",
        "MENSAJE",
        "ARCHIVO",
        "SOLICITUD",
        "ANUNCIO",
        "OBJETIVO",
        "DECISION",
        "AUTOMATIZACION"
      ])
      .optional(),
    linkedEntityId: z.string().uuid().optional()
  })
};
