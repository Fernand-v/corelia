import { createMessageInputSchema } from "@corelia/types";
import { z } from "zod";

export const messagingSchemas = {
  createMessageInputSchema,
  createFileMessageInputSchema: z.object({
    channelId: z.string().uuid(),
    content: z.string().max(10000).optional().default(""),
    mentions: z.array(z.string().uuid()).optional().default([])
  }),
  listMessagesQuerySchema: z.object({
    channelId: z.string().uuid()
  }),
  listChannelsQuerySchema: z.object({
    projectId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional()
  }),
  createDirectChannelSchema: z.object({
    targetUserId: z.string().uuid()
  }),
  createChannelSchema: z.object({
    name: z.string().min(2).max(120),
    scope: z.enum(["EQUIPO", "PROYECTO"]),
    teamId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    memberIds: z.array(z.string().uuid()).default([])
  }).superRefine((input, ctx) => {
    if (input.scope === "PROYECTO") {
      if (!input.projectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "projectId es obligatorio para canales de proyecto",
          path: ["projectId"]
        });
      }
      if (input.teamId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "teamId debe ser nulo en canales de proyecto",
          path: ["teamId"]
        });
      }
    }

    if (input.scope === "EQUIPO") {
      if (!input.teamId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "teamId es obligatorio para canales de equipo",
          path: ["teamId"]
        });
      }
      if (input.projectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "projectId debe ser nulo en canales de equipo",
          path: ["projectId"]
        });
      }
    }
  }),
  projectParamsSchema: z.object({
    projectId: z.string().uuid()
  }),
  channelParamsSchema: z.object({
    channelId: z.string().uuid()
  }),
  attachmentParamsSchema: z.object({
    attachmentId: z.string().uuid()
  }),
  attachmentContentQuerySchema: z.object({
    mode: z.enum(["inline", "attachment"]).default("attachment")
  })
};
