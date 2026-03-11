import type { ActionType, EntityType, Permission, RoleCode } from "@corelia/types";
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Server as SocketIOServer } from "socket.io";

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
    requiredPermission?: Permission;
    skipMaintenance?: boolean;
    rateLimit?: {
      max: number;
      timeWindow: string;
    };
  }
}
