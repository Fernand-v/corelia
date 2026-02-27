import {
  notificationPreferenceSchema,
  notificationSyncInputSchema,
  notificationMarkReadInputSchema
} from "@corelia/types";
import { z } from "zod";

export const notificationSchemas = {
  upsertPreferenceSchema: notificationPreferenceSchema
    .pick({
      event: true,
      channel: true,
      frequency: true,
      enabled: true
    })
    .extend({
      userId: z.string().uuid().optional()
    }),
  syncQuerySchema: notificationSyncInputSchema,
  markReadSchema: notificationMarkReadInputSchema,
  unreadCountQuerySchema: z.object({
    since: z.string().datetime().optional()
  })
};
