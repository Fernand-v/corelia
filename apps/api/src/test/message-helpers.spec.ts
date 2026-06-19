import { describe, expect, it } from "vitest";
import {
  buildDeepLink,
  computeAggregateStatus,
  formatMessagePreview,
  formatUserName,
  mapPreviewMessage,
  truncatePreview
} from "../modules/messaging/message-helpers.js";

describe("message-helpers", () => {
  it("formats a user name", () => {
    expect(formatUserName({ firstName: "Ana", lastName: "Paz" })).toBe("Ana Paz");
  });

  it("truncates long previews with an ellipsis", () => {
    expect(truncatePreview("hola   mundo")).toBe("hola mundo");
    expect(truncatePreview("a".repeat(130)).endsWith("…")).toBe(true);
    expect(truncatePreview("a".repeat(130)).length).toBe(120);
  });

  describe("buildDeepLink", () => {
    it("includes optional project/team ids", () => {
      expect(
        buildDeepLink({ channelId: "c1", messageId: "m1", projectId: "p1", teamId: null })
      ).toBe("/messaging?channelId=c1&messageId=m1&projectId=p1");
    });

    it("omits absent ids", () => {
      expect(buildDeepLink({ channelId: "c1", messageId: "m1", projectId: null, teamId: null })).toBe(
        "/messaging?channelId=c1&messageId=m1"
      );
    });
  });

  describe("formatMessagePreview", () => {
    it("describes file messages", () => {
      expect(formatMessagePreview({ kind: "FILE", content: "", attachmentName: "doc.pdf" })).toBe(
        "Archivo compartido: doc.pdf"
      );
      expect(formatMessagePreview({ kind: "FILE", content: "", attachmentName: null })).toBe(
        "Archivo compartido"
      );
    });

    it("uses fixed labels for special kinds", () => {
      expect(formatMessagePreview({ kind: "CALL_INVITE", content: "" })).toMatch(/Videollamada/);
      expect(formatMessagePreview({ kind: "NOTA_VOZ", content: "" })).toBe("Nota de voz");
      expect(formatMessagePreview({ kind: "LLAMADA_PERDIDA", content: "" })).toBe("Llamada perdida");
    });

    it("truncates plain text", () => {
      expect(formatMessagePreview({ kind: "TEXT", content: "  hola  mundo " })).toBe("hola mundo");
    });
  });

  describe("computeAggregateStatus", () => {
    it("returns sent with no receipts", () => {
      expect(computeAggregateStatus([])).toBe("sent");
    });

    it("returns read only when every receipt is read", () => {
      expect(computeAggregateStatus([{ status: "LEIDO" }, { status: "LEIDO" }])).toBe("read");
      expect(computeAggregateStatus([{ status: "LEIDO" }, { status: "ENTREGADO" }])).toBe("delivered");
      expect(computeAggregateStatus([{ status: "ENVIADO" }])).toBe("sent");
    });
  });

  describe("mapPreviewMessage", () => {
    it("returns null for a missing message", () => {
      expect(mapPreviewMessage(null)).toBeNull();
    });

    it("maps and serializes a message", () => {
      const mapped = mapPreviewMessage({
        id: "m1",
        content: "Hola equipo",
        kind: "TEXT",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        authorId: "u1"
      });
      expect(mapped).toMatchObject({
        messageId: "m1",
        content: "Hola equipo",
        kind: "TEXT",
        createdAt: "2026-01-01T00:00:00.000Z",
        authorId: "u1"
      });
    });
  });
});
