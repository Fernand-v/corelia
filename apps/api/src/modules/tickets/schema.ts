import {
  assignTicketInputSchema,
  createTicketInputSchema,
  ticketCommentInputSchema,
  ticketListQuerySchema,
  updateTicketInputSchema
} from "@corelia/types";
import { z } from "zod";

export const ticketSchemas = {
  createTicketInputSchema,
  updateTicketInputSchema,
  assignTicketInputSchema,
  ticketCommentInputSchema,
  ticketListQuerySchema,
  ticketIdParamsSchema: z.object({
    id: z.string().uuid()
  })
};
