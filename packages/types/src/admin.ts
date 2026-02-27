import { z } from "zod";
import { idSchema, paginationSchema, timestampSchema, windowScheduleSchema } from "./common.js";
import { permissionSchema } from "./rbac.js";
import { requestStatusSchema, systemRoleSchema } from "./enums.js";

export const adminUserStateSchema = z.enum(["ACTIVO", "INACTIVO", "ONBOARDING", "OFFBOARDING"]);

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  role: systemRoleSchema.optional(),
  teamId: idSchema.optional(),
  state: adminUserStateSchema.optional()
});

export const adminUserListItemSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  role: systemRoleSchema,
  teamId: idSchema.nullable(),
  teamName: z.string().nullable(),
  state: adminUserStateSchema,
  createdAt: timestampSchema,
  deactivatedAt: timestampSchema.nullable()
});

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserListItemSchema),
  total: z.number().int().min(0)
});

export const adminCreateUserInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8).max(128).optional(),
  baseRole: systemRoleSchema,
  teamId: idSchema.optional(),
  workSchedule: windowScheduleSchema.optional(),
  startOnboarding: z.boolean().default(false),
  checklistId: idSchema.optional()
});

export const adminUpdateUserInputSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  baseRole: systemRoleSchema.optional(),
  teamId: idSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  workSchedule: windowScheduleSchema.optional()
});

export const adminOffboardingPreviewInputSchema = z.object({
  userId: idSchema
});

export const adminOffboardingPreviewSchema = z.object({
  userId: idSchema,
  activeTasks: z.array(
    z.object({
      id: idSchema,
      title: z.string().min(1),
      projectId: idSchema,
      projectName: z.string().min(1)
    })
  ),
  leadershipProjects: z.array(
    z.object({
      projectId: idSchema,
      projectName: z.string().min(1),
      role: systemRoleSchema
    })
  ),
  ownedDocuments: z.array(
    z.object({
      fileId: idSchema,
      originalName: z.string().min(1)
    })
  )
});

export const adminOffboardingExecuteInputSchema = z.object({
  userId: idSchema,
  primaryTransferToUserId: idSchema,
  reason: z.string().min(5).max(500),
  archiveHistory: z.boolean().default(true),
  taskTransfers: z.array(
    z.object({
      taskId: idSchema,
      toUserId: idSchema
    })
  ),
  leadershipTransfers: z.array(
    z.object({
      projectId: idSchema,
      role: systemRoleSchema,
      toUserId: idSchema
    })
  ),
  documentTransfers: z.array(
    z.object({
      fileId: idSchema,
      toUserId: idSchema
    })
  )
});

export const adminCreateExternalInviteInputSchema = z.object({
  email: z.string().email(),
  resourceType: z.enum(["PROYECTO", "ARCHIVO", "DOCUMENTO"]),
  resourceId: idSchema,
  expiresAt: timestampSchema
});

export const adminExternalInviteItemSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  resourceType: z.enum(["PROYECTO", "ARCHIVO", "DOCUMENTO"]),
  resourceId: idSchema,
  expiresAt: timestampSchema,
  revokedAt: timestampSchema.nullable(),
  acceptedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  createdByName: z.string().nullable()
});

export const adminExternalInviteListSchema = z.object({
  items: z.array(adminExternalInviteItemSchema),
  total: z.number().int().min(0)
});

export const adminExtendInviteInputSchema = z.object({
  expiresAt: timestampSchema
});

export const adminCreateInternalInviteInputSchema = z.object({
  email: z.string().email(),
  baseRole: systemRoleSchema,
  teamId: idSchema.optional(),
  expiresAt: timestampSchema
});

export const adminInternalInviteItemSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  baseRole: systemRoleSchema,
  teamId: idSchema.nullable(),
  teamName: z.string().nullable(),
  expiresAt: timestampSchema,
  revokedAt: timestampSchema.nullable(),
  acceptedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  resentAt: timestampSchema.nullable(),
  createdByName: z.string().nullable()
});

export const adminInternalInviteListSchema = z.object({
  items: z.array(adminInternalInviteItemSchema),
  total: z.number().int().min(0)
});

export const adminResendInternalInviteInputSchema = z.object({
  expiresAt: timestampSchema.optional()
});

export const adminTeamListItemSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  coordinator: z
    .object({
      userId: idSchema,
      fullName: z.string().min(1)
    })
    .nullable(),
  membersCount: z.number().int().min(0),
  activeProjects: z.number().int().min(0)
});

export const adminTeamsListSchema = z.object({
  items: z.array(adminTeamListItemSchema),
  total: z.number().int().min(0)
});

export const adminCreateTeamInputSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  coordinatorUserId: idSchema.optional(),
  memberIds: z.array(idSchema).default([])
});

export const adminUpdateTeamInputSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(400).nullable().optional(),
  coordinatorUserId: idSchema.nullable().optional(),
  memberIds: z.array(idSchema).optional()
});

export const adminRolePermissionSchema = z.object({
  role: systemRoleSchema,
  permissions: z.array(permissionSchema)
});

export const adminAccessByResourceQuerySchema = z.object({
  type: z.enum(["PROYECTO", "EQUIPO", "ARCHIVO", "DOCUMENTO"]),
  id: idSchema
});

export const adminResourceAccessItemSchema = z.object({
  userId: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  accessLevel: z.string().min(1)
});

export const adminOverviewSchema = z.object({
  generatedAt: timestampSchema,
  totals: z.object({
    users: z.number().int().min(0),
    teams: z.number().int().min(0),
    projects: z.number().int().min(0),
    tasks: z.number().int().min(0),
    overdueTasks: z.number().int().min(0)
  }),
  organization: z.object({
    name: z.string().min(1),
    defaultTimezone: z.string().min(1),
    defaultLanguage: z.string().min(2),
    workingDays: z.array(z.number().int().min(0).max(6)),
    workingHours: z.object({
      startHour: z.string().min(1),
      endHour: z.string().min(1)
    })
  }),
  automations: z.object({
    total: z.number().int().min(0),
    enabled: z.number().int().min(0),
    failedLast24h: z.number().int().min(0)
  }),
  forms: z.object({
    activeRequests: z.number().int().min(0),
    pendingApproval: z.number().int().min(0),
    byStatus: z.array(
      z.object({
        status: requestStatusSchema,
        total: z.number().int().min(0)
      })
    )
  }),
  system: z.object({
    maintenanceEnabled: z.boolean(),
    maintenanceMessage: z.string().nullable(),
    services: z.array(
      z.object({
        service: z.enum(["api", "postgres", "redis", "storage", "media"]),
        status: z.enum(["up", "down", "degraded"]),
        detail: z.string().nullable()
      })
    )
  }),
  integrations: z.object({
    webhooksConfigured: z.number().int().min(0),
    webhooksEnabled: z.number().int().min(0),
    latestDeliveries: z.array(
      z.object({
        id: idSchema,
        endpointId: idSchema,
        success: z.boolean(),
        statusCode: z.number().int().nullable(),
        attemptedAt: timestampSchema
      })
    )
  }),
  announcements: z.object({
    active: z.number().int().min(0),
    recent: z.array(
      z.object({
        id: idSchema,
        title: z.string().min(1),
        createdAt: timestampSchema,
        expiresAt: timestampSchema
      })
    )
  }),
  imports: z.object({
    latestJobs: z.array(
      z.object({
        id: idSchema,
        source: z.enum(["CSV", "TRELLO_JSON", "NOTION_CSV"]),
        filename: z.string().min(1),
        startedAt: timestampSchema,
        finishedAt: timestampSchema.nullable(),
        success: z.boolean()
      })
    )
  }),
  audit: z.object({
    latestEvents: z.array(
      z.object({
        id: idSchema,
        entityType: z.string().min(1),
        action: z.string().min(1),
        createdAt: timestampSchema,
        userId: idSchema.nullable()
      })
    )
  }),
  pagination: paginationSchema
});

export type AdminOverview = z.infer<typeof adminOverviewSchema>;
