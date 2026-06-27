import { env } from "../../config/env.js";
import {
  callEndInputSchema,
  callRecordingInputSchema,
  callSignalInputSchema,
  callStateInputSchema,
  callTranscriptInputSchema,
  conversationInputSchema
} from "./schemas.js";
import { socketHasPermission } from "./access.js";
import type { CallRuntimeContext } from "./types.js";

export const registerLegacyCallEvents = ({
  app,
  io,
  socket,
  withSocketSpan,
  hasMeetingAccess,
  getCallStatus,
  joinCallRooms,
  joinedMeetingCalls
}: CallRuntimeContext) => {
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

          if (!socketHasPermission(socket, "LLAMADA", "ACCEDER")) {
            ack?.({ error: "No tienes permiso para acceder a llamadas" });
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
            }),
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

          if (!socketHasPermission(socket, "LLAMADA", "ACCEDER")) {
            ack?.({ error: "No tienes permiso para acceder a llamadas" });
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
    async (payload: unknown, ack?: (result: unknown) => void) => {
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
            audioOn: parsed.data.state.audioOn !== undefined ? parsed.data.state.audioOn : undefined,
            videoOn: parsed.data.state.videoOn !== undefined ? parsed.data.state.videoOn : undefined,
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
              ? Number(((payload as Record<string, unknown>).chunk as Record<string, unknown>).size ?? 0)
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
};
