import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { auditPlugin } from "../plugins/audit.js";

describe("Audit middleware", () => {
  it("writes audit log automatically for critical events", async () => {
    const app = Fastify();

    app.decorate(
      "prisma",
      {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      } as never
    );

    await app.register(auditPlugin);

    app.post("/critical", async (request, reply) => {
      request.authUser = { id: crypto.randomUUID(), email: "a@b.com" };
      request.auditEvent = {
        entityType: "TAREA",
        entityId: crypto.randomUUID(),
        action: "ACTUALIZAR",
        reason: "test"
      };
      return reply.code(201).send({ ok: true });
    });

    const response = await app.inject({
      method: "POST",
      url: "/critical"
    });

    expect(response.statusCode).toBe(201);
    expect(app.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(app.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetTaskId: expect.any(String),
          action: "ACTUALIZAR",
          reason: "test"
        })
      })
    );

    await app.close();
  });

  it("skips writing audit when request has no auditEvent", async () => {
    const app = Fastify();

    app.decorate(
      "prisma",
      {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      } as never
    );

    await app.register(auditPlugin);

    app.get("/no-audit", async (_request, reply) => reply.code(200).send({ ok: true }));

    const response = await app.inject({
      method: "GET",
      url: "/no-audit"
    });

    expect(response.statusCode).toBe(200);
    expect(app.prisma.auditLog.create).not.toHaveBeenCalled();

    await app.close();
  });

  it("writes audit failure snapshot when response status is >= 400", async () => {
    const app = Fastify();

    app.decorate(
      "prisma",
      {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() })
        }
      } as never
    );

    await app.register(auditPlugin);

    app.post("/audit-error", async (request, reply) => {
      request.authUser = { id: crypto.randomUUID(), email: "a@b.com" };
      request.auditEvent = {
        entityType: "TAREA",
        entityId: crypto.randomUUID(),
        action: "ACTUALIZAR",
        reason: "test"
      };
      return reply.code(422).send({ ok: false });
    });

    const response = await app.inject({
      method: "POST",
      url: "/audit-error"
    });

    expect(response.statusCode).toBe(422);
    expect(app.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(app.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ACTUALIZAR",
          reason: "test",
          reasonCatalogId: "LEGACY_UNMAPPED",
          newDataText: expect.stringContaining("\"_auditOutcome\":\"FAILURE\"")
        })
      })
    );

    await app.close();
  });
});
