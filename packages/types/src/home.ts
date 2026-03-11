import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";
import { taskStatusSchema } from "./enums.js";
import { roleCodeSchema } from "./rbac.js";
import { announcementContentSchema } from "./announcements.js";

export const homeQuickActionSchema = z.object({
  key: z.string().min(2).max(64),
  label: z.string().min(2).max(80),
  path: z.string().min(1),
  intent: z.enum(["CREATE", "VIEW", "MANAGE", "SEARCH", "APPROVE"])
});

export const homeMyDayTaskSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  status: taskStatusSchema,
  dueDate: timestampSchema.nullable(),
  overdue: z.boolean(),
  projectId: idSchema,
  projectName: z.string().min(1)
});

export const homeMeetingSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  projectId: idSchema.nullable(),
  projectName: z.string().nullable(),
  joinPath: z.string().min(1)
});

export const homePendingRequestSchema = z.object({
  id: idSchema,
  type: z.enum(["VACACIONES", "PERMISO", "ACCESO_RECURSO"]),
  status: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA"]),
  createdAt: timestampSchema
});

export const homeMyDayBlockSchema = z.object({
  dueOrOverdueTasks: z.array(homeMyDayTaskSchema),
  nextMeeting: homeMeetingSchema.nullable(),
  pendingRequests: z.array(homePendingRequestSchema)
});

export const homeProjectProgressSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1),
  completionPct: z.number().min(0).max(100),
  involvedBlockedTasks: z.number().int().min(0),
  blockedPct: z.number().min(0).max(100),
  overdueOpenTasks: z.number().int().min(0),
  nextMilestone: z
    .object({
      title: z.string().min(1),
      targetDate: timestampSchema,
      daysRemaining: z.number().int()
    })
    .nullable(),
  risk: z.boolean()
});

export const homeNotificationItemSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  createdAt: timestampSchema,
  readAt: timestampSchema.nullable(),
  path: z.string().min(1)
});

export const homeTaskChangeItemSchema = z.object({
  taskId: idSchema,
  taskTitle: z.string().min(1),
  changeType: z.enum(["REASIGNACION", "CAMBIO_ESTADO"]),
  changedAt: timestampSchema,
  fromStatus: taskStatusSchema.nullable().optional(),
  toStatus: taskStatusSchema.nullable().optional()
});

export const homeRecentActivityBlockSchema = z.object({
  unreadNotifications: z.array(homeNotificationItemSchema),
  recentTaskChanges: z.array(homeTaskChangeItemSchema)
});

export const homeAnnouncementItemSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  content: announcementContentSchema.optional(),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  isNew: z.boolean()
});

export const homeTeamMemberStatusSchema = z.object({
  userId: idSchema,
  fullName: z.string().min(1),
  availability: z.enum(["DISPONIBLE", "OCUPADO", "EN_REUNION", "AUSENTE"]),
  overdueTasks: z.number().int().min(0),
  capacityPct: z.number().min(0),
  overloaded: z.boolean()
});

export const homeTeamTodayBlockSchema = z.object({
  teamId: idSchema,
  teamName: z.string().min(1),
  members: z.array(homeTeamMemberStatusSchema)
});

export const homeUnassignedTaskSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  status: taskStatusSchema,
  projectId: idSchema,
  projectName: z.string().min(1),
  createdAt: timestampSchema
});

export const homePendingDecisionsBlockSchema = z.object({
  reassignmentApprovals: z.number().int().min(0),
  pendingProjectDocuments: z.number().int().min(0),
  pendingTeamRequests: z.number().int().min(0)
});

export const homeSystemServiceSchema = z.object({
  service: z.enum(["api", "postgres", "redis", "storage", "media"]),
  status: z.enum(["up", "down", "degraded"]),
  detail: z.string().nullable()
});

export const homeSystemStateBlockSchema = z.object({
  now: timestampSchema,
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().nullable()
  }),
  services: z.array(homeSystemServiceSchema),
  grafanaUrl: z.string().min(1)
});

export const homeOrgActivityBlockSchema = z.object({
  newUsersLast7Days: z.number().int().min(0),
  onboardingInProgress: z.number().int().min(0),
  pendingOffboardings: z.number().int().min(0),
  expiringGuestsNext7Days: z.number().int().min(0)
});

export const homeOperationalSummaryBlockSchema = z.object({
  activeProjects: z.number().int().min(0),
  activeTasks: z.number().int().min(0),
  overdueTasks: z.number().int().min(0),
  teamsWithMoreBlockedTasks: z.array(
    z.object({
      teamId: idSchema,
      teamName: z.string().min(1),
      blockedTasks: z.number().int().min(0)
    })
  ),
  failedAutomationsLast24h: z.number().int().min(0)
});

export const homeSharedResourceSchema = z.object({
  id: idSchema,
  resourceScopeType: z.enum(["PROYECTO", "ARCHIVO", "DOCUMENTO"]),
  resourceScopeId: idSchema,
  expiresAt: timestampSchema,
  contactName: z.string().min(1).nullable()
});

export const homeDashboardSchema = z.object({
  generatedAt: timestampSchema,
  role: roleCodeSchema,
  organizationName: z.string().min(1),
  activeContext: z.object({
    type: z.enum(["GLOBAL", "PROYECTO", "EQUIPO", "EXTERNO"]),
    projectId: idSchema.nullable(),
    projectName: z.string().nullable(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable()
  }),
  unreadNotificationCount: z.number().int().min(0),
  blocks: z.object({
    myDay: homeMyDayBlockSchema.optional(),
    myProjects: z.array(homeProjectProgressSchema).optional(),
    recentActivity: homeRecentActivityBlockSchema.optional(),
    announcements: z.array(homeAnnouncementItemSchema).optional(),
    teamToday: z.array(homeTeamTodayBlockSchema).optional(),
    unassignedTasks: z.array(homeUnassignedTaskSchema).optional(),
    projectStatus: z.array(homeProjectProgressSchema).optional(),
    pendingDecisions: homePendingDecisionsBlockSchema.optional(),
    systemState: homeSystemStateBlockSchema.optional(),
    organizationActivity: homeOrgActivityBlockSchema.optional(),
    operationalSummary: homeOperationalSummaryBlockSchema.optional(),
    sharedResources: z.array(homeSharedResourceSchema).optional(),
    externalBanner: z.string().optional()
  }),
  quickActions: z.array(homeQuickActionSchema)
});

export type HomeDashboard = z.infer<typeof homeDashboardSchema>;
