import type { PrismaClient } from "@prisma/client";
import { getFrontendSettings } from "./frontend-settings.js";

export type InstantCallExpiryStatus = {
  isInstantCall: boolean;
  expiresAt: Date | null;
  expiryHours: number;
  expired: boolean;
};

export const resolveInstantCallExpiryStatus = async (
  prisma: PrismaClient,
  input: {
    meetingId: string;
    meetingCreatedAt: Date;
    now?: Date;
  }
): Promise<InstantCallExpiryStatus> => {
  const callInvite = await prisma.message.findFirst({
    where: {
      meetingId: input.meetingId,
      kind: "CALL_INVITE"
    },
    select: {
      id: true
    }
  });

  if (!callInvite) {
    return {
      isInstantCall: false,
      expiresAt: null,
      expiryHours: 0,
      expired: false
    };
  }

  const settings = await getFrontendSettings(prisma);
  const expiryHours = settings.instantCallExpiryHours;
  const expiresAt = new Date(input.meetingCreatedAt.getTime() + expiryHours * 60 * 60 * 1000);
  const now = input.now ?? new Date();

  return {
    isInstantCall: true,
    expiresAt,
    expiryHours,
    expired: now.getTime() >= expiresAt.getTime()
  };
};
