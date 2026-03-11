import type { Prisma } from "@prisma/client";
import { buildAuditTargetWhere } from "../../../lib/entity-target.js";
import { StatusService } from "../../status/service.js";
import {
  AdminCommonService,
  SYSTEM_STATUS_ENTITY_ID,
  SYSTEM_STATUS_REASON_CODE
} from "./common.js";

export class AdminAuditSystemService extends AdminCommonService {
  async getAuditReport(
    actorId: string,
    input: {
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
    }
  ) {
    await this.assertAdmin(actorId);
    const range = this.resolveAuditRange({
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {})
    });

    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: range.from,
        lte: range.to
      }
    };

    const [items, total] = await Promise.all([
      this.app.prisma.auditLog.findMany({
        where,
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
      }),
      this.app.prisma.auditLog.count({ where })
    ]);

    return {
      items: items.map((item) => ({
        ...this.extractAuditTarget(item),
        id: item.id,
        action: item.action,
        reason: item.reason,
        reasonCatalogId: item.reasonCatalogId,
        userId: item.userId,
        actorName: this.formatAuditActor({
          user: item.user,
          userId: item.userId
        }),
        createdAt: item.createdAt.toISOString()
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      from: range.from.toISOString(),
      to: range.to.toISOString()
    };
  }

  async exportAuditReportCsv(
    actorId: string,
    input: {
      from?: string;
      to?: string;
    }
  ) {
    await this.assertAdmin(actorId);
    const range = this.resolveAuditRange({
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {})
    });

    const items = await this.app.prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: range.from,
          lte: range.to
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10000,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    const escapeCsv = (value: string | null | undefined) => {
      const text = value ?? "";
      const normalized = text.replaceAll('"', '""');
      return `"${normalized}"`;
    };

    const header = ["fecha", "actor", "entityType", "action", "entityId", "reason", "reasonCatalogId"];
    const rows = items.map((item) =>
      {
        const target = this.extractAuditTarget(item);
        return [
          item.createdAt.toISOString(),
          this.formatAuditActor({
            user: item.user,
            userId: item.userId
          }),
          target.entityType,
          item.action,
          target.entityId,
          item.reason ?? "",
          item.reasonCatalogId ?? ""
        ]
          .map((value) => escapeCsv(value))
          .join(",");
      }
    );

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      csv: [header.map((value) => escapeCsv(value)).join(","), ...rows].join("\n")
    };
  }

  async getSystemStatus(actorId: string) {
    await this.assertAdmin(actorId);

    const statusService = new StatusService(this.app);
    const status = await statusService.getSystemStatus();
    const services = this.normalizeSystemServices(status.services);
    const overallStatus = this.getOverallSystemStatus(services);
    const recentChanges = await this.listSystemStatusRecentChanges();

    return {
      now: status.now,
      overallStatus,
      maintenance: status.maintenance,
      services,
      recentChanges
    };
  }

  async checkSystemStatus(actorId: string) {
    await this.assertAdmin(actorId);

    const statusService = new StatusService(this.app);
    const status = await statusService.getSystemStatus();
    const services = this.normalizeSystemServices(status.services);
    const overallStatus = this.getOverallSystemStatus(services);

    const previousEntry = await this.app.prisma.auditLog.findFirst({
      where: {
        ...buildAuditTargetWhere("AUTOMATIZACION", SYSTEM_STATUS_ENTITY_ID),
        reasonCatalogId: SYSTEM_STATUS_REASON_CODE
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const previousSnapshot = this.parseSnapshotFromAuditData(previousEntry?.newDataText ?? null);
    const changedServices = this.diffSystemServices(previousSnapshot?.services ?? null, services);
    const changed =
      !previousSnapshot ||
      previousSnapshot.overallStatus !== overallStatus ||
      changedServices.length > 0;

    const recentChanges = await this.listSystemStatusRecentChanges();

    return {
      now: status.now,
      overallStatus,
      maintenance: status.maintenance,
      services,
      changed,
      changedServices,
      auditLogged: changed,
      recentChanges,
      auditEvent: changed
        ? {
            entityType: "AUTOMATIZACION" as const,
            entityId: SYSTEM_STATUS_ENTITY_ID,
            action: "ACTUALIZAR" as const,
            reasonCatalogId: SYSTEM_STATUS_REASON_CODE,
            reason:
              changedServices.length > 0
                ? `Cambio detectado en servicios: ${changedServices.map((item) => item.service).join(", ")}`
                : "Cambio detectado en estado general del sistema",
            previousDataText: previousSnapshot
              ? {
                  snapshot: previousSnapshot.services,
                  overallStatus: previousSnapshot.overallStatus
                }
              : null,
            newDataText: {
              snapshot: services,
              overallStatus,
              changedServices
            }
          }
        : null
    };
  }
}
