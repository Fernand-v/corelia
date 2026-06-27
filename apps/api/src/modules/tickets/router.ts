import type { FastifyPluginAsync } from "fastify";
import { parseWithSchema } from "../../lib/validate.js";
import { TicketService } from "./service.js";
import { ticketSchemas } from "./schema.js";

const canManageTickets = (permissions: readonly string[] | undefined) =>
  permissions?.includes("TICKET_GESTIONAR") ?? false;

export const ticketsRouter: FastifyPluginAsync = async (app) => {
  const service = new TicketService(app);

  app.get(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      const query = parseWithSchema(ticketSchemas.ticketListQuerySchema, request.query ?? {});
      return service.listTickets(
        request.authUser!.id,
        query,
        canManageTickets(request.accessContext?.permissions)
      );
    }
  );

  app.get(
    "/meta",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "LEER"
      }
    },
    async () => service.getMeta()
  );

  app.get(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "LEER"
      }
    },
    async (request) => {
      const { id } = parseWithSchema(ticketSchemas.ticketIdParamsSchema, request.params);
      return service.getTicket(
        id,
        request.authUser!.id,
        canManageTickets(request.accessContext?.permissions)
      );
    }
  );

  app.post(
    "/",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "CREAR"
      }
    },
    async (request, reply) => {
      const payload = parseWithSchema(ticketSchemas.createTicketInputSchema, request.body);
      const ticket = await service.createTicket(payload, request.authUser!.id);
      return reply.code(201).send(ticket);
    }
  );

  app.patch(
    "/:id",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "GESTIONAR"
      }
    },
    async (request) => {
      const { id } = parseWithSchema(ticketSchemas.ticketIdParamsSchema, request.params);
      const payload = parseWithSchema(ticketSchemas.updateTicketInputSchema, request.body);
      return service.updateTicket(id, payload);
    }
  );

  app.patch(
    "/:id/assign",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "ASIGNAR"
      }
    },
    async (request) => {
      const { id } = parseWithSchema(ticketSchemas.ticketIdParamsSchema, request.params);
      const payload = parseWithSchema(ticketSchemas.assignTicketInputSchema, request.body);
      return service.assignTicket(id, payload, request.authUser!.id);
    }
  );

  app.post(
    "/:id/comments",
    {
      config: {
        requiresAuth: true,
        requiredProgram: "TICKETS",
        requiredResource: "TICKET",
        requiredAction: "COMENTAR"
      }
    },
    async (request, reply) => {
      const { id } = parseWithSchema(ticketSchemas.ticketIdParamsSchema, request.params);
      const payload = parseWithSchema(ticketSchemas.ticketCommentInputSchema, request.body);
      const comment = await service.addComment(
        id,
        request.authUser!.id,
        payload.content,
        canManageTickets(request.accessContext?.permissions)
      );
      return reply.code(201).send(comment);
    }
  );
};
