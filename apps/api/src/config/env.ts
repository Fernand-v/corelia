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
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: envBoolean.default(false),
  MINIO_ACCESS_KEY: z.string().min(3),
  MINIO_SECRET_KEY: z.string().min(8),
  MINIO_BUCKET: z.string().min(3),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: envBoolean.default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().email(),
  MAINTENANCE_DEFAULT_MESSAGE: z.string().default("Corelia está en mantenimiento."),
  SOCKET_IO_ENABLED: envBoolean.default(true),
  SOCKET_IO_PATH: z.string().default("/ws/socket.io"),
  MEDIA_SERVER_ENABLED: envBoolean.default(true),
  MEDIA_MAX_PARTICIPANTS: z.coerce.number().int().positive().default(20),
  MEDIA_LISTEN_IP: z.string().default("0.0.0.0"),
  MEDIA_ANNOUNCED_IP: z.string().default("127.0.0.1"),
  MEDIA_MIN_PORT: z.coerce.number().int().positive().default(40000),
  MEDIA_MAX_PORT: z.coerce.number().int().positive().default(40100),
  GOOGLE_CALENDAR_CLIENT_ID: z.string().default(""),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().default(""),
  MICROSOFT_CALENDAR_CLIENT_ID: z.string().default(""),
  MICROSOFT_CALENDAR_CLIENT_SECRET: z.string().default(""),
  MICROSOFT_CALENDAR_REDIRECT_URI: z.string().default(""),
  SLACK_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  TEAMS_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  OTEL_ENABLED: envBoolean.default(false),
  OTEL_SERVICE_NAME: z.string().default("corelia-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal(""))
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
