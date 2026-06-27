import type { FastifyInstance } from "fastify";
import type { NotificationEvent } from "@prisma/client";
import type {
  AssignTicketInput,
  CreateTicketInput,
  TicketListQuery,
  UpdateTicketInput
} from "@corelia/types";
import { createAndDispatchNotification } from "../../lib/notifications.js";

// Claves numéricas del catálogo estados_ticket (ver migración 20260626120000_tickets).
const ESTADO_RESUELTO_ID = 3;

const validationError = (message: string) => {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
};

const notFoundError = (message: string) => {
  const error = new Error(message);
  error.name = "NotFoundError";
  return error;
};

const userSelect = {
  select: { id: true, firstName: true, lastName: true }
} as const;

const catalogSelect = { select: { id: true, nombre: true } } as const;

type UserRef = { firstName: string; lastName: string } | null;
type CatalogRef = { id: number; nombre: string } | null;

const fullName = (user: UserRef) => (user ? `${user.firstName} ${user.lastName}`.trim() : null);

export class TicketService {
  constructor(private readonly app: FastifyInstance) {}

  private mapTicket(ticket: {
    id: string;
    code: number;
    title: string;
    description: string | null;
    estadoId: number;
    prioridadId: number;
    assigneeId: string | null;
    createdById: string;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    estado?: CatalogRef;
    prioridad?: CatalogRef;
    assignee?: UserRef;
    createdBy?: UserRef;
    comments?: {
      id: string;
      ticketId: string;
      authorId: string;
      content: string;
      createdAt: Date;
      author?: UserRef;
    }[];
  }) {
    return {
      id: ticket.id,
      code: ticket.code,
      title: ticket.title,
      description: ticket.description,
      estadoId: ticket.estadoId,
      ...(ticket.estado ? { estado: ticket.estado } : {}),
      prioridadId: ticket.prioridadId,
      ...(ticket.prioridad ? { prioridad: ticket.prioridad } : {}),
      assigneeId: ticket.assigneeId,
      assigneeName: fullName(ticket.assignee ?? null),
      createdById: ticket.createdById,
      createdByName: fullName(ticket.createdBy ?? null),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      ...(ticket.comments
        ? {
            comments: ticket.comments.map((comment) => ({
              id: comment.id,
              ticketId: comment.ticketId,
              authorId: comment.authorId,
              authorName: fullName(comment.author ?? null),
              content: comment.content,
              createdAt: comment.createdAt.toISOString()
            }))
          }
        : {})
    };
  }

  async getMeta() {
    const [estados, prioridades] = await Promise.all([
      this.app.prisma.ticketEstado.findMany({ orderBy: { id: "asc" } }),
      this.app.prisma.ticketPrioridad.findMany({ orderBy: { id: "asc" } })
    ]);
    return { estados, prioridades };
  }

  async listTickets(userId: string, query: TicketListQuery, canManage: boolean) {
    const restrictToOwn = !canManage || query.mine === true;

    const tickets = await this.app.prisma.ticket.findMany({
      where: {
        ...(restrictToOwn ? { createdById: userId } : {}),
        ...(query.estadoId ? { estadoId: query.estadoId } : {}),
        ...(query.prioridadId ? { prioridadId: query.prioridadId } : {})
      },
      include: {
        estado: catalogSelect,
        prioridad: catalogSelect,
        assignee: userSelect,
        createdBy: userSelect
      },
      orderBy: { createdAt: "desc" },
      // Tope defensivo: evita cargar todos los tickets a memoria.
      take: 200
    });

    return tickets.map((ticket) => this.mapTicket(ticket));
  }

  async getTicket(id: string, userId: string, canManage: boolean) {
    const ticket = await this.app.prisma.ticket.findUnique({
      where: { id },
      include: {
        estado: catalogSelect,
        prioridad: catalogSelect,
        assignee: userSelect,
        createdBy: userSelect,
        comments: {
          include: { author: userSelect },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!ticket || (!canManage && ticket.createdById !== userId)) {
      throw notFoundError("Ticket no encontrado");
    }

    return this.mapTicket(ticket);
  }

  async createTicket(input: CreateTicketInput, createdById: string) {
    await this.ensurePrioridad(input.prioridadId);

    // Estado inicial = primer estado del catálogo (orden por id). Sin id mágico hardcodeado.
    const estadoInicial = await this.app.prisma.ticketEstado.findFirst({
      orderBy: { id: "asc" },
      select: { id: true }
    });
    if (!estadoInicial) {
      throw validationError("No hay estados de ticket configurados");
    }

    const ticket = await this.app.prisma.ticket.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        estadoId: estadoInicial.id,
        prioridadId: input.prioridadId,
        createdById
      },
      include: {
        estado: catalogSelect,
        prioridad: catalogSelect,
        assignee: userSelect,
        createdBy: userSelect
      }
    });

    await this.notifySupportTeam(ticket.id, {
      event: "TICKET_CREADO",
      title: "Nuevo ticket de soporte",
      body: `#${ticket.code} · ${ticket.title}`,
      excludeUserId: createdById
    });

    return this.mapTicket(ticket);
  }

  async updateTicket(id: string, input: UpdateTicketInput) {
    const current = await this.app.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, estadoId: true, createdById: true }
    });
    if (!current) {
      throw notFoundError("Ticket no encontrado");
    }

    if (input.estadoId !== undefined) {
      await this.ensureEstado(input.estadoId);
    }
    if (input.prioridadId !== undefined) {
      await this.ensurePrioridad(input.prioridadId);
    }

    const estadoChanged = input.estadoId !== undefined && input.estadoId !== current.estadoId;

    const ticket = await this.app.prisma.ticket.update({
      where: { id },
      data: {
        ...(input.estadoId !== undefined ? { estadoId: input.estadoId } : {}),
        ...(input.prioridadId !== undefined ? { prioridadId: input.prioridadId } : {}),
        ...(estadoChanged
          ? { resolvedAt: input.estadoId === ESTADO_RESUELTO_ID ? new Date() : null }
          : {})
      },
      include: {
        estado: catalogSelect,
        prioridad: catalogSelect,
        assignee: userSelect,
        createdBy: userSelect
      }
    });

    if (estadoChanged) {
      await this.notifyBoth(current.createdById, {
        event: "TICKET_ACTUALIZADO",
        title: "Tu ticket cambió de estado",
        body: `#${ticket.code} · ${ticket.title}: ${ticket.estado?.nombre ?? ""}`.trim(),
        groupKey: `ticket:${id}:estado`
      });
    }

    return this.mapTicket(ticket);
  }

  async assignTicket(id: string, input: AssignTicketInput, actorId: string) {
    await this.ensureExists(id);

    if (input.assigneeId) {
      const assignee = await this.app.prisma.user.findUnique({
        where: { id: input.assigneeId },
        select: { id: true }
      });
      if (!assignee) {
        throw validationError("El usuario asignado no existe");
      }
    }

    const ticket = await this.app.prisma.ticket.update({
      where: { id },
      data: { assigneeId: input.assigneeId },
      include: {
        estado: catalogSelect,
        prioridad: catalogSelect,
        assignee: userSelect,
        createdBy: userSelect
      }
    });

    if (input.assigneeId && input.assigneeId !== actorId) {
      await this.notifyBoth(input.assigneeId, {
        event: "TICKET_ACTUALIZADO",
        title: "Te asignaron un ticket",
        body: `#${ticket.code} · ${ticket.title}`,
        groupKey: `ticket:${id}:asignacion`
      });
    }

    return this.mapTicket(ticket);
  }

  async addComment(id: string, authorId: string, content: string, canManage: boolean) {
    const ticket = await this.app.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, createdById: true, assigneeId: true }
    });

    if (!ticket || (!canManage && ticket.createdById !== authorId)) {
      throw notFoundError("Ticket no encontrado");
    }

    const comment = await this.app.prisma.ticketComment.create({
      data: { ticketId: id, authorId, content },
      include: { author: userSelect }
    });

    // Avisa a la otra parte (autor del ticket o responsable asignado).
    const recipients = new Set<string>();
    if (ticket.createdById !== authorId) {
      recipients.add(ticket.createdById);
    }
    if (ticket.assigneeId && ticket.assigneeId !== authorId) {
      recipients.add(ticket.assigneeId);
    }
    for (const recipient of recipients) {
      await this.notifyBoth(recipient, {
        event: "TICKET_COMENTARIO",
        title: "Nuevo comentario en un ticket",
        body: `#${ticket.code} · ${ticket.title}`,
        groupKey: `ticket:${id}:comentario`
      });
    }

    return {
      id: comment.id,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
      authorName: fullName(comment.author ?? null),
      content: comment.content,
      createdAt: comment.createdAt.toISOString()
    };
  }

  private async ensureExists(id: string) {
    const ticket = await this.app.prisma.ticket.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!ticket) {
      throw notFoundError("Ticket no encontrado");
    }
  }

  private async ensureEstado(estadoId: number) {
    const estado = await this.app.prisma.ticketEstado.findUnique({
      where: { id: estadoId },
      select: { id: true }
    });
    if (!estado) {
      throw validationError("Estado de ticket inválido");
    }
  }

  private async ensurePrioridad(prioridadId: number) {
    const prioridad = await this.app.prisma.ticketPrioridad.findUnique({
      where: { id: prioridadId },
      select: { id: true }
    });
    if (!prioridad) {
      throw validationError("Prioridad de ticket inválida");
    }
  }

  // Notifica al equipo de soporte (rol SOPORTE_IT) y a los administradores.
  private async notifySupportTeam(
    ticketId: string,
    payload: { event: NotificationEvent; title: string; body: string; excludeUserId: string }
  ) {
    const recipients = await this.app.prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: payload.excludeUserId },
        baseRole: { key: { in: ["SOPORTE_IT", "ADMINISTRADOR"] } }
      },
      select: { id: true }
    });

    // En paralelo: cada destinatario es independiente (evita await secuencial N+1).
    await Promise.all(
      recipients.map((recipient) =>
        this.notifyBoth(recipient.id, {
          event: payload.event,
          title: payload.title,
          body: payload.body,
          groupKey: `ticket:${ticketId}:nuevo`
        })
      )
    );
  }

  // Crea notificación in-app y por correo para el mismo destinatario.
  private async notifyBoth(
    userId: string,
    payload: { event: NotificationEvent; title: string; body: string; groupKey: string }
  ) {
    await createAndDispatchNotification(this.app, {
      userId,
      event: payload.event,
      channel: "IN_APP",
      title: payload.title,
      body: payload.body,
      groupKey: `${payload.groupKey}:in_app`
    });
    await createAndDispatchNotification(this.app, {
      userId,
      event: payload.event,
      channel: "EMAIL",
      title: payload.title,
      body: payload.body,
      groupKey: `${payload.groupKey}:email`
    });
  }
}
