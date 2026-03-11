import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import type { CallStatus, SocketWithUser } from "./types.js";

const getActiveCallParticipants = async (app: FastifyInstance, meetingId: string) =>
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

export const createCallRuntime = (
  app: FastifyInstance,
  socket: SocketWithUser,
  joinedMeetingCalls: Set<string>
): {
  getCallStatus: (meetingId: string) => Promise<CallStatus>;
  joinCallRooms: (meetingId: string) => void;
} => {
  const getCallStatus = async (meetingId: string): Promise<CallStatus> => {
    const activeParticipants = await getActiveCallParticipants(app, meetingId);
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
    };
  };

  const joinCallRooms = (meetingId: string) => {
    socket.join(`meeting:${meetingId}`);
    socket.join(`meeting-call:${meetingId}`);
    joinedMeetingCalls.add(meetingId);
  };

  return {
    getCallStatus,
    joinCallRooms
  };
};
