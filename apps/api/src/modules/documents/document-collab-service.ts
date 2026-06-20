import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { mapDiagramSessionParticipant, normalizeClientId } from "./document-helpers.js";

const DOCUMENT_DIAGRAM_SESSION_SNAPSHOT_MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_DIAGRAM_SNAPSHOT_MIME = "application/xml";
const DOCUMENT_DIAGRAM_SESSION_STALE_MS = 70_000;

type SessionEventType =
  | "JOIN"
  | "LEAVE"
  | "DISCONNECT"
  | "RECONNECT"
  | "SNAPSHOT_SAVED"
  | "SAVE_VERSION"
  | "ERROR"
  | "MIGRATION";

type CollabDocument = Prisma.CollaborativeDocumentGetPayload<{
  include: { createdBy: { select: { firstName: true; lastName: true } } };
}>;

// Sub-servicio de sesiones colaborativas avanzadas de diagramas, extraído de
// DocumentsService. Recibe getDocumentForUser por inyección para reutilizar el
// control de acceso del servicio principal sin acoplarse a su clase.
export class DocumentCollabService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly getDocumentForUser: (input: {
      documentId: string;
      userId: string;
    }) => Promise<CollabDocument>
  ) {}

  private getDiagramSessionHeartbeatMs() {
    return env.DOCUMENTS_DIAGRAM_SESSION_HEARTBEAT_MS;
  }

  private getCollabPrisma() {
    return this.app.prisma;
  }

  private getDiagramSessionSnapshotIntervalMs() {
    return env.DOCUMENTS_DIAGRAM_SESSION_SNAPSHOT_MS;
  }

  private getDiagramSessionIdleMs() {
    return env.DOCUMENTS_DIAGRAM_SESSION_IDLE_SECONDS * 1000;
  }


  private async getDiagramDocumentForUser(input: { documentId: string; userId: string }) {
    const document = await this.getDocumentForUser(input);
    if (document.type !== "DIAGRAMA") {
      throw new Error("La sesión colaborativa avanzada está disponible solo para diagramas");
    }
    return document;
  }

  private async closeIdleDiagramSessionIfNeeded(documentId: string, now: Date) {
    const activeSession = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        documentId,
        status: "ACTIVE"
      },
      orderBy: [{ startedAt: "desc" }]
    });

    if (!activeSession) {
      return null;
    }

    const idleCutoff = new Date(now.getTime() - this.getDiagramSessionIdleMs());
    if (activeSession.lastActivityAt >= idleCutoff) {
      return activeSession;
    }

    const staleCutoff = new Date(now.getTime() - DOCUMENT_DIAGRAM_SESSION_STALE_MS);
    const onlineCount = await this.getCollabPrisma().documentCollabParticipant.count({
      where: {
        sessionId: activeSession.id,
        status: "ONLINE",
        OR: [
          {
            lastHeartbeatAt: {
              gte: staleCutoff
            }
          },
          {
            lastHeartbeatAt: null,
            joinedAt: {
              gte: staleCutoff
            }
          }
        ]
      }
    });

    if (onlineCount > 0) {
      return activeSession;
    }

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabSession.update({
        where: {
          id: activeSession.id
        },
        data: {
          status: "CLOSED",
          endedAt: now,
          lastActivityAt: now
        }
      });

      await tx.documentCollabParticipant.updateMany({
        where: {
          sessionId: activeSession.id,
          status: "ONLINE"
        },
        data: {
          status: "OFFLINE",
          leftAt: now
        }
      });

      await tx.documentCollabEvent.create({
        data: {
          sessionId: activeSession.id,
          type: "DISCONNECT",
          payload: {
            reason: "idle_timeout"
          }
        }
      });
    });

    return null;
  }

  private async expireStaleDiagramParticipants(sessionId: string, now: Date) {
    const staleCutoff = new Date(now.getTime() - DOCUMENT_DIAGRAM_SESSION_STALE_MS);
    const staleParticipants = await this.getCollabPrisma().documentCollabParticipant.findMany({
      where: {
        sessionId,
        status: "ONLINE",
        OR: [
          {
            lastHeartbeatAt: {
              lt: staleCutoff
            }
          },
          {
            lastHeartbeatAt: null,
            joinedAt: {
              lt: staleCutoff
            }
          }
        ]
      },
      select: {
        id: true,
        userId: true,
        clientId: true
      }
    });

    if (staleParticipants.length === 0) {
      return;
    }

    const staleIds = staleParticipants.map((row: { id: string }) => row.id);

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.updateMany({
        where: {
          id: {
            in: staleIds
          }
        },
        data: {
          status: "OFFLINE",
          leftAt: now
        }
      });

      await tx.documentCollabEvent.createMany({
        data: staleParticipants.map((row: { userId: string; clientId: string }) => ({
          sessionId,
          userId: row.userId,
          clientId: row.clientId,
          type: "DISCONNECT",
          payload: {
            reason: "heartbeat_timeout"
          }
        }))
      });
    });
  }

  private async getSessionParticipants(sessionId: string) {
    const rows = await this.getCollabPrisma().documentCollabParticipant.findMany({
      where: {
        sessionId
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [{ joinedAt: "asc" }]
    });

    return rows.map((row: {
      userId: string;
      clientId: string;
      status: "ONLINE" | "OFFLINE";
      joinedAt: Date;
      leftAt: Date | null;
      lastHeartbeatAt: Date | null;
      user: {
        firstName: string;
        lastName: string;
      };
    }) => mapDiagramSessionParticipant(row));
  }

  private async getSessionLastEvent(sessionId: string): Promise<SessionEventType | null> {
    const event = await this.getCollabPrisma().documentCollabEvent.findFirst({
      where: {
        sessionId
      },
      select: {
        type: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return (event?.type as SessionEventType | undefined) ?? null;
  }

  async joinDiagramSession(input: {
    documentId: string;
    userId: string;
    clientId?: string;
  }) {
    const document = await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });
    const now = new Date();
    const clientId = normalizeClientId(input.clientId);

    let activeSession = await this.closeIdleDiagramSessionIfNeeded(document.id, now);
    if (!activeSession) {
      activeSession = await this.getCollabPrisma().documentCollabSession.create({
        data: {
          documentId: document.id,
          roomName: document.yDocName,
          status: "ACTIVE",
          lastActivityAt: now
        }
      });
    }

    const participantKey = {
      sessionId: activeSession.id,
      userId: input.userId,
      clientId
    };

    const previousParticipant = await this.getCollabPrisma().documentCollabParticipant.findUnique({
      where: {
        sessionId_userId_clientId: participantKey
      },
      select: {
        status: true
      }
    });

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.upsert({
        where: {
          sessionId_userId_clientId: participantKey
        },
        update: {
          status: "ONLINE",
          leftAt: null,
          lastHeartbeatAt: now
        },
        create: {
          sessionId: activeSession!.id,
          userId: input.userId,
          clientId,
          status: "ONLINE",
          joinedAt: now,
          lastHeartbeatAt: now
        }
      });

      await tx.documentCollabSession.update({
        where: {
          id: activeSession!.id
        },
        data: {
          lastActivityAt: now
        }
      });

      if (!previousParticipant) {
        await tx.documentCollabEvent.create({
          data: {
            sessionId: activeSession!.id,
            userId: input.userId,
            clientId,
            type: "JOIN"
          }
        });
      } else if (previousParticipant.status === "OFFLINE") {
        await tx.documentCollabEvent.create({
          data: {
            sessionId: activeSession!.id,
            userId: input.userId,
            clientId,
            type: "RECONNECT"
          }
        });
      }
    });

    await this.expireStaleDiagramParticipants(activeSession.id, now);

    const [session, participants] = await Promise.all([
      this.getCollabPrisma().documentCollabSession.findUniqueOrThrow({
        where: {
          id: activeSession.id
        }
      }),
      this.getSessionParticipants(activeSession.id)
    ]);

    return {
      sessionId: session.id,
      roomName: session.roomName,
      status: session.status,
      heartbeatMs: this.getDiagramSessionHeartbeatMs(),
      snapshotIntervalMs: this.getDiagramSessionSnapshotIntervalMs(),
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      revision: session.revision,
      lastSnapshotAt: session.latestSnapshotAt ? session.latestSnapshotAt.toISOString() : null,
      lastSnapshotHash: session.latestSnapshotHash ?? null,
      participants
    };
  }

  async heartbeatDiagramSession(input: {
    documentId: string;
    userId: string;
    sessionId: string;
    clientId: string;
  }) {
    await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const session = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        id: input.sessionId,
        documentId: input.documentId,
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    });

    if (!session) {
      throw new Error("La sesión colaborativa no está activa");
    }

    const now = new Date();
    const clientId = normalizeClientId(input.clientId);
    const participantKey = {
      sessionId: session.id,
      userId: input.userId,
      clientId
    };

    const previousParticipant = await this.getCollabPrisma().documentCollabParticipant.findUnique({
      where: {
        sessionId_userId_clientId: participantKey
      },
      select: {
        status: true
      }
    });

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.upsert({
        where: {
          sessionId_userId_clientId: participantKey
        },
        update: {
          status: "ONLINE",
          leftAt: null,
          lastHeartbeatAt: now
        },
        create: {
          sessionId: session.id,
          userId: input.userId,
          clientId,
          status: "ONLINE",
          joinedAt: now,
          lastHeartbeatAt: now
        }
      });

      await tx.documentCollabSession.update({
        where: {
          id: session.id
        },
        data: {
          lastActivityAt: now
        }
      });

      if (previousParticipant?.status === "OFFLINE") {
        await tx.documentCollabEvent.create({
          data: {
            sessionId: session.id,
            userId: input.userId,
            clientId,
            type: "RECONNECT"
          }
        });
      }
    });

    await this.expireStaleDiagramParticipants(session.id, now);

    const [participantsOnline, latestSession, lastEvent] = await Promise.all([
      this.getCollabPrisma().documentCollabParticipant.count({
        where: {
          sessionId: session.id,
          status: "ONLINE"
        }
      }),
      this.getCollabPrisma().documentCollabSession.findUniqueOrThrow({
        where: {
          id: session.id
        },
        select: {
          revision: true
        }
      }),
      this.getSessionLastEvent(session.id)
    ]);

    return {
      ok: true as const,
      sessionId: session.id,
      lastHeartbeatAt: now.toISOString(),
      participantsOnline,
      revision: latestSession.revision,
      lastEvent
    };
  }

  async saveDiagramSessionSnapshot(input: {
    documentId: string;
    userId: string;
    sessionId: string;
    clientId: string;
    content: string;
    reason: "interval" | "leave" | "before_unload" | "manual_save" | "migration";
    metadata?: Record<string, unknown>;
  }) {
    const document = await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const session = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        id: input.sessionId,
        documentId: input.documentId,
        status: "ACTIVE"
      }
    });

    if (!session) {
      throw new Error("La sesión colaborativa no está activa");
    }

    const now = new Date();
    const clientId = normalizeClientId(input.clientId);
    const contentBuffer = Buffer.from(input.content, "utf8");
    if (contentBuffer.byteLength <= 0) {
      throw new Error("El snapshot está vacío");
    }
    if (contentBuffer.byteLength > DOCUMENT_DIAGRAM_SESSION_SNAPSHOT_MAX_BYTES) {
      throw new Error("El snapshot excede el límite de 10MB");
    }

    const snapshotHash = createHash("sha256").update(contentBuffer).digest("hex");
    const deduped = session.latestSnapshotHash === snapshotHash;
    let nextRevision = session.revision;
    const eventType: SessionEventType =
      input.reason === "migration" ? "MIGRATION" : "SNAPSHOT_SAVED";
    const metadata =
      input.metadata === undefined
        ? null
        : (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue);

    await this.app.prisma.$transaction(async (tx) => {
      await tx.documentCollabParticipant.upsert({
        where: {
          sessionId_userId_clientId: {
            sessionId: session.id,
            userId: input.userId,
            clientId
          }
        },
        update: {
          status: "ONLINE",
          leftAt: null,
          lastHeartbeatAt: now
        },
        create: {
          sessionId: session.id,
          userId: input.userId,
          clientId,
          status: "ONLINE",
          joinedAt: now,
          lastHeartbeatAt: now
        }
      });

      if (!deduped) {
        if (!this.app.storage) {
          throw new Error("Servicio de almacenamiento no disponible");
        }
        nextRevision = session.revision + 1;
        const snapshotPath =
          `documents/${document.projectId}/documentos/diagrama/${document.id}/sessions/${session.id}` +
          `/r${nextRevision}-${Date.now()}-${randomUUID()}.drawio`;
        await this.app.storage.putObject(snapshotPath, contentBuffer, DOCUMENT_DIAGRAM_SNAPSHOT_MIME);

        await tx.documentCollabSession.update({
          where: {
            id: session.id
          },
          data: {
            revision: nextRevision,
            latestSnapshotPath: snapshotPath,
            latestSnapshotHash: snapshotHash,
            latestSnapshotSizeBytes: contentBuffer.byteLength,
            latestSnapshotAt: now,
            lastActivityAt: now
          }
        });

        await tx.documentCollabEvent.create({
          data: {
            sessionId: session.id,
            userId: input.userId,
            clientId,
            type: eventType,
            payload: {
              reason: input.reason,
              snapshotHash,
              snapshotPath,
              snapshotSizeBytes: contentBuffer.byteLength,
              revision: nextRevision,
              deduped: false,
              metadata
            }
          }
        });
      } else {
        await tx.documentCollabSession.update({
          where: {
            id: session.id
          },
          data: {
            lastActivityAt: now
          }
        });

        if (input.reason === "migration") {
          await tx.documentCollabEvent.create({
            data: {
              sessionId: session.id,
              userId: input.userId,
              clientId,
              type: "MIGRATION",
              payload: {
                reason: input.reason,
                snapshotHash,
                revision: nextRevision,
                deduped: true,
                metadata
              }
            }
          });
        }
      }
    });

    await this.expireStaleDiagramParticipants(session.id, now);

    return {
      ok: true as const,
      sessionId: session.id,
      deduped,
      revision: nextRevision,
      snapshotHash,
      snapshotAt: now.toISOString(),
      eventType
    };
  }

  async leaveDiagramSession(input: {
    documentId: string;
    userId: string;
    sessionId: string;
    clientId: string;
  }) {
    await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const session = await this.getCollabPrisma().documentCollabSession.findFirst({
      where: {
        id: input.sessionId,
        documentId: input.documentId,
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    });
    if (!session) {
      throw new Error("La sesión colaborativa no está activa");
    }

    const now = new Date();
    const clientId = normalizeClientId(input.clientId);

    const updated = await this.getCollabPrisma().documentCollabParticipant.updateMany({
      where: {
        sessionId: session.id,
        userId: input.userId,
        clientId,
        status: "ONLINE"
      },
      data: {
        status: "OFFLINE",
        leftAt: now,
        lastHeartbeatAt: now
      }
    });

    await this.getCollabPrisma().documentCollabSession.update({
      where: {
        id: session.id
      },
      data: {
        lastActivityAt: now
      }
    });

    if (updated.count > 0) {
      await this.getCollabPrisma().documentCollabEvent.create({
        data: {
          sessionId: session.id,
          userId: input.userId,
          clientId,
          type: "LEAVE"
        }
      });
    }

    return {
      ok: true as const,
      sessionId: session.id,
      leftAt: now.toISOString()
    };
  }

  async getDiagramSessionState(input: {
    documentId: string;
    userId: string;
  }) {
    const document = await this.getDiagramDocumentForUser({
      documentId: input.documentId,
      userId: input.userId
    });

    const now = new Date();
    const active = await this.closeIdleDiagramSessionIfNeeded(document.id, now);
    if (!active) {
      return {
        sessionId: null,
        roomName: null,
        status: null,
        heartbeatMs: this.getDiagramSessionHeartbeatMs(),
        snapshotIntervalMs: this.getDiagramSessionSnapshotIntervalMs(),
        startedAt: null,
        lastActivityAt: null,
        revision: 0,
        lastSnapshotAt: null,
        lastSnapshotHash: null,
        lastEvent: null,
        participants: [],
        participantsOnline: 0
      };
    }

    await this.expireStaleDiagramParticipants(active.id, now);

    const [session, participants, participantsOnline, lastEvent] = await Promise.all([
      this.getCollabPrisma().documentCollabSession.findUniqueOrThrow({
        where: {
          id: active.id
        }
      }),
      this.getSessionParticipants(active.id),
      this.getCollabPrisma().documentCollabParticipant.count({
        where: {
          sessionId: active.id,
          status: "ONLINE"
        }
      }),
      this.getSessionLastEvent(active.id)
    ]);

    return {
      sessionId: session.id,
      roomName: session.roomName,
      status: session.status,
      heartbeatMs: this.getDiagramSessionHeartbeatMs(),
      snapshotIntervalMs: this.getDiagramSessionSnapshotIntervalMs(),
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      revision: session.revision,
      lastSnapshotAt: session.latestSnapshotAt ? session.latestSnapshotAt.toISOString() : null,
      lastSnapshotHash: session.latestSnapshotHash ?? null,
      lastEvent,
      participants,
      participantsOnline
    };
  }

}
