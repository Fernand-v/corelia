import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().min(1),
  DATABASE_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: envBoolean.default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().email(),
  OTEL_ENABLED: envBoolean.default(false),
  OTEL_SERVICE_NAME: z.string().default("corelia-workers"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal(""))
});

export const env = envSchema.parse(process.env);
