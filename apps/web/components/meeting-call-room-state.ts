export type CallVisualParticipant = {
  userId: string;
  isLocal: boolean;
  screenSharing: boolean;
  hasLiveVideo: boolean;
  hasLiveAudio: boolean;
};

const sortGalleryParticipants = (participants: CallVisualParticipant[]) =>
  [...participants].sort((left, right) => {
    if (left.screenSharing !== right.screenSharing) {
      return left.screenSharing ? -1 : 1;
    }
    if (left.hasLiveVideo !== right.hasLiveVideo) {
      return left.hasLiveVideo ? -1 : 1;
    }
    if (left.hasLiveAudio !== right.hasLiveAudio) {
      return left.hasLiveAudio ? -1 : 1;
    }
    if (left.isLocal !== right.isLocal) {
      return left.isLocal ? 1 : -1;
    }
    return left.userId.localeCompare(right.userId);
  });

const sortRailParticipants = (participants: CallVisualParticipant[]) =>
  [...participants].sort((left, right) => {
    if (left.isLocal !== right.isLocal) {
      return left.isLocal ? -1 : 1;
    }
    if (left.hasLiveVideo !== right.hasLiveVideo) {
      return left.hasLiveVideo ? -1 : 1;
    }
    if (left.hasLiveAudio !== right.hasLiveAudio) {
      return left.hasLiveAudio ? -1 : 1;
    }
    return left.userId.localeCompare(right.userId);
  });

export const selectStageParticipant = (
  participants: CallVisualParticipant[]
): CallVisualParticipant | null => {
  if (participants.length === 0) {
    return null;
  }

  const screenShare = participants.find((participant) => participant.screenSharing);
  if (screenShare) {
    return screenShare;
  }

  const remoteWithVideo = participants.find(
    (participant) => !participant.isLocal && participant.hasLiveVideo
  );
  if (remoteWithVideo) {
    return remoteWithVideo;
  }

  const remoteWithAudio = participants.find(
    (participant) => !participant.isLocal && participant.hasLiveAudio
  );
  if (remoteWithAudio) {
    return remoteWithAudio;
  }

  const local = participants.find((participant) => participant.isLocal);
  if (local) {
    return local;
  }

  return participants[0] ?? null;
};

export const selectGalleryParticipants = (
  participants: CallVisualParticipant[],
  stageUserId: string | null,
  maxItems: number
): CallVisualParticipant[] => {
  if (maxItems <= 0) {
    return [];
  }

  const withoutStage = stageUserId
    ? participants.filter((participant) => participant.userId !== stageUserId)
    : participants;

  return sortGalleryParticipants(withoutStage).slice(0, maxItems);
};

export const buildParticipantRail = (
  participants: CallVisualParticipant[],
  stageUserId: string | null
): CallVisualParticipant[] => {
  if (!stageUserId) {
    return sortRailParticipants(participants);
  }

  const stageParticipant = participants.find((participant) => participant.userId === stageUserId);
  const others = participants.filter((participant) => participant.userId !== stageUserId);

  if (!stageParticipant) {
    return sortRailParticipants(participants);
  }

  return [stageParticipant, ...sortRailParticipants(others)];
};
