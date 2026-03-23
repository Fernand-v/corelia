import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const announcementScheduleTypeSchema = z.enum([
  "INMEDIATO",
  "PROGRAMADO",
  "CUMPLEANOS"
]);

export type AnnouncementScheduleType = z.infer<typeof announcementScheduleTypeSchema>;

export const announcementAudienceSchema = z.object({
  allCompany: z.boolean().default(false),
  teamIds: z.array(idSchema).default([]),
  userIds: z.array(idSchema).default([])
});

const announcementAssetPathSchema = z
  .string()
  .trim()
  .regex(/^\/(?:api\/v1\/)?announcements\/assets\/content\?/i);

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
    url: z.union([z.string().url(), announcementAssetPathSchema]),
    alt: z.string().max(300).default("")
  }),
  z.object({
    type: z.literal("FILE"),
    label: z.string().min(1).max(180),
    url: z.union([z.string().url(), announcementAssetPathSchema])
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
  scheduleType: announcementScheduleTypeSchema.default("INMEDIATO"),
  startsAt: timestampSchema.nullable().optional(),
  expiresAt: timestampSchema,
  recurringMonth: z.number().int().min(1).max(12).nullable().optional(),
  recurringDay: z.number().int().min(1).max(31).nullable().optional(),
  createdById: idSchema,
  createdAt: timestampSchema
});

export const createAnnouncementInputSchema = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(1).max(4000),
  content: announcementContentSchema.optional(),
  audience: announcementAudienceSchema,
  scheduleType: announcementScheduleTypeSchema.default("INMEDIATO"),
  startsAt: timestampSchema.nullable().optional(),
  expiresAt: timestampSchema,
  recurringMonth: z.number().int().min(1).max(12).nullable().optional(),
  recurringDay: z.number().int().min(1).max(31).nullable().optional()
});

export type AnnouncementContentBlock = z.infer<typeof announcementContentBlockSchema>;
export type AnnouncementContent = z.infer<typeof announcementContentSchema>;
export type Announcement = z.infer<typeof announcementSchema>;
