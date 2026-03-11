import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { EntityType, RoleCode } from "@corelia/types";
import { buildAuditTargetWhere, extractAuditTarget } from "../../../lib/entity-target.js";
import type { ProjectTeamSyncService } from "../../projects/team-sync-service.js";

export const ROLE_ORDER: RoleCode[] = [
  "ADMINISTRADOR",
  "LIDER_PROYECTO",
  "COORDINADOR_EQUIPO",
  "COLABORADOR",
  "OBSERVADOR",
  "INVITADO_EXTERNO"
];

export const ACTIVE_TASK_STATUSES: Array<"PENDIENTE" | "EN_REVISION"> = ["PENDIENTE", "EN_REVISION"];

export const CODE_CATALOG_FIELDS = {
  TASK: [
    "TASK_DESCRIPTION",
    "TASK_BLOCKED_REASON",
    "TASK_STATUS_REASON",
    "TASK_REASSIGN_REASON",
    "TASK_SCHEDULE_REASON"
  ],
  PROJECT: ["PROJECT_DESCRIPTION"],
  TEAM: ["TEAM_DESCRIPTION"],
  MEETING: ["MEETING_DESCRIPTION", "MEETING_AGREEMENT_DESCRIPTION"],
  OBJECTIVE: ["OBJECTIVE_DESCRIPTION"],
  DECISION: ["DECISION_DESCRIPTION"],
  IDENTITY: ["OFFBOARDING_REASON"],
  AUDIT: ["AUDIT_REASON"]
} as const;

export type CodeCatalogDomain = keyof typeof CODE_CATALOG_FIELDS;

export type SystemHealthService = {
  service: "api" | "postgres" | "redis" | "storage" | "media";
  status: "up" | "down" | "degraded";
  detail: string | null;
};

export type SystemOverallStatus = "OK" | "ERROR";

export const SYSTEM_STATUS_ENTITY_ID = "11111111-1111-4111-8111-111111111111";
export const SYSTEM_STATUS_REASON_CODE = "SYSTEM_STATUS_CHANGE";

type AuditTargetFields = {
  targetUserId: string | null;
  targetProjectId: string | null;
  targetTaskId: string | null;
  targetMeetingId: string | null;
  targetMeetingAgreementId: string | null;
  targetMessageId: string | null;
  targetFileId: string | null;
  targetFormRequestId: string | null;
  targetAnnouncementId: string | null;
  targetObjectiveId: string | null;
  targetDecisionId: string | null;
  targetAutomationRuleId: string | null;
  targetExpenseId: string | null;
};

export class AdminCommonService {
  constructor(
    protected readonly app: FastifyInstance,
    protected readonly teamSync: ProjectTeamSyncService
  ) {}

  protected forbidden(message: string): Error {
    const error = new Error(message);
    error.name = "Forbidden";
    return error;
  }

  protected conflict(message: string): Error {
    const error = new Error(message);
    error.name = "Conflict";
    return error;
  }

  protected async invalidateRoleCache(roleId: string) {
    await this.app.redis.del(`rbac:role:${roleId}:v1`);
  }

  protected normalizeRoleCode(input: { code?: string; displayName: string }) {
    const source = (input.code ?? input.displayName).trim();
    const normalized = source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 _-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

    if (!normalized) {
      throw new Error("No se pudo generar un código de rol válido");
    }

    return normalized;
  }

  protected async assertAdmin(actorId: string) {
    const actor = await this.app.prisma.user.findUnique({
      where: { id: actorId },
      select: {
        baseRole: {
          select: {
            key: true,
            code: true
          }
        }
      }
    });

    const legacyCode = (actor?.baseRole as unknown as { code?: unknown } | undefined)?.code;
    const isAdminByLegacyCode =
      typeof legacyCode === "string" && legacyCode === "ADMINISTRADOR";

    if (!actor || (actor.baseRole.key !== "ADMINISTRADOR" && !isAdminByLegacyCode)) {
      throw this.forbidden("Solo administradores pueden usar el panel de administración");
    }
  }

  protected normalizeLegacyCode(input: { code?: string | null; text?: string | null }) {
    if (input.code?.trim()) {
      return input.code.trim();
    }

    return null;
  }

  protected assertValidCatalogField(domain: CodeCatalogDomain, field: string) {
    const valid = CODE_CATALOG_FIELDS[domain].includes(field as never);
    if (!valid) {
      throw new Error(`Campo ${field} no válido para dominio ${domain}`);
    }
  }

  protected inferUserState(input: {
    isActive: boolean;
    hasOnboardingInProgress: boolean;
    hasOffboardingInProgress: boolean;
  }): "ACTIVO" | "INACTIVO" | "ONBOARDING" | "OFFBOARDING" {
    if (input.hasOffboardingInProgress) {
      return "OFFBOARDING";
    }

    if (input.hasOnboardingInProgress) {
      return "ONBOARDING";
    }

    if (!input.isActive) {
      return "INACTIVO";
    }

    return "ACTIVO";
  }

  protected getOverallSystemStatus(services: SystemHealthService[]): SystemOverallStatus {
    return services.some((service) => service.status !== "up") ? "ERROR" : "OK";
  }

  protected normalizeSystemServices(services: SystemHealthService[]): SystemHealthService[] {
    return [...services].sort((a, b) => a.service.localeCompare(b.service));
  }

  protected extractAuditTarget(entry: AuditTargetFields): { entityType: EntityType; entityId: string } {
    const target = extractAuditTarget(entry);
    if (!target) {
      throw new Error("Evento de auditoría sin entidad objetivo");
    }

    return target;
  }

  protected parseAuditPayload(data: string | Prisma.JsonValue | null): Prisma.JsonValue | null {
    if (!data) {
      return null;
    }

    if (typeof data === "string") {
      try {
        return JSON.parse(data) as Prisma.JsonValue;
      } catch {
        return null;
      }
    }

    return data;
  }

  protected parseSnapshotFromAuditData(
    data: string | Prisma.JsonValue | null
  ): { services: SystemHealthService[]; overallStatus: SystemOverallStatus } | null {
    const parsedData = this.parseAuditPayload(data);
    if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) {
      return null;
    }

    const objectData = parsedData as Prisma.JsonObject;
    const snapshot = objectData.snapshot;
    const overallStatus = objectData.overallStatus;

    if (
      !Array.isArray(snapshot) ||
      (overallStatus !== "OK" && overallStatus !== "ERROR")
    ) {
      return null;
    }

    const services = snapshot
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const serviceItem = item as Prisma.JsonObject;
        const service = serviceItem.service;
        const status = serviceItem.status;
        const detail = serviceItem.detail;

        if (
          typeof service !== "string" ||
          !["api", "postgres", "redis", "storage", "media"].includes(service) ||
          typeof status !== "string" ||
          !["up", "down", "degraded"].includes(status)
        ) {
          return null;
        }

        if (detail !== null && typeof detail !== "string") {
          return null;
        }

        return {
          service: service as SystemHealthService["service"],
          status: status as SystemHealthService["status"],
          detail
        };
      })
      .filter((item): item is SystemHealthService => item !== null);

    return {
      services: this.normalizeSystemServices(services),
      overallStatus
    };
  }

  protected diffSystemServices(
    previousServices: SystemHealthService[] | null,
    nextServices: SystemHealthService[]
  ) {
    const previousMap = new Map(
      (previousServices ?? []).map((service) => [service.service, service])
    );

    return nextServices
      .map((nextService) => {
        const previousService = previousMap.get(nextService.service) ?? null;
        const hasChanged =
          !previousService ||
          previousService.status !== nextService.status ||
          previousService.detail !== nextService.detail;

        if (!hasChanged) {
          return null;
        }

        return {
          service: nextService.service,
          previousStatus: previousService?.status ?? null,
          previousDetail: previousService?.detail ?? null,
          nextStatus: nextService.status,
          nextDetail: nextService.detail
        };
      })
      .filter((item): item is {
        service: SystemHealthService["service"];
        previousStatus: SystemHealthService["status"] | null;
        previousDetail: string | null;
        nextStatus: SystemHealthService["status"];
        nextDetail: string | null;
      } => item !== null);
  }

  protected async listSystemStatusRecentChanges(limit = 10) {
    const entries = await this.app.prisma.auditLog.findMany({
      where: {
        ...buildAuditTargetWhere("AUTOMATIZACION", SYSTEM_STATUS_ENTITY_ID),
        reasonCatalogId: SYSTEM_STATUS_REASON_CODE
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return entries.map((entry) => {
      const parsedSnapshot = this.parseSnapshotFromAuditData(entry.newDataText);
      const parsedNewData = this.parseAuditPayload(entry.newDataText);
      const changedServicesRaw =
        parsedNewData &&
        typeof parsedNewData === "object" &&
        !Array.isArray(parsedNewData) &&
        Array.isArray((parsedNewData as Prisma.JsonObject).changedServices)
          ? ((parsedNewData as Prisma.JsonObject).changedServices as Prisma.JsonArray)
          : [];

      const changedServices = changedServicesRaw
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const value = item as Prisma.JsonObject;
          const service = value.service;
          const previousStatus = value.previousStatus;
          const previousDetail = value.previousDetail;
          const nextStatus = value.nextStatus;
          const nextDetail = value.nextDetail;

          if (
            typeof service !== "string" ||
            !["api", "postgres", "redis", "storage", "media"].includes(service) ||
            (previousStatus !== null &&
              (typeof previousStatus !== "string" || !["up", "down", "degraded"].includes(previousStatus))) ||
            typeof nextStatus !== "string" ||
            !["up", "down", "degraded"].includes(nextStatus) ||
            (previousDetail !== null && typeof previousDetail !== "string") ||
            (nextDetail !== null && typeof nextDetail !== "string")
          ) {
            return null;
          }

          return {
            service: service as SystemHealthService["service"],
            previousStatus: previousStatus as SystemHealthService["status"] | null,
            previousDetail: previousDetail as string | null,
            nextStatus: nextStatus as SystemHealthService["status"],
            nextDetail: nextDetail as string | null
          };
        })
        .filter((item): item is {
          service: SystemHealthService["service"];
          previousStatus: SystemHealthService["status"] | null;
          previousDetail: string | null;
          nextStatus: SystemHealthService["status"];
          nextDetail: string | null;
        } => item !== null);

      return {
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        userId: entry.userId,
        reason: entry.reason,
        overallStatus: parsedSnapshot?.overallStatus ?? "ERROR",
        changedServices
      };
    });
  }

  protected resolveAuditRange(input: { from?: string; to?: string }) {
    const now = new Date();
    const to = input.to ? new Date(input.to) : now;
    if (Number.isNaN(to.getTime())) {
      throw new Error("Fecha hasta inválida");
    }

    const from = input.from ? new Date(input.from) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime())) {
      throw new Error("Fecha desde inválida");
    }

    if (from.getTime() > to.getTime()) {
      throw new Error("El rango de fechas es inválido");
    }

    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new Error("El rango máximo permitido es de 90 días");
    }

    return { from, to };
  }

  protected formatAuditActor(input: {
    user:
      | {
          firstName: string;
          lastName: string;
          email: string;
        }
      | null;
    userId: string | null;
  }) {
    if (!input.userId) {
      return "Sistema";
    }

    if (!input.user) {
      return input.userId;
    }

    const fullName = `${input.user.firstName} ${input.user.lastName}`.trim();
    return fullName || input.user.email || input.userId;
  }
}
