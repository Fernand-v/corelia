import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: {
    DOCUMENTS_DIAGRAM_SESSION_HEARTBEAT_MS: 20_000,
    DOCUMENTS_DIAGRAM_SESSION_SNAPSHOT_MS: 30_000,
    DOCUMENTS_DIAGRAM_SESSION_IDLE_SECONDS: 900
  }
}));

import { DocumentCollabService } from "../modules/documents/document-collab-service.js";

type Ctor = ConstructorParameters<typeof DocumentCollabService>;

const diagramDoc = {
  id: "doc-1",
  type: "DIAGRAMA",
  yDocName: "room-doc-1",
  projectId: "p-1",
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

const docResolver = (doc: Record<string, unknown> = diagramDoc): Ctor[1] =>
  vi.fn().mockResolvedValue(doc) as unknown as Ctor[1];

const sessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "s-1",
  roomName: "room-doc-1",
  status: "ACTIVE" as const,
  startedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastActivityAt: new Date(),
  revision: 0,
  latestSnapshotAt: null,
  latestSnapshotHash: null,
  latestSnapshotSizeBytes: null,
  latestSnapshotPath: null,
  ...overrides
});

const participantRow = (overrides: Record<string, unknown> = {}) => ({
  userId: "u-1",
  clientId: "c-1",
  status: "ONLINE" as const,
  joinedAt: new Date("2026-01-01T00:00:00.000Z"),
  leftAt: null,
  lastHeartbeatAt: new Date(),
  user: { firstName: "Ana", lastName: "Pérez" },
  ...overrides
});

type PrismaOpts = {
  activeSession?: unknown;
  createdSession?: unknown;
  session?: unknown;
  participants?: unknown[];
  onlineCount?: number;
  previousParticipant?: unknown;
  leaveCount?: number;
  lastEvent?: unknown;
};

const makeCollabPrisma = (opts: PrismaOpts = {}) => {
  const participants = opts.participants ?? [];
  const prisma = {
    documentCollabSession: {
      findFirst: vi.fn().mockResolvedValue(opts.activeSession ?? null),
      create: vi.fn().mockResolvedValue(opts.createdSession ?? sessionRow()),
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue(opts.session ?? sessionRow())
    },
    documentCollabParticipant: {
      // findMany se usa en dos sitios: getSessionParticipants (con include.user)
      // y expireStaleDiagramParticipants (con select). Devolvemos la lista sólo
      // para la consulta con include para no marcar participantes como stale.
      findMany: vi.fn(async (args?: { include?: { user?: unknown } }) =>
        args?.include?.user ? participants : []
      ),
      count: vi.fn().mockResolvedValue(opts.onlineCount ?? 0),
      findUnique: vi.fn().mockResolvedValue(opts.previousParticipant ?? null),
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: opts.leaveCount ?? 0 })
    },
    documentCollabEvent: {
      findFirst: vi.fn().mockResolvedValue(opts.lastEvent ?? null),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: vi.fn()
  };
  prisma.$transaction.mockImplementation(
    async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)
  );
  return prisma;
};

const buildService = (
  prisma: ReturnType<typeof makeCollabPrisma>,
  extraApp: Record<string, unknown> = {},
  doc: Record<string, unknown> = diagramDoc
) => {
  const app = { prisma, ...extraApp } as unknown as Ctor[0];
  return new DocumentCollabService(app, docResolver(doc));
};

const recent = () => new Date();
const stale = () => new Date(Date.now() - 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentCollabService.getDiagramSessionState", () => {
  it("returns an empty state when there is no active session", async () => {
    const service = buildService(makeCollabPrisma());

    const state = await service.getDiagramSessionState({ documentId: "doc-1", userId: "u-1" });

    expect(state.sessionId).toBeNull();
    expect(state.participants).toEqual([]);
    expect(state.participantsOnline).toBe(0);
    expect(state.heartbeatMs).toBe(20_000);
    expect(state.snapshotIntervalMs).toBe(30_000);
  });

  it("rejects sessions for non-diagram documents", async () => {
    const service = buildService(makeCollabPrisma(), {}, { ...diagramDoc, type: "TEXTO" });

    await expect(
      service.getDiagramSessionState({ documentId: "doc-1", userId: "u-1" })
    ).rejects.toThrow(/solo para diagramas/);
  });

  it("returns the populated state of an active session", async () => {
    const active = sessionRow({ lastActivityAt: recent(), revision: 4 });
    const prisma = makeCollabPrisma({
      activeSession: active,
      session: active,
      participants: [participantRow(), participantRow({ userId: "u-2", clientId: "c-2" })],
      onlineCount: 2,
      lastEvent: { type: "JOIN" }
    });
    const service = buildService(prisma);

    const state = await service.getDiagramSessionState({ documentId: "doc-1", userId: "u-1" });

    expect(state.sessionId).toBe("s-1");
    expect(state.participants).toHaveLength(2);
    expect(state.participantsOnline).toBe(2);
    expect(state.revision).toBe(4);
    expect(state.lastEvent).toBe("JOIN");
  });

  it("closes an idle session with no online participants and returns empty", async () => {
    const idle = sessionRow({ lastActivityAt: stale() });
    const prisma = makeCollabPrisma({ activeSession: idle, onlineCount: 0 });
    const service = buildService(prisma);

    const state = await service.getDiagramSessionState({ documentId: "doc-1", userId: "u-1" });

    expect(state.sessionId).toBeNull();
    // Cierre dentro de una transacción.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("DocumentCollabService.joinDiagramSession", () => {
  it("creates a new session and emits a JOIN event for a first-time participant", async () => {
    const created = sessionRow();
    const prisma = makeCollabPrisma({
      activeSession: null,
      createdSession: created,
      session: created,
      participants: [participantRow()],
      previousParticipant: null
    });
    const service = buildService(prisma);

    const result = await service.joinDiagramSession({ documentId: "doc-1", userId: "u-1" });

    expect(prisma.documentCollabSession.create).toHaveBeenCalledTimes(1);
    expect(result.sessionId).toBe("s-1");
    expect(result.roomName).toBe("room-doc-1");
    expect(result.participants).toHaveLength(1);
    expect(prisma.documentCollabEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "JOIN" }) })
    );
  });

  it("reuses a recent active session instead of creating one", async () => {
    const active = sessionRow({ lastActivityAt: recent() });
    const prisma = makeCollabPrisma({
      activeSession: active,
      session: active,
      participants: [participantRow()],
      previousParticipant: null
    });
    const service = buildService(prisma);

    await service.joinDiagramSession({ documentId: "doc-1", userId: "u-1" });

    expect(prisma.documentCollabSession.create).not.toHaveBeenCalled();
  });

  it("emits a RECONNECT event when a previously offline participant rejoins", async () => {
    const active = sessionRow({ lastActivityAt: recent() });
    const prisma = makeCollabPrisma({
      activeSession: active,
      session: active,
      participants: [participantRow()],
      previousParticipant: { status: "OFFLINE" }
    });
    const service = buildService(prisma);

    await service.joinDiagramSession({ documentId: "doc-1", userId: "u-1", clientId: "c-1" });

    expect(prisma.documentCollabEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "RECONNECT" }) })
    );
  });
});

describe("DocumentCollabService.heartbeatDiagramSession", () => {
  const input = { documentId: "doc-1", userId: "u-1", sessionId: "s-1", clientId: "c-1" };

  it("throws when the session is not active", async () => {
    const prisma = makeCollabPrisma({ activeSession: null });
    const service = buildService(prisma);
    await expect(service.heartbeatDiagramSession(input)).rejects.toThrow(/no está activa/);
  });

  it("refreshes the heartbeat and reports online count, revision and last event", async () => {
    const prisma = makeCollabPrisma({
      activeSession: { id: "s-1" },
      session: { revision: 7 },
      onlineCount: 3,
      lastEvent: { type: "RECONNECT" }
    });
    const service = buildService(prisma);

    const result = await service.heartbeatDiagramSession(input);

    expect(result.ok).toBe(true);
    expect(result.participantsOnline).toBe(3);
    expect(result.revision).toBe(7);
    expect(result.lastEvent).toBe("RECONNECT");
    expect(prisma.documentCollabParticipant.upsert).toHaveBeenCalled();
  });
});

describe("DocumentCollabService.saveDiagramSessionSnapshot", () => {
  const base = {
    documentId: "doc-1",
    userId: "u-1",
    sessionId: "s-1",
    clientId: "c-1",
    reason: "interval" as const
  };

  it("throws when the session is not active", async () => {
    const prisma = makeCollabPrisma({ activeSession: null });
    const service = buildService(prisma, { storage: { putObject: vi.fn() } });
    await expect(
      service.saveDiagramSessionSnapshot({ ...base, content: "<xml/>" })
    ).rejects.toThrow(/no está activa/);
  });

  it("rejects an empty snapshot", async () => {
    const prisma = makeCollabPrisma({ activeSession: sessionRow() });
    const service = buildService(prisma, { storage: { putObject: vi.fn() } });
    await expect(service.saveDiagramSessionSnapshot({ ...base, content: "" })).rejects.toThrow(
      /vacío/
    );
  });

  it("rejects a snapshot larger than 10MB", async () => {
    const prisma = makeCollabPrisma({ activeSession: sessionRow() });
    const service = buildService(prisma, { storage: { putObject: vi.fn() } });
    const huge = "x".repeat(10 * 1024 * 1024 + 1);
    await expect(service.saveDiagramSessionSnapshot({ ...base, content: huge })).rejects.toThrow(
      /10MB/
    );
  });

  it("persists a new snapshot to storage and bumps the revision", async () => {
    const putObject = vi.fn().mockResolvedValue(undefined);
    const prisma = makeCollabPrisma({
      activeSession: sessionRow({ revision: 2, latestSnapshotHash: "previous-hash" })
    });
    const service = buildService(prisma, { storage: { putObject } });

    const result = await service.saveDiagramSessionSnapshot({ ...base, content: "<diagram/>" });

    expect(result.deduped).toBe(false);
    expect(result.revision).toBe(3);
    expect(putObject).toHaveBeenCalledTimes(1);
    const [path, , mime] = putObject.mock.calls[0]!;
    expect(path).toContain("documents/p-1/documentos/diagrama/doc-1/sessions/s-1");
    expect(mime).toBe("application/xml");
  });

  it("dedupes when the snapshot hash matches and does not write to storage", async () => {
    const content = "<diagram/>";
    const hash = createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
    const putObject = vi.fn();
    const prisma = makeCollabPrisma({
      activeSession: sessionRow({ revision: 5, latestSnapshotHash: hash })
    });
    const service = buildService(prisma, { storage: { putObject } });

    const result = await service.saveDiagramSessionSnapshot({ ...base, content });

    expect(result.deduped).toBe(true);
    expect(result.revision).toBe(5);
    expect(putObject).not.toHaveBeenCalled();
  });

  it("throws when storage is unavailable for a non-deduped snapshot", async () => {
    const prisma = makeCollabPrisma({
      activeSession: sessionRow({ latestSnapshotHash: "other" })
    });
    const service = buildService(prisma, { storage: null });

    await expect(
      service.saveDiagramSessionSnapshot({ ...base, content: "<diagram/>" })
    ).rejects.toThrow(/almacenamiento no disponible/);
  });
});

describe("DocumentCollabService.leaveDiagramSession", () => {
  const input = { documentId: "doc-1", userId: "u-1", sessionId: "s-1", clientId: "c-1" };

  it("throws when the session is not active", async () => {
    const prisma = makeCollabPrisma({ activeSession: null });
    const service = buildService(prisma);
    await expect(service.leaveDiagramSession(input)).rejects.toThrow(/no está activa/);
  });

  it("marks the participant offline and emits a LEAVE event", async () => {
    const prisma = makeCollabPrisma({ activeSession: { id: "s-1" }, leaveCount: 1 });
    const service = buildService(prisma);

    const result = await service.leaveDiagramSession(input);

    expect(result.ok).toBe(true);
    expect(prisma.documentCollabParticipant.updateMany).toHaveBeenCalled();
    expect(prisma.documentCollabEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "LEAVE" }) })
    );
  });

  it("does not emit a LEAVE event when no online participant matched", async () => {
    const prisma = makeCollabPrisma({ activeSession: { id: "s-1" }, leaveCount: 0 });
    const service = buildService(prisma);

    await service.leaveDiagramSession(input);

    expect(prisma.documentCollabEvent.create).not.toHaveBeenCalled();
  });
});
