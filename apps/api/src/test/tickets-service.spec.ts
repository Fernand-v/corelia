import { describe, expect, it, vi } from "vitest";
import { TicketService } from "../modules/tickets/service.js";

type App = ConstructorParameters<typeof TicketService>[0];

const baseTicketRow = {
  id: "t-1",
  code: 1,
  title: "Impresora sin tinta",
  description: null,
  estadoId: 1,
  prioridadId: 2,
  assigneeId: null,
  createdById: "u-1",
  resolvedAt: null,
  createdAt: new Date("2026-06-26T10:00:00.000Z"),
  updatedAt: new Date("2026-06-26T10:00:00.000Z"),
  estado: { id: 1, nombre: "Abierto" },
  prioridad: { id: 2, nombre: "Normal" },
  assignee: null,
  createdBy: { firstName: "Ana", lastName: "Diaz" }
};

describe("TicketService", () => {
  it("restricts the list to own tickets when the user cannot manage", async () => {
    const findMany = vi.fn().mockResolvedValue([baseTicketRow]);
    const app = { prisma: { ticket: { findMany } } } as unknown as App;
    const service = new TicketService(app);

    await service.listTickets("u-1", {}, false);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdById: "u-1" }) })
    );
  });

  it("lists every ticket when the user can manage", async () => {
    const findMany = vi.fn().mockResolvedValue([baseTicketRow]);
    const app = { prisma: { ticket: { findMany } } } as unknown as App;
    const service = new TicketService(app);

    await service.listTickets("support-1", {}, true);

    const where = findMany.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("createdById");
  });

  it("sets the creator id and notifies the support team on creation", async () => {
    const create = vi.fn().mockResolvedValue(baseTicketRow);
    const prioridadFind = vi.fn().mockResolvedValue({ id: 2 });
    const estadoFirst = vi.fn().mockResolvedValue({ id: 1 });
    const supportUsers = vi.fn().mockResolvedValue([]);
    const app = {
      prisma: {
        ticket: { create },
        ticketPrioridad: { findUnique: prioridadFind },
        ticketEstado: { findFirst: estadoFirst },
        user: { findMany: supportUsers }
      }
    } as unknown as App;
    const service = new TicketService(app);

    await service.createTicket({ title: "Impresora sin tinta", prioridadId: 2 }, "u-1");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: "u-1", estadoId: 1 }) })
    );
    expect(supportUsers).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown priority", async () => {
    const prioridadFind = vi.fn().mockResolvedValue(null);
    const app = {
      prisma: { ticketPrioridad: { findUnique: prioridadFind } }
    } as unknown as App;
    const service = new TicketService(app);

    await expect(
      service.createTicket({ title: "Algo", prioridadId: 99 }, "u-1")
    ).rejects.toThrow(/Prioridad/);
  });

  it("hides a foreign ticket from a non-manager", async () => {
    const findUnique = vi.fn().mockResolvedValue({ ...baseTicketRow, createdById: "someone-else" });
    const app = { prisma: { ticket: { findUnique } } } as unknown as App;
    const service = new TicketService(app);

    await expect(service.getTicket("t-1", "u-1", false)).rejects.toThrow(/no encontrado/);
  });

  it("notifies the assignee when assigned by someone else", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "t-1" });
    const userFind = vi.fn().mockResolvedValue({ id: "support-2" });
    const update = vi.fn().mockResolvedValue({ ...baseTicketRow, assigneeId: "support-2" });
    const notifCreate = vi.fn().mockResolvedValue({ id: "n-1", userId: "support-2" });
    const app = {
      prisma: {
        ticket: { findUnique, update },
        user: { findUnique: userFind },
        notification: { findFirst: vi.fn().mockResolvedValue(null), create: notifCreate }
      }
    } as unknown as App;
    const service = new TicketService(app);

    await service.assignTicket("t-1", { assigneeId: "support-2" }, "support-1");

    expect(notifCreate).toHaveBeenCalledTimes(2);
  });

  it("does not notify on self-assignment", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "t-1" });
    const userFind = vi.fn().mockResolvedValue({ id: "support-1" });
    const update = vi.fn().mockResolvedValue({ ...baseTicketRow, assigneeId: "support-1" });
    const notifCreate = vi.fn();
    const app = {
      prisma: {
        ticket: { findUnique, update },
        user: { findUnique: userFind },
        notification: { findFirst: vi.fn().mockResolvedValue(null), create: notifCreate }
      }
    } as unknown as App;
    const service = new TicketService(app);

    await service.assignTicket("t-1", { assigneeId: "support-1" }, "support-1");

    expect(notifCreate).not.toHaveBeenCalled();
  });

  it("stamps resolvedAt and notifies the creator when estado becomes RESUELTO", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ id: "t-1", code: 1, title: "X", estadoId: 1, createdById: "u-1" });
    const estadoFind = vi.fn().mockResolvedValue({ id: 3 });
    const update = vi
      .fn()
      .mockResolvedValue({ ...baseTicketRow, estadoId: 3, estado: { id: 3, nombre: "Resuelto" } });
    const notifCreate = vi.fn().mockResolvedValue({ id: "n-1", userId: "u-1" });
    const app = {
      prisma: {
        ticket: { findUnique, update },
        ticketEstado: { findUnique: estadoFind },
        notification: { findFirst: vi.fn().mockResolvedValue(null), create: notifCreate }
      }
    } as unknown as App;
    const service = new TicketService(app);

    await service.updateTicket("t-1", { estadoId: 3 });

    const data = update.mock.calls[0]![0].data;
    expect(data.estadoId).toBe(3);
    expect(data.resolvedAt).toBeInstanceOf(Date);
    // in-app + email para el creador
    expect(notifCreate).toHaveBeenCalledTimes(2);
  });
});
