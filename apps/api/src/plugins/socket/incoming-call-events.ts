import { z } from "zod";
import type { SocketBaseContext } from "./types.js";

const callAnswerSchema = z.object({
  meetingId: z.string().uuid(),
  channelId: z.string().uuid()
});

const callRejectSchema = z.object({
  meetingId: z.string().uuid(),
  channelId: z.string().uuid()
});

export const registerIncomingCallEvents = ({
  io,
  socket,
  withSocketSpan
}: SocketBaseContext) => {
  socket.on("call:answer", async (payload: unknown) => {
    await withSocketSpan(
      "socket.call.answer",
      { "corelia.user.id": socket.data.user.id },
      async () => {
        const parsed = callAnswerSchema.safeParse(payload);
        if (!parsed.success) return;

        io.to(`channel:${parsed.data.channelId}`).emit("call:answered", {
          meetingId: parsed.data.meetingId,
          answeredBy: socket.data.user.id
        });
      }
    ).catch(() => undefined);
  });

  socket.on("call:reject", async (payload: unknown) => {
    await withSocketSpan(
      "socket.call.reject",
      { "corelia.user.id": socket.data.user.id },
      async () => {
        const parsed = callRejectSchema.safeParse(payload);
        if (!parsed.success) return;

        io.to(`channel:${parsed.data.channelId}`).emit("call:rejected", {
          meetingId: parsed.data.meetingId,
          rejectedBy: socket.data.user.id
        });
      }
    ).catch(() => undefined);
  });
};
