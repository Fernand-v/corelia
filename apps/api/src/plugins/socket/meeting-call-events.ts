import { env } from "../../config/env.js";
import {
  meetingCallJoinInputSchema,
  meetingCallLeaveInputSchema,
  meetingParticipantStateUpdateSchema,
  meetingWebRtcSignalSchema
} from "./schemas.js";
import { markSocketOffline } from "./presence.js";
import type { CallRuntimeContext } from "./types.js";

export const registerMeetingCallEvents = ({
  app,
  io,
  socket,
  withSocketSpan,
  hasMeetingAccess,
  joinedMeetingCalls
}: CallRuntimeContext) => {
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
            ack?.({ ok: false, message: access.message ?? "Acceso denegado" });
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
            !access.meeting.participants.some((participant) => participant.userId === socket.data.user.id)
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

          socket.to(`meeting-call:${parsed.data.meetingId}`).emit("meeting:participant-joined", {
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

          socket.to(`meeting-call:${parsed.data.meetingId}`).emit("meeting:participant-left", {
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
            ack?.({ ok: false, message: access.message ?? "Acceso denegado" });
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
            ack?.({ ok: false, message: access.message ?? "Acceso denegado" });
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

  socket.on("disconnect", () => {
    markSocketOffline(app, socket.data.user.id, socket.id);

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
};
