import type { FastifyInstance } from "fastify";
import { resolveInstantCallExpiryStatus } from "../../lib/instant-call-expiry.js";
import type { MeetingAccessResult } from "./types.js";

export const createMeetingAccessChecker =
  (app: FastifyInstance) =>
  async (meetingId: string, userId: string): Promise<MeetingAccessResult> => {
    const meeting = await app.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        projectId: true,
        teamId: true,
        createdAt: true,
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

    const instantCallStatus = await resolveInstantCallExpiryStatus(app.prisma, {
      meetingId,
      meetingCreatedAt: meeting.createdAt
    });

    if (instantCallStatus.isInstantCall && instantCallStatus.expired) {
      return {
        ok: false,
        message: `La videollamada instantánea venció (vigencia: ${instantCallStatus.expiryHours} horas)`
      };
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
        baseRole: {
          is: {
            key: "ADMINISTRADOR"
          }
        }
      },
      select: { id: true }
    });

    if (isAdmin) {
      return { ok: true, meeting };
    }

    return { ok: false, message: "Sin acceso a la reunión" };
  };
