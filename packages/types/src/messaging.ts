import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { channelScopeSchema } from "./enums.js";

export const channelSchema = z.object({
  id: idSchema,
  name: z.string().min(2).max(120),
  scope: channelScopeSchema,
  teamId: idSchema.nullable(),
  projectId: idSchema.nullable(),
  createdAt: timestampSchema
});

export const messageSchema = z.object({
  id: idSchema,
  channelId: idSchema,
  authorId: idSchema,
  content: z.string().min(1).max(10000),
  mentions: z.array(idSchema).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createMessageInputSchema = z.object({
  channelId: idSchema,
  content: z.string().min(1).max(10000),
  mentions: z.array(idSchema).default([])
});

export const listMessagesQuerySchema = z.object({
  channelId: idSchema
});

export const listChannelsQuerySchema = z.object({
  projectId: idSchema.optional(),
  teamId: idSchema.optional()
});

export type Channel = z.infer<typeof channelSchema>;
export type Message = z.infer<typeof messageSchema>;
