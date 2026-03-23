import { MessagingService } from "../../modules/messaging/service.js";
import type { SocketBaseContext } from "./types.js";

export const registerSubscriptionEvents = ({
  app,
  socket,
  withSocketSpan,
  hasMeetingAccess
}: SocketBaseContext) => {
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

        const messagingService = new MessagingService(app);
        messagingService
          .autoDeliverOnSubscribe({ channelId, userId: socket.data.user.id })
          .catch(() => undefined);

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
};
