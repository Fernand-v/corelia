import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { type AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { socketPlugin } from "../plugins/socket.js";

vi.mock("../config/env.js", () => ({
  env: {
    SOCKET_IO_ENABLED: true,
    SOCKET_IO_PATH: "/ws/socket.io",
    MEDIA_MAX_PARTICIPANTS: 20
  }
}));

const waitForEvent = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout esperando evento ${event}`));
    }, 2000);

    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const emitWithAck = <T>(socket: Socket, event: string, payload: unknown): Promise<T> =>
  new Promise((resolve) => {
    socket.emit(event, payload, (ack: T) => resolve(ack));
  });

describe("Socket realtime integration", () => {
  const USER_ONE_ID = "11111111-1111-4111-8111-111111111111";
  const USER_TWO_ID = "22222222-2222-4222-8222-222222222222";
  const MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  let app: FastifyInstance;
  let baseUrl: string;
  const sockets: Socket[] = [];
  let participants: Map<string, {
    meetingId: string;
    userId: string;
    muted: boolean;
    cameraOn: boolean;
    screenSharing: boolean;
    speaking: boolean;
    joinedAt: Date | null;
    leftAt: Date | null;
  }>;

  beforeEach(async () => {
    participants = new Map();

    app = Fastify();
    await app.register(jwt, {
      secret: "super_secret_socket_tests_123"
    });

    const prisma = {
      projectMember: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      teamMember: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      channelMember: {
        findFirst: vi.fn().mockResolvedValue({ id: "cm-1" })
      },
      user: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      meeting: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (where.id !== MEETING_ID) {
            return null;
          }

          return {
            id: MEETING_ID,
            projectId: "p-1",
            teamId: null,
            participants: [{ userId: USER_ONE_ID }, { userId: USER_TWO_ID }]
          };
        })
      },
      meetingParticipant: {
        count: vi.fn().mockImplementation(async ({ where }: { where: { meetingId: string } }) => {
          return [...participants.values()].filter(
            (participant) => participant.meetingId === where.meetingId && participant.leftAt === null
          ).length;
        }),
        upsert: vi.fn().mockImplementation(async ({ where, update, create }: {
          where: { meetingId_userId: { meetingId: string; userId: string } };
          update: Record<string, unknown>;
          create: {
            meetingId: string;
            userId: string;
            muted?: boolean;
            cameraOn?: boolean;
            screenSharing?: boolean;
            speaking?: boolean;
            joinedAt?: Date | null;
          };
        }) => {
          const key = `${where.meetingId_userId.meetingId}:${where.meetingId_userId.userId}`;
          const previous = participants.get(key);
          const next = previous
            ? {
                ...previous,
                ...update
              }
            : {
                meetingId: create.meetingId,
                userId: create.userId,
                muted: create.muted ?? false,
                cameraOn: create.cameraOn ?? true,
                screenSharing: create.screenSharing ?? false,
                speaking: create.speaking ?? false,
                joinedAt: create.joinedAt ?? new Date(),
                leftAt: null
              };

          participants.set(key, next);
          return next;
        }),
        findMany: vi.fn().mockImplementation(async ({ where }: { where: { meetingId: string } }) => {
          return [...participants.values()].filter(
            (participant) => participant.meetingId === where.meetingId
          );
        }),
        findFirst: vi.fn().mockImplementation(async ({ where }: {
          where: {
            meetingId?: string;
            screenSharing?: boolean;
            leftAt?: Date | null;
            userId?: string | { not?: string };
          };
        }) => {
          return (
            [...participants.values()].find((participant) => {
              if (where.meetingId && participant.meetingId !== where.meetingId) {
                return false;
              }
              if (where.screenSharing !== undefined && participant.screenSharing !== where.screenSharing) {
                return false;
              }
              if (where.leftAt === null && participant.leftAt !== null) {
                return false;
              }
              if (typeof where.userId === "string" && participant.userId !== where.userId) {
                return false;
              }
              if (
                typeof where.userId === "object" &&
                where.userId !== null &&
                where.userId.not &&
                participant.userId === where.userId.not
              ) {
                return false;
              }
              return true;
            }) ?? null
          );
        }),
        updateMany: vi.fn().mockImplementation(async ({ where, data }: {
          where: { meetingId: string; userId: string };
          data: Record<string, unknown>;
        }) => {
          const key = `${where.meetingId}:${where.userId}`;
          const previous = participants.get(key);
          if (previous) {
            participants.set(key, {
              ...previous,
              ...data
            });
          }
          return { count: previous ? 1 : 0 };
        })
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "n-1",
            userId: USER_ONE_ID,
            event: "MENSAJE_NUEVO_CANAL",
            channel: "IN_APP",
            title: "Nuevo mensaje",
            body: "Canal actualizado",
            createdAt: new Date("2026-02-27T10:00:00.000Z"),
            sentAt: null,
            deliveredAt: null,
            readAt: null
          }
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      frontendSettings: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };

    app.decorate("prisma", prisma as never);
    app.decorate("media", {
      getHealth: () => ({
        enabled: true,
        healthy: true,
        detail: null,
        driver: "mediasoup" as const
      }),
      getRoomCapabilities: async () => ({
        available: true,
        rtpCapabilities: {}
      })
    });

    await app.register(socketPlugin);
    await app.listen({ host: "127.0.0.1", port: 0 });

    const address = app.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }
    sockets.length = 0;
    await app.close();
  });

  it("delivers realtime notifications and syncs missed notifications", async () => {
    const token = app.jwt.sign({
      id: USER_ONE_ID,
      email: "u1@corelia.local"
    });

    const socket = ioClient(baseUrl, {
      path: "/ws/socket.io",
      auth: { token },
      transports: ["websocket"]
    });
    sockets.push(socket);

    await waitForEvent(socket, "connect");

    const realtimeNotification = waitForEvent<{ id: string }>(socket, "notification:new");
    await app.realtime!.emitNotification(USER_ONE_ID, { id: "n-live" });

    const livePayload = await realtimeNotification;
    expect(livePayload.id).toBe("n-live");

    const ack = await emitWithAck<{
      ok: boolean;
      data: Array<{ id: string }>;
    }>(socket, "notifications:sync", {
      since: "2026-02-27T09:00:00.000Z"
    });

    expect(ack.ok).toBe(true);
    expect(ack.data).toHaveLength(1);
    expect(ack.data[0]!.id).toBe("n-1");

  });

  it("supports call signaling and participant state updates", async () => {
    const socketA = ioClient(baseUrl, {
      path: "/ws/socket.io",
      auth: {
        token: app.jwt.sign({
          id: USER_ONE_ID,
          email: "u1@corelia.local"
        })
      },
      transports: ["websocket"]
    });
    sockets.push(socketA);

    const socketB = ioClient(baseUrl, {
      path: "/ws/socket.io",
      auth: {
        token: app.jwt.sign({
          id: USER_TWO_ID,
          email: "u2@corelia.local"
        })
      },
      transports: ["websocket"]
    });
    sockets.push(socketB);

    await Promise.all([waitForEvent(socketA, "connect"), waitForEvent(socketB, "connect")]);

    const joinA = await emitWithAck<{ ok: boolean; message?: string }>(socketA, "meeting:call:join", {
      meetingId: MEETING_ID
    });
    const joinB = await emitWithAck<{ ok: boolean; message?: string }>(socketB, "meeting:call:join", {
      meetingId: MEETING_ID
    });

    expect(joinA.message ?? "ok").toBe("ok");
    expect(joinB.message ?? "ok").toBe("ok");
    expect(joinA.ok).toBe(true);
    expect(joinB.ok).toBe(true);

    const participantStatePromise = waitForEvent<{
      meetingId: string;
      userId: string;
      muted: boolean;
    }>(socketB, "meeting:participant-state");

    const stateAck = await emitWithAck<{ ok: boolean }>(
      socketA,
      "meeting:participant:update-state",
      {
        meetingId: MEETING_ID,
        muted: true
      }
    );

    expect(stateAck.ok).toBe(true);

    const participantState = await participantStatePromise;
    expect(participantState.userId).toBe(USER_ONE_ID);
    expect(participantState.muted).toBe(true);

    const shareAckA = await emitWithAck<{ ok: boolean; message?: string }>(
      socketA,
      "meeting:participant:update-state",
      {
        meetingId: MEETING_ID,
        screenSharing: true
      }
    );
    expect(shareAckA.ok).toBe(true);

    const shareAckB = await emitWithAck<{ ok: boolean; message?: string }>(
      socketB,
      "meeting:participant:update-state",
      {
        meetingId: MEETING_ID,
        screenSharing: true
      }
    );
    expect(shareAckB.ok).toBe(false);
    expect(shareAckB.message).toBe("Ya hay una pantalla compartida activa");

    const signalPromise = waitForEvent<{
      meetingId: string;
      fromUserId: string;
      targetUserId: string;
      signalType: string;
    }>(socketB, "meeting:webrtc:signal");

    const signalAck = await emitWithAck<{ ok: boolean }>(socketA, "meeting:webrtc:signal", {
      meetingId: MEETING_ID,
      targetUserId: USER_TWO_ID,
      signalType: "OFFER",
      data: {
        sdp: "fake-sdp"
      }
    });

    expect(signalAck.ok).toBe(true);

    const signal = await signalPromise;
    expect(signal.meetingId).toBe(MEETING_ID);
    expect(signal.fromUserId).toBe(USER_ONE_ID);
    expect(signal.targetUserId).toBe(USER_TWO_ID);
    expect(signal.signalType).toBe("OFFER");
  });
});
