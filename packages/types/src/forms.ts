import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { requestStatusSchema, requestTypeSchema } from "./enums.js";

export const formRequestSchema = z.object({
  id: idSchema,
  requesterId: idSchema,
  type: requestTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  status: requestStatusSchema,
  approverId: idSchema.nullable(),
  comment: z.string().max(1000).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createFormRequestInputSchema = z.object({
  type: requestTypeSchema,
  payload: z.record(z.string(), z.unknown())
});

export const resolveFormRequestInputSchema = z.object({
  requestId: idSchema,
  status: z.enum(["APROBADA", "RECHAZADA"]),
  comment: z.string().min(3).max(1000)
});
