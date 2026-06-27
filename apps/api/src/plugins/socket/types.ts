import type { FastifyInstance } from "fastify";
import type { Server, Socket } from "socket.io";

export interface SocketAuthPayload {
  id: string;
  email: string;
}

export interface SocketUser {
  id: string;
  email: string;
  permissions: string[];
  programs: string[];
}

export type SocketWithUser = Socket & {
  data: {
    user: SocketUser;
  };
};

export type SocketSpanRunner = <T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  run: () => Promise<T>
) => Promise<T>;

export type MeetingAccessResult =
  | {
      ok: true;
      meeting: {
        id: string;
        projectId: string | null;
        teamId: string | null;
        createdAt: Date;
        participants: Array<{ userId: string }>;
      };
    }
  | {
      ok: false;
      message: string;
    };

export interface SocketBaseContext {
  app: FastifyInstance;
  io: Server;
  socket: SocketWithUser;
  withSocketSpan: SocketSpanRunner;
  hasMeetingAccess: (meetingId: string, userId: string) => Promise<MeetingAccessResult>;
}

export interface CallStatus {
  conversationId: string;
  hasActiveCall: boolean;
  participantCount: number;
  maxParticipants: number;
  participants: string[];
  startedAt: Date | null;
  canJoin: boolean;
  status: "no_call" | "full" | "active";
}

export interface CallRuntimeContext extends SocketBaseContext {
  joinedMeetingCalls: Set<string>;
  getCallStatus: (meetingId: string) => Promise<CallStatus>;
  joinCallRooms: (meetingId: string) => void;
}
