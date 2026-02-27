import { z } from "zod";
import { idSchema } from "./common.js";

export const meetingCallJoinInputSchema = z.object({
  meetingId: idSchema
});

export const meetingCallLeaveInputSchema = z.object({
  meetingId: idSchema
});

export const meetingParticipantStateSchema = z.object({
  meetingId: idSchema,
  muted: z.boolean().optional(),
  cameraOn: z.boolean().optional(),
  screenSharing: z.boolean().optional(),
  speaking: z.boolean().optional()
});

export const meetingParticipantStateUpdateSchema = meetingParticipantStateSchema.superRefine(
  (input, ctx) => {
    if (
      input.muted === undefined &&
      input.cameraOn === undefined &&
      input.screenSharing === undefined &&
      input.speaking === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes enviar al menos un estado de participante"
      });
    }
  }
);

export const meetingWebRtcSignalTypeSchema = z.enum([
  "OFFER",
  "ANSWER",
  "ICE_CANDIDATE",
  "SCREEN_SHARE_OFFER",
  "SCREEN_SHARE_ANSWER",
  "SCREEN_SHARE_STOP"
]);

export const meetingWebRtcSignalSchema = z.object({
  meetingId: idSchema,
  signalType: meetingWebRtcSignalTypeSchema,
  targetUserId: idSchema.optional(),
  data: z.record(z.unknown())
});

export type MeetingWebRtcSignalType = z.infer<typeof meetingWebRtcSignalTypeSchema>;
