import { describe, expect, it } from "vitest";
import {
  mapDiagramSessionParticipant,
  mapDocument,
  mapVersion,
  normalizeClientId,
  participantDisplayName,
  resolveFolderIdByType,
  type SpaceFolders
} from "../modules/documents/document-helpers.js";

const space: SpaceFolders = {
  projectId: "p1",
  rootFolderId: "root",
  textoFolderId: "f-texto",
  diagramasFolderId: "f-diag",
  tablasFolderId: "f-tabla",
  whiteboardFolderId: "f-wb",
  presentacionesFolderId: "f-pres"
};

describe("document-helpers", () => {
  describe("resolveFolderIdByType", () => {
    it("maps each document type to its folder", () => {
      expect(resolveFolderIdByType(space, "TEXTO")).toBe("f-texto");
      expect(resolveFolderIdByType(space, "DIAGRAMA")).toBe("f-diag");
      expect(resolveFolderIdByType(space, "TABLA")).toBe("f-tabla");
      expect(resolveFolderIdByType(space, "WHITEBOARD")).toBe("f-wb");
      expect(resolveFolderIdByType(space, "PRESENTACION")).toBe("f-pres");
    });
  });

  describe("normalizeClientId", () => {
    it("collapses whitespace and trims length", () => {
      expect(normalizeClientId("  ab   cd  ")).toBe("ab-cd");
      expect(normalizeClientId("x".repeat(200)).length).toBe(120);
    });

    it("falls back to a random uuid when empty", () => {
      const generated = normalizeClientId("   ");
      expect(generated.length).toBeGreaterThan(0);
    });
  });

  describe("participantDisplayName", () => {
    it("joins names and falls back to a placeholder", () => {
      expect(participantDisplayName({ firstName: "Ana", lastName: "Paz" })).toBe("Ana Paz");
      expect(participantDisplayName({ firstName: "", lastName: "" })).toBe("Usuario");
    });
  });

  describe("mapDocument", () => {
    it("serializes dates, nulls and derives the author name", () => {
      const mapped = mapDocument({
        id: "d1",
        projectId: "p1",
        folderId: "f1",
        type: "TEXTO",
        name: "Doc",
        yDocName: "ydoc",
        currentVersion: 2,
        createdById: "u1",
        deletedAt: null,
        purgeAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: { firstName: "Ana", lastName: "Paz" }
      });

      expect(mapped).toMatchObject({
        id: "d1",
        diagramEngine: null,
        diagramKind: null,
        createdByName: "Ana Paz",
        deletedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z"
      });
    });
  });

  describe("mapVersion", () => {
    it("serializes the version and omits author name when absent", () => {
      const mapped = mapVersion({
        id: "v1",
        documentId: "d1",
        versionNumber: 3,
        kind: "AUTO",
        snapshotPath: "path",
        snapshotSizeBytes: 10,
        createdById: "u1",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      });

      expect(mapped).toMatchObject({ id: "v1", versionNumber: 3, createdAt: "2026-01-01T00:00:00.000Z" });
      expect("createdByName" in mapped).toBe(false);
    });
  });

  describe("mapDiagramSessionParticipant", () => {
    it("maps a participant row", () => {
      const mapped = mapDiagramSessionParticipant({
        userId: "u1",
        clientId: "c1",
        status: "ONLINE",
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        leftAt: null,
        lastHeartbeatAt: null,
        user: { firstName: "Ana", lastName: "Paz" }
      });

      expect(mapped).toMatchObject({
        userId: "u1",
        clientId: "c1",
        name: "Ana Paz",
        status: "ONLINE",
        joinedAt: "2026-01-01T00:00:00.000Z",
        leftAt: null
      });
    });
  });
});
