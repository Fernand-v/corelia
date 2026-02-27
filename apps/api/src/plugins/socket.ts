import {
  meetingCallJoinInputSchema,
  meetingCallLeaveInputSchema,
  meetingParticipantStateUpdateSchema,
  meetingWebRtcSignalSchema,
  notificationSyncInputSchema
} from "@corelia/types";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import fp from "fastify-plugin";
import { Server } from "socket.io";
import { env } from "../config/env.js";

interface SocketAuthPayload {
  id: string;
  email: string;
}

const parseBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

const tracer = trace.getTracer("corelia-api-realtime");

const withSocketSpan = async <T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  run: () => Promise<T>
): Promise<T> =>
  tracer.startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    }

    try {
      return await run();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
      throw error;
    } finally {
      span.end();
    }
  });

export const socketPlugin = fp(async (app) => {
  if (!env.SOCKET_IO_ENABLED) {
    app.decorate("realtime", {
      isEnabled: false,
      emitNotification: async () => undefined,
      emitChannelMessage: async () => undefined,
      emitMeetingEvent: async () => undefined
    });
    return;
  }

  const hasMeetingAccess = async (meetingId: string, userId: string) => {
    const meeting = await app.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        projectId: true,
        teamId: true,
        participants: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!meeting) {
      return { ok: false, message: "Reunión no encontrada" };
    }

    const isParticipant = meeting.participants.some((participant) => participant.userId === userId);
    if (isParticipant) {
      return { ok: true, meeting };
    }

    if (meeting.projectId) {
      const projectMember = await app.prisma.projectMember.findFirst({
        where: {
          projectId: meeting.projectId,
          userId
        },
        select: { id: true }
      });

      if (projectMember) {
        return { ok: true, meeting };
      }
    }

    if (meeting.teamId) {
      const teamMember = await app.prisma.teamMember.findFirst({
        where: {
          teamId: meeting.teamId,
          userId
        },
        select: { id: true }
      });

      if (teamMember) {
        return { ok: true, meeting };
      }
    }

    const isAdmin = await app.prisma.user.findFirst({
      where: {
        id: userId,
        baseRole: "ADMINISTRADOR"
      },
      select: { id: true }
    });

    if (isAdmin) {
      return { ok: true, meeting };
    }

    return { ok: false, message: "Sin acceso a la reunión" };
  };

  const io = new Server(app.server, {
    path: env.SOCKET_IO_PATH,
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const authToken =
        (typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : null) ??
        parseBearerToken(
          typeof socket.handshake.headers.authorization === "string"
            ? socket.handshake.headers.authorization
            : undefined
        );

      if (!authToken) {
        return next(new Error("Unauthorized socket"));
      }

      const payload = (await app.jwt.verify(authToken)) as SocketAuthPayload;
      socket.data.user = {
        id: payload.id,
        email: payload.email
      };
      socket.join(`user:${payload.id}`);

      return next();
    } catch {
      return next(new Error("Unauthorized socket"));
    }
  });

  io.on("connection", (socket) => {
    const joinedMeetingCalls = new Set<string>();

    socket.on("subscribe:project", async (projectId: string, ack?: (result: unknown) => void) => {
      await withSocketSpan(
        "socket.subscribe.project",
        {
          "corelia.user.id": socket.data.user.id,
          "corelia.project.id": projectId
        },
        async () => {
          const membership = await app.prisma.projectMember.findFirst({
            where: {
              projectId,
              userId: socket.data.user.id
            },
            select: { id: true }
          });

          if (!membership) {
            ack?.({ ok: false, message: "Sin acceso al proyecto" });
            return;
          }

          socket.join(`project:${projectId}`);
          ack?.({ ok: true });
        }
      ).catch((error) => {
        ack?.({ ok: false, message: (error as Error).message });
      });
    });

    socket.on("subscribe:team", async (teamId: string, ack?: (result: unknown) => void) => {
      await withSocketSpan(
        "socket.subscribe.team",
        {
          "corelia.user.id": socket.data.user.id,
          "corelia.team.id": teamId
        },
        async () => {
          const membership = await app.prisma.teamMember.findFirst({
            where: {
              teamId,
              userId: socket.data.user.id
            },
            select: { id: true }
          });

          if (!membership) {
            ack?.({ ok: false, message: "Sin acceso al equipo" });
            return;
          }

          socket.join(`team:${teamId}`);
          ack?.({ ok: true });
        }
      ).catch((error) => {
        ack?.({ ok: false, message: (error as Error).message });
      });
    });

    socket.on("subscribe:channel", async (channelId: string, ack?: (result: unknown) => void) => {
      await withSocketSpan(
        "socket.subscribe.channel",
        {
          "corelia.user.id": socket.data.user.id,
          "corelia.channel.id": channelId
        },
        async () => {
          const membership = await app.prisma.channelMember.findFirst({
            where: {
              channelId,
              userId: socket.data.user.id
            },
            select: { id: true }
          });

          if (!membership) {
            ack?.({ ok: false, message: "Sin acceso al canal" });
            return;
          }

          socket.join(`channel:${channelId}`);
          ack?.({ ok: true });
        }
      ).catch((error) => {
        ack?.({ ok: false, message: (error as Error).message });
      });
    });

    socket.on("subscribe:meeting", async (meetingId: string, ack?: (result: unknown) => void) => {
      await withSocketSpan(
        "socket.subscribe.meeting",
        {
          "corelia.user.id": socket.data.user.id,
          "corelia.meeting.id": meetingId
        },
        async () => {
          const access = await hasMeetingAccess(meetingId, socket.data.user.id);

          if (!access.ok) {
            ack?.({ ok: false, message: access.message });
            return;
          }

          socket.join(`meeting:${meetingId}`);
          ack?.({ ok: true });
        }
      ).catch((error) => {
        ack?.({ ok: false, message: (error as Error).message });
      });
    });

    socket.on(
      "meeting:call:join",
      async (
        payload: unknown,
        ack?: (result: {
          ok: boolean;
          message?: string;
          participants?: unknown[];
          media?: {
            available: boolean;
            message: string | null;
          };
        }) => void
      ) => {
        await withSocketSpan(
          "socket.meeting.call.join",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = meetingCallJoinInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const access = await hasMeetingAccess(parsed.data.meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ ok: false, message: access.message });
              return;
            }

            const activeParticipants = await app.prisma.meetingParticipant.count({
              where: {
                meetingId: parsed.data.meetingId,
                joinedAt: {
                  not: null
                },
                leftAt: null
              }
            });

            if (
              activeParticipants >= env.MEDIA_MAX_PARTICIPANTS &&
              !access.meeting!.participants.some(
                (participant) => participant.userId === socket.data.user.id
              )
            ) {
              ack?.({
                ok: false,
                message: `Máximo ${env.MEDIA_MAX_PARTICIPANTS} participantes simultáneos en llamada`
              });
              return;
            }

            await app.prisma.meetingParticipant.upsert({
              where: {
                meetingId_userId: {
                  meetingId: parsed.data.meetingId,
                  userId: socket.data.user.id
                }
              },
              update: {
                joinedAt: new Date(),
                leftAt: null
              },
              create: {
                meetingId: parsed.data.meetingId,
                userId: socket.data.user.id,
                joinedAt: new Date()
              }
            });

            const participants = await app.prisma.meetingParticipant.findMany({
              where: {
                meetingId: parsed.data.meetingId
              },
              select: {
                userId: true,
                muted: true,
                cameraOn: true,
                screenSharing: true,
                speaking: true,
                joinedAt: true,
                leftAt: true
              }
            });

            const mediaHealth = app.media?.getHealth();
            const media = {
              available: Boolean(mediaHealth?.enabled && mediaHealth.healthy),
              message:
                mediaHealth?.enabled && mediaHealth?.healthy
                  ? null
                  : mediaHealth?.detail ?? "Videollamadas no disponibles, modo degradado activo"
            };

            socket.join(`meeting:${parsed.data.meetingId}`);
            socket.join(`meeting-call:${parsed.data.meetingId}`);
            joinedMeetingCalls.add(parsed.data.meetingId);

            socket
              .to(`meeting-call:${parsed.data.meetingId}`)
              .emit("meeting:participant-joined", {
                meetingId: parsed.data.meetingId,
                userId: socket.data.user.id,
                joinedAt: new Date().toISOString()
              });

            ack?.({
              ok: true,
              participants,
              media
            });
          }
        ).catch((error) => {
          ack?.({ ok: false, message: (error as Error).message });
        });
      }
    );

    socket.on(
      "meeting:call:leave",
      async (payload: unknown, ack?: (result: { ok: boolean; message?: string }) => void) => {
        await withSocketSpan(
          "socket.meeting.call.leave",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = meetingCallLeaveInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            await app.prisma.meetingParticipant.updateMany({
              where: {
                meetingId: parsed.data.meetingId,
                userId: socket.data.user.id
              },
              data: {
                speaking: false,
                screenSharing: false,
                leftAt: new Date()
              }
            });

            socket.leave(`meeting-call:${parsed.data.meetingId}`);
            joinedMeetingCalls.delete(parsed.data.meetingId);

            socket
              .to(`meeting-call:${parsed.data.meetingId}`)
              .emit("meeting:participant-left", {
                meetingId: parsed.data.meetingId,
                userId: socket.data.user.id,
                leftAt: new Date().toISOString()
              });

            ack?.({ ok: true });
          }
        ).catch((error) => {
          ack?.({ ok: false, message: (error as Error).message });
        });
      }
    );

    socket.on(
      "meeting:participant:update-state",
      async (
        payload: unknown,
        ack?: (result: { ok: boolean; data?: unknown; message?: string }) => void
      ) => {
        await withSocketSpan(
          "socket.meeting.participant.state",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = meetingParticipantStateUpdateSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const access = await hasMeetingAccess(parsed.data.meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ ok: false, message: access.message });
              return;
            }

            const updated = await app.prisma.meetingParticipant.upsert({
              where: {
                meetingId_userId: {
                  meetingId: parsed.data.meetingId,
                  userId: socket.data.user.id
                }
              },
              update: {
                ...(parsed.data.muted !== undefined ? { muted: parsed.data.muted } : {}),
                ...(parsed.data.cameraOn !== undefined ? { cameraOn: parsed.data.cameraOn } : {}),
                ...(parsed.data.screenSharing !== undefined
                  ? { screenSharing: parsed.data.screenSharing }
                  : {}),
                ...(parsed.data.speaking !== undefined ? { speaking: parsed.data.speaking } : {})
              },
              create: {
                meetingId: parsed.data.meetingId,
                userId: socket.data.user.id,
                muted: parsed.data.muted ?? false,
                cameraOn: parsed.data.cameraOn ?? true,
                screenSharing: parsed.data.screenSharing ?? false,
                speaking: parsed.data.speaking ?? false,
                joinedAt: new Date()
              }
            });

            io.to(`meeting-call:${parsed.data.meetingId}`).emit("meeting:participant-state", {
              meetingId: parsed.data.meetingId,
              userId: socket.data.user.id,
              muted: updated.muted,
              cameraOn: updated.cameraOn,
              screenSharing: updated.screenSharing,
              speaking: updated.speaking,
              joinedAt: updated.joinedAt?.toISOString() ?? null,
              leftAt: updated.leftAt?.toISOString() ?? null
            });

            ack?.({
              ok: true,
              data: {
                meetingId: parsed.data.meetingId,
                userId: socket.data.user.id,
                muted: updated.muted,
                cameraOn: updated.cameraOn,
                screenSharing: updated.screenSharing,
                speaking: updated.speaking
              }
            });
          }
        ).catch((error) => {
          ack?.({ ok: false, message: (error as Error).message });
        });
      }
    );

    socket.on(
      "meeting:webrtc:signal",
      async (payload: unknown, ack?: (result: { ok: boolean; message?: string }) => void) => {
        await withSocketSpan(
          "socket.meeting.webrtc.signal",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = meetingWebRtcSignalSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const access = await hasMeetingAccess(parsed.data.meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ ok: false, message: access.message });
              return;
            }

            const signalPayload = {
              meetingId: parsed.data.meetingId,
              fromUserId: socket.data.user.id,
              targetUserId: parsed.data.targetUserId ?? null,
              signalType: parsed.data.signalType,
              data: parsed.data.data
            };

            if (parsed.data.targetUserId) {
              io.to(`user:${parsed.data.targetUserId}`).emit("meeting:webrtc:signal", signalPayload);
            } else {
              socket.to(`meeting-call:${parsed.data.meetingId}`).emit("meeting:webrtc:signal", signalPayload);
            }

            ack?.({ ok: true });
          }
        ).catch((error) => {
          ack?.({ ok: false, message: (error as Error).message });
        });
      }
    );

    socket.on(
      "notifications:sync",
      async (
        payload: unknown,
        ack?: (result: {
          ok: boolean;
          data?: unknown[];
          message?: string;
        }) => void
      ) => {
        await withSocketSpan(
          "socket.notifications.sync",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = notificationSyncInputSchema.safeParse(payload ?? {});
            if (!parsed.success) {
              ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const sinceDate = parsed.data.since ? new Date(parsed.data.since) : null;
            const notifications = await app.prisma.notification.findMany({
              where: {
                userId: socket.data.user.id,
                ...(sinceDate ? { createdAt: { gt: sinceDate } } : {})
              },
              orderBy: { createdAt: "asc" },
              take: 200
            });

            const missingDelivered = notifications
              .filter((notification) => notification.deliveredAt === null)
              .map((notification) => notification.id);

            if (missingDelivered.length > 0) {
              await app.prisma.notification.updateMany({
                where: {
                  id: { in: missingDelivered }
                },
                data: {
                  deliveredAt: new Date()
                }
              });
            }

            ack?.({ ok: true, data: notifications });
          }
        ).catch((error) => {
          ack?.({ ok: false, message: (error as Error).message });
        });
      }
    );

    socket.on("disconnect", () => {
      for (const meetingId of joinedMeetingCalls) {
        void app.prisma.meetingParticipant
          .updateMany({
            where: {
              meetingId,
              userId: socket.data.user.id
            },
            data: {
              speaking: false,
              screenSharing: false,
              leftAt: new Date()
            }
          })
          .then(() => {
            socket.to(`meeting-call:${meetingId}`).emit("meeting:participant-left", {
              meetingId,
              userId: socket.data.user.id,
              leftAt: new Date().toISOString()
            });
          })
          .catch(() => undefined);
      }
      joinedMeetingCalls.clear();
    });
  });

  app.decorate("io", io);
  app.decorate("realtime", {
    isEnabled: true,
    emitNotification: async (userId: string, notification: unknown) => {
      io.to(`user:${userId}`).emit("notification:new", notification);
    },
    emitChannelMessage: async (channelId: string, message: unknown) => {
      io.to(`channel:${channelId}`).emit("channel:message", message);
    },
    emitMeetingEvent: async (meetingId: string, eventName: string, payload: unknown) => {
      io.to(`meeting:${meetingId}`).emit(eventName, payload);
    }
  });

  app.addHook("onClose", async () => {
    await io.close();
  });
});
