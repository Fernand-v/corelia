import {
  meetingCallJoinInputSchema,
  meetingCallLeaveInputSchema,
  meetingParticipantStateUpdateSchema,
  meetingWebRtcSignalSchema,
  notificationSyncInputSchema
} from "@corelia/types";
import { z } from "zod";

export {
  meetingCallJoinInputSchema,
  meetingCallLeaveInputSchema,
  meetingParticipantStateUpdateSchema,
  meetingWebRtcSignalSchema,
  notificationSyncInputSchema
};

export const conversationInputSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid().optional()
});

export const callEndInputSchema = z.object({
  conversationId: z.string().uuid(),
  targetUserId: z.string().uuid().optional()
});

export const callSignalInputSchema = z.object({
  conversationId: z.string().uuid(),
  to: z.string().uuid(),
  from: z.string().uuid().optional(),
  offer: z.record(z.unknown()).optional(),
  answer: z.record(z.unknown()).optional(),
  candidate: z.record(z.unknown()).optional()
});

export const callStateInputSchema = z.object({
  conversationId: z.string().uuid(),
  to: z.string().uuid().optional(),
  from: z.string().uuid().optional(),
  state: z
    .object({
      audioOn: z.boolean().optional(),
      videoOn: z.boolean().optional(),
      screenSharing: z.boolean().optional()
    })
    .passthrough()
});

export const callRecordingInputSchema = z.object({
  conversationId: z.string().uuid(),
  recordingId: z.string().min(1)
});

export const callTranscriptInputSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  transcript: z.string().min(1),
  timestamp: z.number().optional()
});
