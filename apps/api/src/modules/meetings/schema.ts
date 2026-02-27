import {
  addMeetingNoteInputSchema,
  createMeetingAgreementInputSchema,
  createMeetingInputSchema,
  meetingStatusSchema
} from "@corelia/types";
import { z } from "zod";

export const meetingsSchemas = {
  createMeetingInputSchema,
  createMeetingAgreementInputSchema,
  addMeetingNoteInputSchema,
  meetingIdParamsSchema: z.object({
    meetingId: z.string().uuid()
  }),
  listMeetingsQuerySchema: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    projectId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional()
  }),
  updateMeetingStatusSchema: z.object({
    status: meetingStatusSchema
  })
};
