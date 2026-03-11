import { z } from "zod";
import { codeValueSchema, idSchema, paginationSchema, timestampSchema, windowScheduleSchema } from "./common.js";
import { signupRequestStatusSchema } from "./auth.js";
import { requestStatusSchema } from "./enums.js";
import { permissionSchema, roleCodeSchema, systemRoleCodeSchema } from "./rbac.js";
import { serviceHealthSchema } from "./status.js";

export const adminUserStateSchema = z.enum(["ACTIVO", "INACTIVO", "ONBOARDING", "OFFBOARDING"]);

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  role: systemRoleCodeSchema.optional(),
  teamId: idSchema.optional(),
  state: adminUserStateSchema.optional()
});

export const adminUserListItemSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  role: systemRoleCodeSchema,
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
  baseRole: systemRoleCodeSchema,
  teamId: idSchema.optional(),
  workSchedule: windowScheduleSchema.optional(),
  startOnboarding: z.boolean().default(false),
  checklistId: idSchema.optional()
});

export const adminUpdateUserInputSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  baseRole: systemRoleCodeSchema.optional(),
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
      role: roleCodeSchema
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
      role: roleCodeSchema,
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
  resourceScopeType: z.enum(["PROYECTO", "ARCHIVO", "DOCUMENTO"]),
  resourceScopeId: idSchema,
  expiresAt: timestampSchema
});

export const adminExternalInviteItemSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  resourceScopeType: z.enum(["PROYECTO", "ARCHIVO", "DOCUMENTO"]),
  resourceScopeId: idSchema,
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
  baseRole: systemRoleCodeSchema,
  teamId: idSchema.optional(),
  expiresAt: timestampSchema
});

export const adminInternalInviteItemSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  baseRole: systemRoleCodeSchema,
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

export const adminSignupRequestsQuerySchema = z.object({
  status: signupRequestStatusSchema.optional()
});

export const adminSignupRequestItemSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  message: z.string().nullable(),
  status: signupRequestStatusSchema,
  requestedAt: timestampSchema,
  reviewedAt: timestampSchema.nullable(),
  reviewedById: idSchema.nullable(),
  reviewedByName: z.string().nullable(),
  decisionNote: z.string().nullable(),
  inviteId: idSchema.nullable()
});

export const adminSignupRequestListSchema = z.object({
  items: z.array(adminSignupRequestItemSchema),
  total: z.number().int().min(0)
});

export const adminApproveSignupRequestInputSchema = z.object({
  baseRole: systemRoleCodeSchema.default("COLABORADOR"),
  teamId: idSchema.optional(),
  expiresAt: timestampSchema.optional()
});

export const adminRejectSignupRequestInputSchema = z.object({
  reason: z.string().trim().min(5).max(500)
});

export const adminTeamListItemSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  descriptionCatalogId: codeValueSchema.nullable().optional(),
  descriptionLabel: z.string().nullable().optional(),
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
  descriptionCatalogId: codeValueSchema.optional(),
  coordinatorUserId: idSchema.optional(),
  memberIds: z.array(idSchema).default([])
});

export const adminUpdateTeamInputSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(400).nullable().optional(),
  descriptionCatalogId: codeValueSchema.nullable().optional(),
  coordinatorUserId: idSchema.nullable().optional(),
  memberIds: z.array(idSchema).optional()
});

export const adminCodeCatalogDomainSchema = z.enum([
  "TASK",
  "PROJECT",
  "TEAM",
  "MEETING",
  "OBJECTIVE",
  "DECISION",
  "IDENTITY",
  "AUDIT"
]);

export const adminCodeCatalogFieldSchema = z.string().min(3).max(64);

export const adminCodeCatalogSchema = z.object({
  id: idSchema,
  domain: adminCodeCatalogDomainSchema,
  field: adminCodeCatalogFieldSchema,
  code: codeValueSchema,
  label: z.string().min(1).max(160),
  description: z.string().max(500).nullable(),
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

export const adminListCodeCatalogsQuerySchema = z.object({
  domain: adminCodeCatalogDomainSchema,
  field: adminCodeCatalogFieldSchema.optional(),
  includeInactive: z.coerce.boolean().optional().default(false)
});

export const adminCreateCodeCatalogInputSchema = z.object({
  domain: adminCodeCatalogDomainSchema,
  field: adminCodeCatalogFieldSchema,
  code: codeValueSchema,
  label: z.string().min(1).max(160),
  description: z.string().max(500).optional()
});

export const adminUpdateCodeCatalogInputSchema = z.object({
  label: z.string().min(1).max(160).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional()
});

export const adminRolePermissionSchema = z.object({
  role: roleCodeSchema,
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

export const adminAuditReportQuerySchema = z
  .object({
    from: timestampSchema.optional(),
    to: timestampSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50)
  })
  .superRefine((input, ctx) => {
    if (!input.from || !input.to) {
      return;
    }
    if (new Date(input.to).getTime() < new Date(input.from).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rango inválido: 'to' debe ser mayor o igual a 'from'",
        path: ["to"]
      });
    }
  });

export const adminAuditReportExportQuerySchema = z
  .object({
    from: timestampSchema.optional(),
    to: timestampSchema.optional()
  })
  .superRefine((input, ctx) => {
    if (!input.from || !input.to) {
      return;
    }
    if (new Date(input.to).getTime() < new Date(input.from).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rango inválido: 'to' debe ser mayor o igual a 'from'",
        path: ["to"]
      });
    }
  });

export const adminAuditReportItemSchema = z.object({
  id: idSchema,
  entityType: z.string().min(1),
  action: z.string().min(1),
  entityId: z.string().nullable(),
  reason: z.string().nullable(),
  reasonCatalogId: z.string().nullable(),
  userId: idSchema.nullable(),
  actorName: z.string().nullable(),
  createdAt: timestampSchema
});

export const adminAuditReportResponseSchema = z.object({
  items: z.array(adminAuditReportItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  from: timestampSchema,
  to: timestampSchema
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
        userId: idSchema.nullable(),
        userName: z.string().nullable()
      })
    )
  }),
  pagination: paginationSchema
});

export const adminSystemStatusOverallSchema = z.enum(["OK", "ERROR"]);

export const adminSystemStatusChangedServiceSchema = z.object({
  service: serviceHealthSchema.shape.service,
  previousStatus: serviceHealthSchema.shape.status.nullable(),
  previousDetail: z.string().nullable(),
  nextStatus: serviceHealthSchema.shape.status,
  nextDetail: z.string().nullable()
});

export const adminSystemStatusChangeSchema = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  userId: idSchema.nullable(),
  reason: z.string().nullable(),
  overallStatus: adminSystemStatusOverallSchema,
  changedServices: z.array(adminSystemStatusChangedServiceSchema)
});

export const adminSystemStatusResponseSchema = z.object({
  now: timestampSchema,
  overallStatus: adminSystemStatusOverallSchema,
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().nullable()
  }),
  services: z.array(serviceHealthSchema),
  recentChanges: z.array(adminSystemStatusChangeSchema)
});

export const adminSystemStatusCheckResponseSchema = adminSystemStatusResponseSchema.extend({
  changed: z.boolean(),
  changedServices: z.array(adminSystemStatusChangedServiceSchema),
  auditLogged: z.boolean()
});

export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type AdminSystemStatusResponse = z.infer<typeof adminSystemStatusResponseSchema>;
export type AdminSystemStatusCheckResponse = z.infer<typeof adminSystemStatusCheckResponseSchema>;
export type AdminAuditReportResponse = z.infer<typeof adminAuditReportResponseSchema>;
