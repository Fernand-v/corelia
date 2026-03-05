import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { channelScopeSchema } from "./enums.js";

export const messageKindSchema = z.enum(["TEXT", "FILE", "CALL_INVITE"]);

export const channelSchema = z.object({
  id: idSchema,
  name: z.string().min(2).max(120),
  scope: channelScopeSchema,
  teamId: idSchema.nullable(),
  projectId: idSchema.nullable(),
  createdAt: timestampSchema
});

export const messageAttachmentSchema = z.object({
  id: idSchema,
  messageId: idSchema,
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().nonnegative(),
  minioPath: z.string().min(1).max(600),
  createdAt: timestampSchema
});

export const messageSchema = z.object({
  id: idSchema,
  channelId: idSchema,
  authorId: idSchema,
  kind: messageKindSchema.default("TEXT"),
  content: z.string().min(1).max(10000),
  mentions: z.array(idSchema).default([]),
  meetingId: idSchema.nullable().optional(),
  attachments: z.array(messageAttachmentSchema).default([]),
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

export const messagingConversationPreviewSchema = z.object({
  messageId: idSchema,
  content: z.string().min(1).max(160),
  kind: messageKindSchema,
  createdAt: timestampSchema,
  authorId: idSchema
});

export const messagingConversationProjectItemSchema = z.object({
  projectId: idSchema,
  projectName: z.string().min(1).max(160),
  channelId: idSchema.nullable(),
  channelName: z.string().min(1).max(120).nullable(),
  lastMessage: messagingConversationPreviewSchema.nullable(),
  lastActivityAt: timestampSchema.nullable()
});

export const messagingConversationPrivateItemSchema = z.object({
  channelId: idSchema,
  channelName: z.string().min(1).max(120),
  peerUserId: idSchema.nullable(),
  peerFullName: z.string().min(1).max(220).nullable(),
  lastMessage: messagingConversationPreviewSchema.nullable(),
  lastActivityAt: timestampSchema.nullable()
});

export const messagingConversationsResponseSchema = z.object({
  projectItems: z.array(messagingConversationProjectItemSchema),
  privateItems: z.array(messagingConversationPrivateItemSchema)
});

export type Channel = z.infer<typeof channelSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type MessagingConversationsResponse = z.infer<typeof messagingConversationsResponseSchema>;
