import { describe, expect, it } from "vitest";
import {
  resolveAnnouncementImageCandidates,
  resolveAnnouncementUrl
} from "@/components/announcement-content-state";

describe("announcement content state", () => {
  it("resolves relative announcement asset URL to absolute URL using api base", () => {
    const resolved = resolveAnnouncementUrl({
      value: "/announcements/assets/content?token=abc123",
      apiBase: "http://localhost:4000/api/v1",
      kind: "FILE"
    });

    expect(resolved).toBe("http://localhost:4000/api/v1/announcements/assets/content?token=abc123");
  });

  it("forces inline mode for image announcement assets", () => {
    const resolved = resolveAnnouncementUrl({
      value: "/api/v1/announcements/assets/content?token=image-token&mode=attachment",
      apiBase: "http://localhost:4000/api/v1",
      kind: "IMAGE"
    });

    expect(resolved).toBeTruthy();
    const parsed = new URL(resolved!);
    expect(parsed.searchParams.get("mode")).toBe("inline");
    expect(parsed.searchParams.get("token")).toBe("image-token");
  });

  it("returns null for unsafe or unsupported URLs", () => {
    const unsafe = resolveAnnouncementUrl({
      value: "javascript:alert('xss')",
      apiBase: "http://localhost:4000/api/v1",
      kind: "IMAGE"
    });

    const unsupported = resolveAnnouncementUrl({
      value: "/api/v1/documents/assets/content?token=abc",
      apiBase: "http://localhost:4000/api/v1",
      kind: "FILE"
    });

    expect(unsafe).toBeNull();
    expect(unsupported).toBeNull();
  });

  it("provides image fallback candidate on same-origin path", () => {
    const candidates = resolveAnnouncementImageCandidates({
      value: "http://localhost:4000/api/v1/announcements/assets/content?token=img-1&mode=attachment",
      apiBase: "http://localhost:4000/api/v1"
    });

    expect(candidates).toEqual([
      "http://localhost:4000/api/v1/announcements/assets/content?token=img-1&mode=inline",
      "/api/v1/announcements/assets/content?token=img-1&mode=inline"
    ]);
  });
});
