import { z } from "zod";

export const serviceHealthSchema = z.object({
  service: z.enum(["api", "postgres", "redis", "storage", "media"]),
  status: z.enum(["up", "down", "degraded"]),
  detail: z.string().nullable()
});

export const systemStatusSchema = z.object({
  now: z.string().datetime(),
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().nullable()
  }),
  services: z.array(serviceHealthSchema)
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;
