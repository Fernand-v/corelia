import { z } from "zod";
import { createAnnouncementInputSchema } from "@corelia/types";

export const announcementSchemas = {
  createAnnouncementInputSchema,
  announcementAssetContentQuerySchema: z.object({
    token: z.string().min(1),
    mode: z.enum(["inline", "attachment"]).default("inline")
  })
};
