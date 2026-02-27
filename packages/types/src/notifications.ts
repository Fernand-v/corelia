import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import {
  notificationChannelSchema,
  notificationEventSchema,
  notificationFrequencySchema
} from "./enums.js";

export const notificationPreferenceSchema = z.object({
  id: idSchema,
  userId: idSchema,
  event: notificationEventSchema,
  channel: notificationChannelSchema,
  frequency: notificationFrequencySchema,
  enabled: z.boolean()
});

export const notificationSchema = z.object({
  id: idSchema,
  userId: idSchema,
  event: notificationEventSchema,
  channel: notificationChannelSchema,
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(2000),
  sentAt: timestampSchema.nullable(),
  deliveredAt: timestampSchema.nullable(),
  readAt: timestampSchema.nullable(),
  createdAt: timestampSchema
});

export const notificationDispatchInputSchema = z.object({
  userId: idSchema,
  event: notificationEventSchema,
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(2000)
});

export const notificationSyncInputSchema = z.object({
  since: timestampSchema.optional()
});

export const notificationMarkReadInputSchema = z.object({
  ids: z.array(idSchema).min(1)
});
