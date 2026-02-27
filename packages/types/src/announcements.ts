import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const announcementAudienceSchema = z.object({
  allCompany: z.boolean().default(false),
  teamIds: z.array(idSchema).default([]),
  userIds: z.array(idSchema).default([])
});

export const announcementContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TITLE"),
    text: z.string().min(1).max(300)
  }),
  z.object({
    type: z.literal("SUBTITLE"),
    text: z.string().min(1).max(300)
  }),
  z.object({
    type: z.literal("TEXT"),
    text: z.string().min(1).max(8000)
  }),
  z.object({
    type: z.literal("IMAGE"),
    url: z.string().url(),
    alt: z.string().max(300).default("")
  }),
  z.object({
    type: z.literal("FILE"),
    label: z.string().min(1).max(180),
    url: z.string().url()
  }),
  z.object({
    type: z.literal("DIVIDER")
  })
]);

export const announcementContentSchema = z.object({
  blocks: z.array(announcementContentBlockSchema).max(100).default([])
});

export const announcementSchema = z.object({
  id: idSchema,
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(4000),
  content: announcementContentSchema.optional(),
  audience: announcementAudienceSchema,
  expiresAt: timestampSchema,
  createdById: idSchema,
  createdAt: timestampSchema
});

export const createAnnouncementInputSchema = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(4000),
  content: announcementContentSchema.optional(),
  audience: announcementAudienceSchema,
  expiresAt: timestampSchema
});

export type AnnouncementContentBlock = z.infer<typeof announcementContentBlockSchema>;
export type AnnouncementContent = z.infer<typeof announcementContentSchema>;
export type Announcement = z.infer<typeof announcementSchema>;
