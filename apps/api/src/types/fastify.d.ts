import type {
  ActionCode,
  ActionType,
  EntityType,
  Permission,
  ProgramCode,
  ResourceCode,
  RoleCode
} from "@corelia/types";
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Server as SocketIOServer } from "socket.io";
import type { SearchIndex } from "../modules/search/search-index.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    queues?: {
      notifications: Queue;
      webhooks: Queue;
      automations: Queue;
    };
    io?: SocketIOServer;
    realtime?: {
      isEnabled: boolean;
      emitNotification: (userId: string, notification: unknown) => Promise<void>;
      emitChannelMessage: (channelId: string, message: unknown) => Promise<void>;
      emitMeetingEvent: (
        meetingId: string,
        eventName: string,
        payload: unknown
      ) => Promise<void>;
      emitReceiptBatchUpdate: (channelId: string, payload: unknown) => Promise<void>;
      emitNotificationReadSync: (userId: string, payload: unknown) => Promise<void>;
      emitIncomingCall: (userIds: string[], payload: unknown) => Promise<void>;
    };
    media?: {
      getHealth: () => {
        enabled: boolean;
        healthy: boolean;
        detail: string | null;
        driver: "mediasoup" | "disabled";
      };
      getRoomCapabilities: (
        roomId: string
      ) => Promise<{ available: boolean; rtpCapabilities: unknown | null }>;
    };
    storage?: {
      bucket: string;
      putObject: (objectKey: string, body: Buffer, mimeType: string) => Promise<void>;
      getObjectStream: (objectKey: string) => Promise<NodeJS.ReadableStream>;
      removeObject: (objectKey: string) => Promise<void>;
    };
    searchIndex?: SearchIndex;
  }

  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
    };
    accessContext?: {
      projectId: string | null;
      activeRoleId: string;
      activeRole: RoleCode;
      roleDisplayName: string;
      rank: number;
      programs: ProgramCode[];
      permissions: Permission[];
    };
    auditEvent?: {
      entityType: EntityType;
      entityId: string;
      action: ActionType;
      previousDataText?: Record<string, unknown> | null;
      newDataText?: Record<string, unknown> | null;
      reason?: string;
      reasonCatalogId?: string;
    };
  }

  interface FastifyContextConfig {
    requiresAuth?: boolean;
    requiredProgram?: ProgramCode;
    /**
     * Permiso requerido por recurso×acción. El guard reconstruye la key
     * canónica `${requiredResource}_${requiredAction}` y la valida contra los
     * permisos del rol activo.
     */
    requiredResource?: ResourceCode;
    requiredAction?: ActionCode;
    /** @deprecated Usar requiredResource + requiredAction. */
    requiredPermission?: Permission;
    skipMaintenance?: boolean;
    rateLimit?: {
      max: number;
      timeWindow: string;
    };
  }
}
