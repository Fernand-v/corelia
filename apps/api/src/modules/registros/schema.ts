import {
  ciudadInputSchema,
  empresaInputSchema,
  paisInputSchema,
  personaInputSchema,
  sexoInputSchema,
  sucursalInputSchema
} from "@corelia/types";
import { z } from "zod";

export const registrosSchemas = {
  empresaInputSchema,
  sucursalInputSchema,
  paisInputSchema,
  ciudadInputSchema,
  sexoInputSchema,
  personaInputSchema,
  idParamsSchema: z.object({ id: z.string().uuid() })
};
