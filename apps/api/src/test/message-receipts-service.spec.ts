import { describe, expect, it, vi } from "vitest";
import { MessageReceiptsService } from "../modules/messaging/message-receipts-service.js";

type App = ConstructorParameters<typeof MessageReceiptsService>[0];

describe("MessageReceiptsService", () => {
  it("only lets the author see receipt details", async () => {
    const app = {
      prisma: {
        message: {
          findUnique: vi.fn().mockResolvedValue({ id: "m-1", authorId: "other", channelId: "c-1" })
        }
      }
    } as unknown as App;
    const getChannelForMember = vi.fn().mockResolvedValue(undefined);
    const service = new MessageReceiptsService(app, getChannelForMember);

    await expect(service.getMessageReceiptInfo({ messageId: "m-1", userId: "u-1" })).rejects.toThrow(
      /Solo el autor/
    );
  });

  it("checks channel membership before marking delivered", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const app = {
      prisma: { messageReceipt: { updateMany } },
      realtime: { emitReceiptBatchUpdate: vi.fn().mockResolvedValue(undefined) }
    } as unknown as App;
    const getChannelForMember = vi.fn().mockResolvedValue(undefined);
    const service = new MessageReceiptsService(app, getChannelForMember);

    await service.markMessagesDelivered({ channelId: "c-1", messageIds: ["m-1"], userId: "u-1" });

    expect(getChannelForMember).toHaveBeenCalledWith("c-1", "u-1");
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
