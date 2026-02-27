import {
  calendarCapacityQuerySchema,
  calendarSharedQuerySchema,
  calendarTaskRescheduleInputSchema,
  calendarRangeSchema,
  externalCalendarProviderSchema,
  externalCalendarConnectInputSchema,
  externalCalendarSyncInputSchema
} from "@corelia/types";
import { z } from "zod";

export const calendarSchemas = {
  calendarRangeSchema,
  calendarSharedQuerySchema,
  calendarTaskRescheduleInputSchema,
  calendarCapacityQuerySchema,
  connectExternalCalendarSchema: externalCalendarConnectInputSchema,
  syncExternalEventsSchema: externalCalendarSyncInputSchema,
  externalOauthUrlQuerySchema: z.object({
    provider: externalCalendarProviderSchema
  })
};
