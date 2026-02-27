import type { ActionType, EntityType, Permission, SystemRole } from "@corelia/types";
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
  }

  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
    };
    accessContext?: {
      projectId: string | null;
      activeRole: SystemRole;
      permissions: Permission[];
    };
    auditEvent?: {
      entityType: EntityType;
      entityId: string;
      action: ActionType;
      previousData?: Record<string, unknown> | null;
      newData?: Record<string, unknown> | null;
      reason?: string;
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
