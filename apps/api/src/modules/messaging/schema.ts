import { createMessageInputSchema } from "@corelia/types";
import { z } from "zod";

export const messagingSchemas = {
  createMessageInputSchema,
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
  }),
  channelParamsSchema: z.object({
    channelId: z.string().uuid()
  })
};
