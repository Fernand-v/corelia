import { z } from "zod";
import { idSchema } from "./common.js";
import { webhookEventSchema } from "./enums.js";

export const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().email()
});

export const webhookEndpointSchema = z.object({
  id: idSchema,
  url: z.string().url(),
  event: webhookEventSchema,
  secret: z.string().min(12),
  enabled: z.boolean().default(true)
});

export const icsExportRequestSchema = z.object({
  userId: idSchema,
  from: z.string().datetime(),
  to: z.string().datetime()
});
