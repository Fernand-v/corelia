import { describe, expect, it } from "vitest";
import {
  buildParticipantRail,
  selectGalleryParticipants,
  selectStageParticipant,
  type CallVisualParticipant
} from "@/components/meeting-call-room-state";

const p = (overrides: Partial<CallVisualParticipant>): CallVisualParticipant => ({
  userId: "user",
  isLocal: false,
  screenSharing: false,
  hasLiveVideo: false,
  hasLiveAudio: false,
  ...overrides
});

describe("meeting call room state", () => {
  it("prioritizes screen share for stage", () => {
    const participants = [
      p({ userId: "local", isLocal: true, hasLiveVideo: true }),
      p({ userId: "remote-a", hasLiveVideo: true }),
      p({ userId: "remote-b", screenSharing: true, hasLiveVideo: true })
    ];

    expect(selectStageParticipant(participants)?.userId).toBe("remote-b");
  });

  it("uses remote video, then remote audio, then local for stage fallback", () => {
    const participants = [
      p({ userId: "local", isLocal: true, hasLiveVideo: true, hasLiveAudio: true }),
      p({ userId: "remote-a", hasLiveVideo: false, hasLiveAudio: true }),
      p({ userId: "remote-b", hasLiveVideo: true })
    ];

    expect(selectStageParticipant(participants)?.userId).toBe("remote-b");
    expect(
      selectStageParticipant([
        p({ userId: "local", isLocal: true, hasLiveVideo: true, hasLiveAudio: true }),
        p({ userId: "remote-a", hasLiveVideo: false, hasLiveAudio: true })
      ])?.userId
    ).toBe("remote-a");
    expect(selectStageParticipant([p({ userId: "local", isLocal: true })])?.userId).toBe("local");
  });

  it("builds gallery without stage participant and ordered by media priority", () => {
    const participants = [
      p({ userId: "local", isLocal: true, hasLiveVideo: true }),
      p({ userId: "remote-a", hasLiveVideo: false, hasLiveAudio: true }),
      p({ userId: "remote-b", hasLiveVideo: true }),
      p({ userId: "remote-c", hasLiveVideo: false, hasLiveAudio: false })
    ];

    expect(selectGalleryParticipants(participants, "remote-b", 3).map((item) => item.userId)).toEqual([
      "local",
      "remote-a",
      "remote-c"
    ]);
  });

  it("pins stage first in participant rail", () => {
    const participants = [
      p({ userId: "local", isLocal: true, hasLiveVideo: true }),
      p({ userId: "remote-a", hasLiveVideo: true }),
      p({ userId: "remote-b", hasLiveAudio: true })
    ];

    expect(buildParticipantRail(participants, "remote-a").map((item) => item.userId)).toEqual([
      "remote-a",
      "local",
      "remote-b"
    ]);
  });
});
