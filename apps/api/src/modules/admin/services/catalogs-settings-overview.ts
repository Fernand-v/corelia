import {
  getFrontendSettings as getFrontendSettingsConfig,
  resetFrontendSettings as resetFrontendSettingsConfig,
  updateFrontendSettings as updateFrontendSettingsConfig
} from "../../../lib/frontend-settings.js";
import { StatusService } from "../../status/service.js";
import {
  ACTIVE_TASK_STATUSES,
  AdminCommonService
} from "./common.js";
import type { CodeCatalogDomain } from "./common.js";

export class AdminCatalogsSettingsOverviewService extends AdminCommonService {
  async listCodeCatalogs(
    actorId: string,
    input: {
      domain: CodeCatalogDomain;
      field?: string;
      includeInactive: boolean;
    }
  ) {
    await this.assertAdmin(actorId);
    if (input.field) {
      this.assertValidCatalogField(input.domain, input.field);
    }

    const whereBase = {
      ...(input.field ? { field: input.field as never } : {}),
      ...(input.includeInactive ? {} : { isActive: true })
    };

    const mapItem = (item: {
      id: string;
      field: string;
      code: number;
      key: string;
      label: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
      id: item.id,
      domain: input.domain,
      field: item.field,
      code: item.code,
      key: item.key,
      label: item.label,
      description: item.description,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    });

    if (input.domain === "TASK") {
      return (
        await this.app.prisma.taskCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "PROJECT") {
      return (
        await this.app.prisma.projectCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "TEAM") {
      return (
        await this.app.prisma.teamCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "MEETING") {
      return (
        await this.app.prisma.meetingCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "OBJECTIVE") {
      return (
        await this.app.prisma.objectiveCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "DECISION") {
      return (
        await this.app.prisma.decisionCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }
    if (input.domain === "IDENTITY") {
      return (
        await this.app.prisma.identityCodeCatalog.findMany({
          where: whereBase,
          orderBy: [{ field: "asc" }, { code: "asc" }]
        })
      ).map((item) => mapItem(item));
    }

    return (
      await this.app.prisma.auditCodeCatalog.findMany({
        where: whereBase,
        orderBy: [{ field: "asc" }, { code: "asc" }]
      })
    ).map((item) => mapItem(item));
  }

  async createCodeCatalog(
    actorId: string,
    input: {
      domain: CodeCatalogDomain;
      field: string;
      code: string;
      label: string;
      description?: string;
    }
  ) {
    await this.assertAdmin(actorId);
    this.assertValidCatalogField(input.domain, input.field);

    const data = {
      field: input.field as never,
      key: input.code,
      label: input.label,
      description: input.description ?? null
    };

    if (input.domain === "TASK") {
      return this.app.prisma.taskCodeCatalog.create({ data });
    }
    if (input.domain === "PROJECT") {
      return this.app.prisma.projectCodeCatalog.create({ data });
    }
    if (input.domain === "TEAM") {
      return this.app.prisma.teamCodeCatalog.create({ data });
    }
    if (input.domain === "MEETING") {
      return this.app.prisma.meetingCodeCatalog.create({ data });
    }
    if (input.domain === "OBJECTIVE") {
      return this.app.prisma.objectiveCodeCatalog.create({ data });
    }
    if (input.domain === "DECISION") {
      return this.app.prisma.decisionCodeCatalog.create({ data });
    }
    if (input.domain === "IDENTITY") {
      return this.app.prisma.identityCodeCatalog.create({ data });
    }

    return this.app.prisma.auditCodeCatalog.create({ data });
  }

  async updateCodeCatalog(
    actorId: string,
    domain: CodeCatalogDomain,
    id: string,
    input: {
      label?: string;
      description?: string | null;
      isActive?: boolean;
    }
  ) {
    await this.assertAdmin(actorId);
    const data = {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    };

    if (domain === "TASK") {
      return this.app.prisma.taskCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "PROJECT") {
      return this.app.prisma.projectCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "TEAM") {
      return this.app.prisma.teamCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "MEETING") {
      return this.app.prisma.meetingCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "OBJECTIVE") {
      return this.app.prisma.objectiveCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "DECISION") {
      return this.app.prisma.decisionCodeCatalog.update({ where: { id }, data });
    }
    if (domain === "IDENTITY") {
      return this.app.prisma.identityCodeCatalog.update({ where: { id }, data });
    }

    return this.app.prisma.auditCodeCatalog.update({ where: { id }, data });
  }

  async deactivateCodeCatalog(actorId: string, domain: CodeCatalogDomain, id: string) {
    await this.assertAdmin(actorId);
    return this.updateCodeCatalog(actorId, domain, id, { isActive: false });
  }

  async getFrontendSettings(actorId: string) {
    await this.assertAdmin(actorId);
    return getFrontendSettingsConfig(this.app.prisma);
  }

  async updateFrontendSettings(
    actorId: string,
    input: {
      organizationName?: string;
      taskStatusColors?: {
        PENDIENTE?: string;
        EN_REVISION?: string;
        COMPLETADA?: string;
      };
      instantCallExpiryHours?: number;
    }
  ) {
    await this.assertAdmin(actorId);
    return updateFrontendSettingsConfig(this.app.prisma, input);
  }

  async resetFrontendSettings(actorId: string) {
    await this.assertAdmin(actorId);
    return resetFrontendSettingsConfig(this.app.prisma);
  }

  async getOverview(
    actorId: string,
    input: {
      page: number;
      pageSize: number;
    }
  ) {
    await this.assertAdmin(actorId);

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const statusService = new StatusService(this.app);
    const [status, frontendSettings] = await Promise.all([
      statusService.getSystemStatus(),
      getFrontendSettingsConfig(this.app.prisma)
    ]);

    const [
      users,
      teams,
      projects,
      tasks,
      overdueTasks,
      automationsTotal,
      automationsEnabled,
      failedAutomations,
      formsPending,
      formsPendingApproval,
      formsByStatus,
      webhooksTotal,
      webhooksEnabled,
      latestDeliveries,
      activeAnnouncements,
      recentAnnouncements,
      latestJobs,
      latestEvents
    ] = await Promise.all([
      this.app.prisma.user.count(),
      this.app.prisma.team.count(),
      this.app.prisma.project.count(),
      this.app.prisma.task.count(),
      this.app.prisma.task.count({
        where: {
          status: {
            in: ACTIVE_TASK_STATUSES
          },
          dueDate: {
            lt: now
          }
        }
      }),
      this.app.prisma.automationRule.count(),
      this.app.prisma.automationRule.count({
        where: {
          enabled: true
        }
      }),
      this.app.prisma.webhookDelivery.count({
        where: {
          success: false,
          attemptedAt: {
            gte: dayAgo
          }
        }
      }),
      this.app.prisma.formRequest.count({
        where: {
          status: "PENDIENTE"
        }
      }),
      this.app.prisma.formRequest.count({
        where: {
          status: "PENDIENTE",
          approverId: {
            not: null
          }
        }
      }),
      this.app.prisma.formRequest.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.app.prisma.webhookEndpoint.count(),
      this.app.prisma.webhookEndpoint.count({
        where: {
          enabled: true
        }
      }),
      this.app.prisma.webhookDelivery.findMany({
        orderBy: {
          attemptedAt: "desc"
        },
        take: 10
      }),
      this.app.prisma.announcement.count({
        where: {
          expiresAt: {
            gt: now
          }
        }
      }),
      this.app.prisma.announcement.findMany({
        where: {
          expiresAt: {
            gt: now
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }),
      this.app.prisma.importJob.findMany({
        orderBy: {
          startedAt: "desc"
        },
        take: 10
      }),
      this.app.prisma.auditLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })
    ]);

    const formsStatusRows = formsByStatus.map((row) => ({
      status: row.status,
      total: row._count._all
    }));

    return {
      generatedAt: now.toISOString(),
      totals: {
        users,
        teams,
        projects,
        tasks,
        overdueTasks
      },
      organization: {
        name: frontendSettings.organizationName,
        defaultTimezone: process.env.CORELIA_DEFAULT_TIMEZONE ?? "UTC",
        defaultLanguage: process.env.CORELIA_DEFAULT_LANGUAGE ?? "es",
        workingDays: (process.env.CORELIA_DEFAULT_WORK_DAYS ?? "1,2,3,4,5")
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
        workingHours: {
          startHour: process.env.CORELIA_DEFAULT_WORK_START ?? "09:00",
          endHour: process.env.CORELIA_DEFAULT_WORK_END ?? "18:00"
        }
      },
      automations: {
        total: automationsTotal,
        enabled: automationsEnabled,
        failedLast24h: failedAutomations
      },
      forms: {
        activeRequests: formsPending,
        pendingApproval: formsPendingApproval,
        byStatus: formsStatusRows
      },
      system: {
        maintenanceEnabled: status.maintenance.enabled,
        maintenanceMessage: status.maintenance.message,
        services: status.services
      },
      integrations: {
        webhooksConfigured: webhooksTotal,
        webhooksEnabled,
        latestDeliveries: latestDeliveries.map((delivery) => ({
          id: delivery.id,
          endpointId: delivery.endpointId,
          success: delivery.success,
          statusCode: delivery.statusCode,
          attemptedAt: delivery.attemptedAt.toISOString()
        }))
      },
      announcements: {
        active: activeAnnouncements,
        recent: recentAnnouncements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          createdAt: announcement.createdAt.toISOString(),
          expiresAt: announcement.expiresAt.toISOString()
        }))
      },
      imports: {
        latestJobs: latestJobs.map((job) => ({
          id: job.id,
          source: job.source,
          filename: job.filename,
          startedAt: job.startedAt.toISOString(),
          finishedAt: job.finishedAt?.toISOString() ?? null,
          success: job.success
        }))
      },
      audit: {
        latestEvents: latestEvents.map((event) => {
          const target = this.extractAuditTarget(event);
          return {
            id: event.id,
            entityType: target.entityType,
            action: event.action,
            createdAt: event.createdAt.toISOString(),
            userId: event.userId,
            userName: this.formatAuditActor({
              user: event.user,
              userId: event.userId
            })
          };
        })
      },
      pagination: {
        page: input.page,
        pageSize: input.pageSize
      }
    };
  }

  async backfillProjectGeneralChannels(actorId: string, input: { dryRun: boolean }) {
    await this.assertAdmin(actorId);

    const projects = await this.app.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const projectIds = projects.map((project) => project.id);
    const [projectMembers, projectChannels] = await Promise.all([
      projectIds.length
        ? this.app.prisma.projectMember.findMany({
            where: {
              projectId: {
                in: projectIds
              }
            },
            select: {
              projectId: true,
              userId: true
            }
          })
        : [],
      projectIds.length
        ? this.app.prisma.channel.findMany({
            where: {
              scope: "PROYECTO",
              projectId: {
                in: projectIds
              }
            },
            include: {
              members: {
                select: {
                  userId: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          })
        : []
    ]);

    const membersByProject = new Map<string, Set<string>>();
    for (const project of projects) {
      membersByProject.set(project.id, new Set([project.ownerId]));
    }
    for (const member of projectMembers) {
      const set = membersByProject.get(member.projectId) ?? new Set<string>();
      set.add(member.userId);
      membersByProject.set(member.projectId, set);
    }

    const channelsByProject = new Map<string, typeof projectChannels>();
    for (const channel of projectChannels) {
      if (!channel.projectId) {
        continue;
      }
      const list = channelsByProject.get(channel.projectId) ?? [];
      list.push(channel);
      channelsByProject.set(channel.projectId, list);
    }

    let channelsCreated = 0;
    let membershipsInserted = 0;

    for (const project of projects) {
      const memberIds = [...(membersByProject.get(project.id) ?? new Set<string>([project.ownerId]))];
      const candidates = channelsByProject.get(project.id) ?? [];
      const selected = candidates.find((channel) => /general/i.test(channel.name)) ?? candidates[0] ?? null;

      if (!selected) {
        channelsCreated += 1;
        membershipsInserted += memberIds.length;

        if (input.dryRun) {
          continue;
        }

        await this.app.prisma.channel.create({
          data: {
            name: `${project.name} · General`.slice(0, 120),
            scope: "PROYECTO",
            projectId: project.id,
            members: {
              create: memberIds.map((userId) => ({ userId }))
            }
          }
        });
        continue;
      }

      const existingMemberIds = new Set(selected.members.map((member) => member.userId));
      const missingMemberIds = memberIds.filter((userId) => !existingMemberIds.has(userId));
      membershipsInserted += missingMemberIds.length;

      if (input.dryRun || missingMemberIds.length === 0) {
        continue;
      }

      await this.app.prisma.channelMember.createMany({
        data: missingMemberIds.map((userId) => ({
          channelId: selected.id,
          userId
        })),
        skipDuplicates: true
      });
    }

    return {
      dryRun: input.dryRun,
      projectsScanned: projects.length,
      channelsCreated,
      membershipsInserted
    };
  }
}
