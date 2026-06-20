import type { FastifyInstance } from "fastify";
import { formatUserName } from "./message-helpers.js";

// Sub-servicio de recibos de mensajes (entregado/leído y entrega automática al
// suscribirse), extraído de MessagingService. Recibe getChannelForMember por
// inyección para reutilizar la verificación de pertenencia al canal.
export class MessageReceiptsService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly getChannelForMember: (channelId: string, userId: string) => Promise<unknown>
  ) {}

  async markMessagesDelivered(input: { channelId: string; messageIds: string[]; userId: string }) {
    await this.getChannelForMember(input.channelId, input.userId);

    await this.app.prisma.messageReceipt.updateMany({
      where: {
        messageId: { in: input.messageIds },
        userId: input.userId,
        status: "ENVIADO"
      },
      data: {
        status: "ENTREGADO",
        deliveredAt: new Date()
      }
    });

    await this.app.realtime?.emitReceiptBatchUpdate(input.channelId, {
      channelId: input.channelId,
      userId: input.userId,
      status: "ENTREGADO",
      messageIds: input.messageIds,
      timestamp: new Date().toISOString()
    });
  }

  async markMessagesRead(input: { channelId: string; upToMessageId: string; userId: string }) {
    await this.getChannelForMember(input.channelId, input.userId);

    const targetMessage = await this.app.prisma.message.findUnique({
      where: { id: input.upToMessageId },
      select: { createdAt: true, channelId: true }
    });

    if (!targetMessage || targetMessage.channelId !== input.channelId) {
      throw new Error("Mensaje no encontrado en este canal");
    }

    const messagesToMark = await this.app.prisma.message.findMany({
      where: {
        channelId: input.channelId,
        createdAt: { lte: targetMessage.createdAt },
        authorId: { not: input.userId }
      },
      select: { id: true }
    });

    const messageIds = messagesToMark.map((m) => m.id);
    if (messageIds.length === 0) return;

    const now = new Date();
    await this.app.prisma.messageReceipt.updateMany({
      where: {
        messageId: { in: messageIds },
        userId: input.userId,
        status: { in: ["ENVIADO", "ENTREGADO"] }
      },
      data: {
        status: "LEIDO",
        readAt: now,
        deliveredAt: now
      }
    });

    await this.app.realtime?.emitReceiptBatchUpdate(input.channelId, {
      channelId: input.channelId,
      userId: input.userId,
      status: "LEIDO",
      messageIds,
      timestamp: now.toISOString()
    });
  }

  async getMessageReceiptInfo(input: { messageId: string; userId: string }) {
    const message = await this.app.prisma.message.findUnique({
      where: { id: input.messageId },
      select: { id: true, authorId: true, channelId: true }
    });

    if (!message) {
      throw new Error("Mensaje no encontrado");
    }

    if (message.authorId !== input.userId) {
      throw new Error("Solo el autor puede ver el detalle de recibos");
    }

    const receipts = await this.app.prisma.messageReceipt.findMany({
      where: { messageId: input.messageId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    return {
      messageId: input.messageId,
      receipts: receipts.map((r) => ({
        userId: r.user.id,
        userName: formatUserName(r.user),
        status: r.status,
        deliveredAt: r.deliveredAt?.toISOString() ?? null,
        readAt: r.readAt?.toISOString() ?? null
      }))
    };
  }

  async autoDeliverOnSubscribe(input: { channelId: string; userId: string }) {
    const pendingReceipts = await this.app.prisma.messageReceipt.findMany({
      where: {
        userId: input.userId,
        status: "ENVIADO",
        message: { channelId: input.channelId }
      },
      select: { messageId: true }
    });

    if (pendingReceipts.length === 0) return;

    const messageIds = pendingReceipts.map((r) => r.messageId);

    await this.app.prisma.messageReceipt.updateMany({
      where: {
        messageId: { in: messageIds },
        userId: input.userId,
        status: "ENVIADO"
      },
      data: {
        status: "ENTREGADO",
        deliveredAt: new Date()
      }
    });

    await this.app.realtime?.emitReceiptBatchUpdate(input.channelId, {
      channelId: input.channelId,
      userId: input.userId,
      status: "ENTREGADO",
      messageIds,
      timestamp: new Date().toISOString()
    });
  }
}
