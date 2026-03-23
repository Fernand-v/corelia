import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import {
  notificationChannelSchema,
  notificationEventSchema,
  notificationFrequencySchema,
  notificationPrioritySchema
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
  priority: notificationPrioritySchema.default("NORMAL"),
  groupKey: z.string().max(300).nullable().optional(),
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
  body: z.string().min(1).max(2000),
  priority: notificationPrioritySchema.optional(),
  groupKey: z.string().max(300).optional()
});

export const notificationSyncInputSchema = z.object({
  since: timestampSchema.optional()
});

export const notificationMarkReadInputSchema = z.object({
  ids: z.array(idSchema).min(1)
});

export const browserPushConfigSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().min(1).nullable()
});

export const browserPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().int().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export const browserPushSubscriptionUpsertSchema = z.object({
  subscription: browserPushSubscriptionSchema
});

export const browserPushSubscriptionDeleteSchema = z.object({
  endpoint: z.string().url()
});

export type NotificationItem = z.infer<typeof notificationSchema>;
export type NotificationDispatchInput = z.infer<typeof notificationDispatchInputSchema>;
export type BrowserPushConfig = z.infer<typeof browserPushConfigSchema>;
export type BrowserPushSubscriptionPayload = z.infer<typeof browserPushSubscriptionSchema>;
export type BrowserPushSubscriptionUpsertInput = z.infer<typeof browserPushSubscriptionUpsertSchema>;
export type BrowserPushSubscriptionDeleteInput = z.infer<typeof browserPushSubscriptionDeleteSchema>;
