import { z } from "zod";
import { createAnnouncementInputSchema } from "@corelia/types";

export const announcementSchemas = {
  createAnnouncementInputSchema,
  announcementIdParamSchema: z.object({
    announcementId: z.string().uuid()
  }),
  announcementAssetContentQuerySchema: z.object({
    token: z.string().min(1),
    mode: z.enum(["inline", "attachment"]).default("inline")
  })
};
