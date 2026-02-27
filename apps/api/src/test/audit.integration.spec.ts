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

    await app.close();
  });
});
