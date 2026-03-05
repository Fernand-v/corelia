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
import { z } from "zod";

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

const conversationInputSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid().optional()
});

const callEndInputSchema = z.object({
  conversationId: z.string().uuid(),
  targetUserId: z.string().uuid().optional()
});

const callSignalInputSchema = z.object({
  conversationId: z.string().uuid(),
  to: z.string().uuid(),
  from: z.string().uuid().optional(),
  offer: z.record(z.unknown()).optional(),
  answer: z.record(z.unknown()).optional(),
  candidate: z.record(z.unknown()).optional()
});

const callStateInputSchema = z.object({
  conversationId: z.string().uuid(),
  to: z.string().uuid().optional(),
  from: z.string().uuid().optional(),
  state: z
    .object({
      audioOn: z.boolean().optional(),
      videoOn: z.boolean().optional(),
      screenSharing: z.boolean().optional()
    })
    .passthrough()
});

const callRecordingInputSchema = z.object({
  conversationId: z.string().uuid(),
  recordingId: z.string().min(1)
});

const callTranscriptInputSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  transcript: z.string().min(1),
  timestamp: z.number().optional()
});

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

const PRESENCE_ONLINE_KEY_PREFIX = "presence:online:";
const presenceKey = (userId: string) => `${PRESENCE_ONLINE_KEY_PREFIX}${userId}`;

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
    void app.redis
      .sadd(presenceKey(socket.data.user.id), socket.id)
      .then(() => app.redis.expire(presenceKey(socket.data.user.id), 60 * 60 * 24))
      .catch(() => undefined);

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

    const getActiveCallParticipants = async (meetingId: string) =>
      app.prisma.meetingParticipant.findMany({
        where: {
          meetingId,
          joinedAt: {
            not: null
          },
          leftAt: null
        },
        select: {
          userId: true,
          joinedAt: true
        },
        orderBy: {
          joinedAt: "asc"
        }
      });

    const getCallStatus = async (meetingId: string) => {
      const activeParticipants = await getActiveCallParticipants(meetingId);
      const participantIds = activeParticipants.map((participant) => participant.userId);
      const participantCount = participantIds.length;
      const isFull = participantCount >= env.MEDIA_MAX_PARTICIPANTS;

      return {
        conversationId: meetingId,
        hasActiveCall: participantCount > 0,
        participantCount,
        maxParticipants: env.MEDIA_MAX_PARTICIPANTS,
        participants: participantIds,
        startedAt: activeParticipants[0]?.joinedAt ?? null,
        canJoin: !isFull,
        status: participantCount === 0 ? "no_call" : isFull ? "full" : "active"
      } as const;
    };

    const joinCallRooms = (meetingId: string) => {
      socket.join(`meeting:${meetingId}`);
      socket.join(`meeting-call:${meetingId}`);
      joinedMeetingCalls.add(meetingId);
    };

    socket.on(
      "call.start",
      async (
        payload: unknown,
        ack?: (result: {
          success?: boolean;
          participants?: string[];
          conversationId?: string;
          userId?: string;
          error?: string;
        }) => void
      ) => {
        await withSocketSpan(
          "socket.call.start",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = conversationInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            if (parsed.data.userId && parsed.data.userId !== socket.data.user.id) {
              ack?.({ error: "Usuario no autorizado para iniciar llamada" });
              return;
            }

            const meetingId = parsed.data.conversationId;
            const access = await hasMeetingAccess(meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            const [activeBefore, alreadyJoined] = await Promise.all([
              getActiveCallParticipants(meetingId),
              app.prisma.meetingParticipant.findFirst({
                where: {
                  meetingId,
                  userId: socket.data.user.id,
                  leftAt: null
                },
                select: {
                  userId: true
                }
              })
            ]);

            if (activeBefore.length >= env.MEDIA_MAX_PARTICIPANTS && !alreadyJoined) {
              ack?.({
                error: `Máximo ${env.MEDIA_MAX_PARTICIPANTS} participantes simultáneos en llamada`
              });
              return;
            }

            await app.prisma.meetingParticipant.upsert({
              where: {
                meetingId_userId: {
                  meetingId,
                  userId: socket.data.user.id
                }
              },
              update: {
                joinedAt: new Date(),
                leftAt: null
              },
              create: {
                meetingId,
                userId: socket.data.user.id,
                joinedAt: new Date()
              }
            });

            const status = await getCallStatus(meetingId);
            joinCallRooms(meetingId);

            socket.to(`meeting-call:${meetingId}`).emit("call.participant.joined", {
              userId: socket.data.user.id,
              participants: status.participants,
              conversationId: meetingId
            });

            ack?.({
              success: true,
              participants: status.participants,
              conversationId: meetingId,
              userId: socket.data.user.id
            });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.join",
      async (
        payload: unknown,
        ack?: (result: { participants?: string[]; conversationId?: string; error?: string }) => void
      ) => {
        await withSocketSpan(
          "socket.call.join",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = conversationInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            if (parsed.data.userId && parsed.data.userId !== socket.data.user.id) {
              ack?.({ error: "Usuario no autorizado para unirse a la llamada" });
              return;
            }

            const meetingId = parsed.data.conversationId;
            const access = await hasMeetingAccess(meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            const statusBefore = await getCallStatus(meetingId);
            if (!statusBefore.hasActiveCall) {
              ack?.({ error: "No hay una llamada activa para esta conversación" });
              return;
            }

            if (!statusBefore.canJoin && !statusBefore.participants.includes(socket.data.user.id)) {
              ack?.({
                error: `Máximo ${env.MEDIA_MAX_PARTICIPANTS} participantes simultáneos en llamada`
              });
              return;
            }

            await app.prisma.meetingParticipant.upsert({
              where: {
                meetingId_userId: {
                  meetingId,
                  userId: socket.data.user.id
                }
              },
              update: {
                joinedAt: new Date(),
                leftAt: null
              },
              create: {
                meetingId,
                userId: socket.data.user.id,
                joinedAt: new Date()
              }
            });

            const status = await getCallStatus(meetingId);
            joinCallRooms(meetingId);

            socket.to(`meeting-call:${meetingId}`).emit("call.participant.joined", {
              userId: socket.data.user.id,
              participants: status.participants,
              conversationId: meetingId
            });

            ack?.({
              participants: status.participants,
              conversationId: meetingId
            });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.leave",
      async (
        payload: unknown,
        ack?: (result: { conversationId?: string; success?: boolean; error?: string }) => void
      ) => {
        await withSocketSpan(
          "socket.call.leave",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = conversationInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const meetingId = parsed.data.conversationId;
            await app.prisma.meetingParticipant.updateMany({
              where: {
                meetingId,
                userId: socket.data.user.id
              },
              data: {
                speaking: false,
                screenSharing: false,
                leftAt: new Date()
              }
            });

            socket.leave(`meeting-call:${meetingId}`);
            joinedMeetingCalls.delete(meetingId);
            const status = await getCallStatus(meetingId);

            socket.to(`meeting-call:${meetingId}`).emit("call.participant.left", {
              userId: socket.data.user.id,
              participants: status.participants,
              conversationId: meetingId
            });

            ack?.({
              conversationId: meetingId,
              success: true
            });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.status",
      async (payload: unknown, ack?: (result: Record<string, unknown>) => void) => {
        await withSocketSpan(
          "socket.call.status",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = conversationInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const meetingId = parsed.data.conversationId;
            const access = await hasMeetingAccess(meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            const status = await getCallStatus(meetingId);
            ack?.(status);
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.end",
      async (
        payload: unknown,
        ack?: (result: { success?: boolean; conversationId?: string; error?: string }) => void
      ) => {
        await withSocketSpan(
          "socket.call.end",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callEndInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            const meetingId = parsed.data.conversationId;
            const access = await hasMeetingAccess(meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            if (parsed.data.targetUserId) {
              await app.prisma.meetingParticipant.updateMany({
                where: {
                  meetingId,
                  userId: parsed.data.targetUserId
                },
                data: {
                  speaking: false,
                  screenSharing: false,
                  leftAt: new Date()
                }
              });

              io.to(`user:${parsed.data.targetUserId}`).emit("call.ended", {
                conversationId: meetingId,
                endedBy: socket.data.user.id,
                reason: "terminated_by_host"
              });
            } else {
              await app.prisma.meetingParticipant.updateMany({
                where: {
                  meetingId,
                  leftAt: null
                },
                data: {
                  speaking: false,
                  screenSharing: false,
                  leftAt: new Date()
                }
              });

              io.to(`meeting-call:${meetingId}`).emit("call.ended", {
                conversationId: meetingId,
                endedBy: socket.data.user.id,
                reason: "ended_by_host"
              });
            }

            ack?.({
              success: true,
              conversationId: meetingId
            });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.offer",
      async (payload: unknown, ack?: (result: { success?: boolean; error?: string }) => void) => {
        await withSocketSpan(
          "socket.call.offer",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callSignalInputSchema.safeParse(payload);
            if (!parsed.success || !parsed.data.offer) {
              ack?.({ error: parsed.success ? "Oferta inválida" : "Payload inválido" });
              return;
            }

            if (parsed.data.from && parsed.data.from !== socket.data.user.id) {
              ack?.({ error: "Usuario de origen inválido" });
              return;
            }

            const access = await hasMeetingAccess(parsed.data.conversationId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            io.to(`user:${parsed.data.to}`).emit("call.offer", {
              from: socket.data.user.id,
              offer: parsed.data.offer,
              conversationId: parsed.data.conversationId
            });
            ack?.({ success: true });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.answer",
      async (payload: unknown, ack?: (result: { success?: boolean; error?: string }) => void) => {
        await withSocketSpan(
          "socket.call.answer",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callSignalInputSchema.safeParse(payload);
            if (!parsed.success || !parsed.data.answer) {
              ack?.({ error: parsed.success ? "Respuesta inválida" : "Payload inválido" });
              return;
            }

            if (parsed.data.from && parsed.data.from !== socket.data.user.id) {
              ack?.({ error: "Usuario de origen inválido" });
              return;
            }

            const access = await hasMeetingAccess(parsed.data.conversationId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            io.to(`user:${parsed.data.to}`).emit("call.answer", {
              from: socket.data.user.id,
              answer: parsed.data.answer,
              conversationId: parsed.data.conversationId
            });
            ack?.({ success: true });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.candidate",
      async (payload: unknown, ack?: (result: { success?: boolean; error?: string }) => void) => {
        await withSocketSpan(
          "socket.call.candidate",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callSignalInputSchema.safeParse(payload);
            if (!parsed.success || !parsed.data.candidate) {
              ack?.({ error: parsed.success ? "ICE candidate inválido" : "Payload inválido" });
              return;
            }

            if (parsed.data.from && parsed.data.from !== socket.data.user.id) {
              ack?.({ error: "Usuario de origen inválido" });
              return;
            }

            const access = await hasMeetingAccess(parsed.data.conversationId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            io.to(`user:${parsed.data.to}`).emit("call.candidate", {
              from: socket.data.user.id,
              candidate: parsed.data.candidate,
              conversationId: parsed.data.conversationId
            });
            ack?.({ success: true });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.state",
      async (payload: unknown, ack?: (result: { success?: boolean; error?: string }) => void) => {
        await withSocketSpan(
          "socket.call.state",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callStateInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            if (parsed.data.from && parsed.data.from !== socket.data.user.id) {
              ack?.({ error: "Usuario de origen inválido" });
              return;
            }

            const meetingId = parsed.data.conversationId;
            const access = await hasMeetingAccess(meetingId, socket.data.user.id);
            if (!access.ok) {
              ack?.({ error: access.message ?? "Sin acceso a la reunión" });
              return;
            }

            if (parsed.data.state.screenSharing === true) {
              const activeSharer = await app.prisma.meetingParticipant.findFirst({
                where: {
                  meetingId,
                  userId: {
                    not: socket.data.user.id
                  },
                  leftAt: null,
                  screenSharing: true
                },
                select: {
                  userId: true
                }
              });

              if (activeSharer) {
                ack?.({ error: "Ya hay una pantalla compartida activa" });
                return;
              }
            }

            const updateData: Record<string, unknown> = {};
            if (parsed.data.state.audioOn !== undefined) {
              updateData.muted = !parsed.data.state.audioOn;
            }
            if (parsed.data.state.videoOn !== undefined) {
              updateData.cameraOn = parsed.data.state.videoOn;
            }
            if (parsed.data.state.screenSharing !== undefined) {
              updateData.screenSharing = parsed.data.state.screenSharing;
            }

            if (Object.keys(updateData).length > 0) {
              await app.prisma.meetingParticipant.upsert({
                where: {
                  meetingId_userId: {
                    meetingId,
                    userId: socket.data.user.id
                  }
                },
                update: updateData,
                create: {
                  meetingId,
                  userId: socket.data.user.id,
                  joinedAt: new Date(),
                  muted: (updateData.muted as boolean | undefined) ?? false,
                  cameraOn: (updateData.cameraOn as boolean | undefined) ?? true,
                  screenSharing: (updateData.screenSharing as boolean | undefined) ?? false
                }
              });
            }

            const outgoingState = {
              ...parsed.data.state,
              audioOn:
                parsed.data.state.audioOn !== undefined ? parsed.data.state.audioOn : undefined,
              videoOn:
                parsed.data.state.videoOn !== undefined ? parsed.data.state.videoOn : undefined,
              screenSharing:
                parsed.data.state.screenSharing !== undefined
                  ? parsed.data.state.screenSharing
                  : undefined
            };

            if (parsed.data.to) {
              io.to(`user:${parsed.data.to}`).emit("call.state", {
                from: socket.data.user.id,
                state: outgoingState,
                conversationId: meetingId
              });
            } else {
              socket.to(`meeting-call:${meetingId}`).emit("call.state", {
                from: socket.data.user.id,
                state: outgoingState,
                conversationId: meetingId
              });
            }

            ack?.({ success: true });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on(
      "call.recording.start",
      async (
        payload: unknown,
        ack?: (result: { conversationId?: string; recordingId?: string; error?: string }) => void
      ) => {
        await withSocketSpan(
          "socket.call.recording.start",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callRecordingInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            io.to(`meeting-call:${parsed.data.conversationId}`).emit("call.recording.start", {
              recordingId: parsed.data.recordingId,
              conversationId: parsed.data.conversationId
            });

            ack?.({
              conversationId: parsed.data.conversationId,
              recordingId: parsed.data.recordingId
            });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on("call.recording.chunk", async (payload: unknown) => {
      await withSocketSpan(
        "socket.call.recording.chunk",
        {
          "corelia.user.id": socket.data.user.id
        },
        async () => {
          const parsed = callRecordingInputSchema.safeParse(payload);
          if (!parsed.success) {
            return;
          }

          io.to(`meeting-call:${parsed.data.conversationId}`).emit("call.recording.chunk.received", {
            recordingId: parsed.data.recordingId,
            conversationId: parsed.data.conversationId,
            chunkSize:
              typeof (payload as Record<string, unknown>).chunk === "object" &&
              (payload as Record<string, unknown>).chunk !== null &&
              "size" in ((payload as Record<string, unknown>).chunk as Record<string, unknown>)
                ? Number(
                    ((payload as Record<string, unknown>).chunk as Record<string, unknown>).size ?? 0
                  )
                : 0,
            timestamp: Date.now()
          });
        }
      ).catch(() => undefined);
    });

    socket.on(
      "call.recording.end",
      async (
        payload: unknown,
        ack?: (result: { success?: boolean; recordingId?: string; conversationId?: string; error?: string }) => void
      ) => {
        await withSocketSpan(
          "socket.call.recording.end",
          {
            "corelia.user.id": socket.data.user.id
          },
          async () => {
            const parsed = callRecordingInputSchema.safeParse(payload);
            if (!parsed.success) {
              ack?.({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
              return;
            }

            io.to(`meeting-call:${parsed.data.conversationId}`).emit("call.recording.end", {
              recordingId: parsed.data.recordingId,
              conversationId: parsed.data.conversationId
            });

            ack?.({
              success: true,
              recordingId: parsed.data.recordingId,
              conversationId: parsed.data.conversationId
            });
          }
        ).catch((error) => {
          ack?.({ error: (error as Error).message });
        });
      }
    );

    socket.on("call.transcript", async (payload: unknown) => {
      await withSocketSpan(
        "socket.call.transcript",
        {
          "corelia.user.id": socket.data.user.id
        },
        async () => {
          const parsed = callTranscriptInputSchema.safeParse(payload);
          if (!parsed.success) {
            return;
          }

          io.to(`meeting-call:${parsed.data.conversationId}`).emit("call.transcript", {
            userId: parsed.data.userId ?? socket.data.user.id,
            transcript: parsed.data.transcript,
            timestamp: parsed.data.timestamp ?? Date.now(),
            conversationId: parsed.data.conversationId
          });
        }
      ).catch(() => undefined);
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

            if (parsed.data.screenSharing === true) {
              const activeSharer = await app.prisma.meetingParticipant.findFirst({
                where: {
                  meetingId: parsed.data.meetingId,
                  userId: {
                    not: socket.data.user.id
                  },
                  leftAt: null,
                  screenSharing: true
                },
                select: {
                  userId: true
                }
              });

              if (activeSharer) {
                ack?.({
                  ok: false,
                  message: "Ya hay una pantalla compartida activa"
                });
                return;
              }
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
      void app.redis.srem(presenceKey(socket.data.user.id), socket.id).catch(() => undefined);
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
