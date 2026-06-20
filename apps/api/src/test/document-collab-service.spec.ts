import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: {
    DOCUMENTS_DIAGRAM_SESSION_HEARTBEAT_MS: 20_000,
    DOCUMENTS_DIAGRAM_SESSION_SNAPSHOT_MS: 30_000,
    DOCUMENTS_DIAGRAM_SESSION_IDLE_SECONDS: 900
  }
}));

import { DocumentCollabService } from "../modules/documents/document-collab-service.js";

type GetDocumentForUser = ConstructorParameters<typeof DocumentCollabService>[1];

const buildApp = () =>
  ({
    prisma: {
      documentCollabSession: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    }
  }) as unknown as ConstructorParameters<typeof DocumentCollabService>[0];

const docResolver = (doc: { id: string; type: string }): GetDocumentForUser =>
  vi.fn().mockResolvedValue(doc) as unknown as GetDocumentForUser;

describe("DocumentCollabService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty session state when there is no active session", async () => {
    const app = buildApp();
    const getDocumentForUser = docResolver({ id: "doc-1", type: "DIAGRAMA" });
    const service = new DocumentCollabService(app, getDocumentForUser);

    const state = await service.getDiagramSessionState({ documentId: "doc-1", userId: "u-1" });

    expect(state.sessionId).toBeNull();
    expect(state.participants).toEqual([]);
    expect(state.participantsOnline).toBe(0);
    expect(state.heartbeatMs).toBe(20_000);
    expect(getDocumentForUser).toHaveBeenCalledWith({ documentId: "doc-1", userId: "u-1" });
  });

  it("rejects collaborative sessions for non-diagram documents", async () => {
    const app = buildApp();
    const service = new DocumentCollabService(app, docResolver({ id: "doc-2", type: "TEXTO" }));

    await expect(
      service.getDiagramSessionState({ documentId: "doc-2", userId: "u-1" })
    ).rejects.toThrow(/solo para diagramas/);
  });
});
