import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

export const ticketCatalogItemSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string().min(1)
});

export const ticketMetaSchema = z.object({
  estados: z.array(ticketCatalogItemSchema),
  prioridades: z.array(ticketCatalogItemSchema)
});

export const ticketCommentSchema = z.object({
  id: idSchema,
  ticketId: idSchema,
  authorId: idSchema,
  authorName: z.string().nullable().optional(),
  content: z.string().min(1).max(4000),
  createdAt: timestampSchema
});

export const ticketSchema = z.object({
  id: idSchema,
  code: z.number().int().min(1),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).nullable(),
  estadoId: z.number().int().positive(),
  estado: ticketCatalogItemSchema.optional(),
  prioridadId: z.number().int().positive(),
  prioridad: ticketCatalogItemSchema.optional(),
  assigneeId: idSchema.nullable(),
  assigneeName: z.string().nullable().optional(),
  createdById: idSchema,
  createdByName: z.string().nullable().optional(),
  resolvedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  comments: z.array(ticketCommentSchema).optional()
});

export const createTicketInputSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  prioridadId: z.number().int().positive().default(2)
});

export const updateTicketInputSchema = z
  .object({
    estadoId: z.number().int().positive().optional(),
    prioridadId: z.number().int().positive().optional()
  })
  .refine((input) => input.estadoId !== undefined || input.prioridadId !== undefined, {
    message: "Debe indicar al menos un campo a actualizar"
  });

export const assignTicketInputSchema = z.object({
  assigneeId: idSchema.nullable()
});

export const ticketCommentInputSchema = z.object({
  content: z.string().min(1).max(4000)
});

export const ticketListQuerySchema = z.object({
  estadoId: z.coerce.number().int().positive().optional(),
  prioridadId: z.coerce.number().int().positive().optional(),
  mine: z.coerce.boolean().optional()
});

export type TicketCatalogItem = z.infer<typeof ticketCatalogItemSchema>;
export type TicketMeta = z.infer<typeof ticketMetaSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketComment = z.infer<typeof ticketCommentSchema>;
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketInputSchema>;
export type TicketCommentInput = z.infer<typeof ticketCommentInputSchema>;
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
