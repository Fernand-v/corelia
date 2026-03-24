import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { meetingAgreementStatusSchema, meetingStatusSchema } from "./enums.js";
import { roleCodeSchema } from "./rbac.js";

export const meetingAgendaItemSchema = z.object({
  id: idSchema,
  meetingId: idSchema,
  text: z.string().min(2).max(500),
  order: z.number().int().min(0),
  createdAt: timestampSchema
});

export const meetingParticipantSchema = z.object({
  id: idSchema,
  meetingId: idSchema,
  userId: idSchema,
  role: roleCodeSchema.nullable(),
  muted: z.boolean(),
  cameraOn: z.boolean(),
  screenSharing: z.boolean(),
  speaking: z.boolean(),
  joinedAt: timestampSchema.nullable(),
  leftAt: timestampSchema.nullable(),
  createdAt: timestampSchema
});

export const meetingNoteSchema = z.object({
  id: idSchema,
  meetingId: idSchema,
  authorId: idSchema,
  content: z.record(z.unknown()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const meetingAgreementSchema = z.object({
  id: idSchema,
  meetingId: idSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(2000).nullable(),
  descriptionCatalogId: idSchema.nullable().optional(),
  descriptionLabel: z.string().nullable().optional(),
  status: meetingAgreementStatusSchema,
  authorId: idSchema,
  taskId: idSchema.nullable(),
  createdTask: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const meetingSchema = z.object({
  id: idSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(2000).nullable(),
  descriptionCatalogId: idSchema.nullable().optional(),
  descriptionLabel: z.string().nullable().optional(),
  projectId: idSchema.nullable(),
  teamId: idSchema.nullable(),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  createdById: idSchema,
  status: meetingStatusSchema,
  mediaRoomId: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const createMeetingInputSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000).optional(),
    descriptionCatalogId: idSchema.optional(),
    projectId: idSchema.optional(),
    teamId: idSchema.optional(),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
    participantIds: z.array(idSchema).min(1),
    agenda: z.array(z.string().min(2).max(500)).default([])
  })
  .superRefine((input, ctx) => {
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La reunión debe terminar después del inicio"
      });
    }
    if (!input.projectId && !input.teamId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La reunión debe estar vinculada a un proyecto o equipo"
      });
    }
  });

export const addMeetingNoteInputSchema = z.object({
  meetingId: idSchema,
  content: z.record(z.unknown())
});

export const createMeetingAgreementInputSchema = z.object({
  meetingId: idSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  descriptionCatalogId: idSchema.optional(),
  existingTaskId: idSchema.optional(),
  createTask: z
    .object({
      projectId: idSchema,
      title: z.string().min(3).max(200),
      description: z.string().max(4000).optional(),
      descriptionCatalogId: idSchema.optional(),
      assigneeId: idSchema.optional(),
      dueDate: timestampSchema.optional()
    })
    .optional()
});

export const meetingAccessContextSchema = z.object({
  meetingId: idSchema,
  userId: idSchema
});

export type Meeting = z.infer<typeof meetingSchema>;
