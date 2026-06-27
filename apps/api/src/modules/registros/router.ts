import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { ZodTypeAny } from "zod";
import type { ActionCode, ResourceCode } from "@corelia/types";
import { parseWithSchema } from "../../lib/validate.js";
import { registrosSchemas } from "./schema.js";
import {
  CiudadService,
  EmpresaService,
  PaisService,
  PersonaService,
  SexoService,
  SucursalService
} from "./service.js";

type CrudService<TInput> = {
  list: () => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  create: (input: TInput) => Promise<unknown>;
  update: (id: string, input: TInput) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
};

const registerCrud = <TInput>(
  app: FastifyInstance,
  options: {
    prefix: string;
    service: CrudService<TInput>;
    inputSchema: ZodTypeAny;
    resource: ResourceCode;
    readAction: ActionCode;
    writeAction: ActionCode;
  }
) => {
  const read = {
    requiresAuth: true,
    requiredProgram: "PERSONAS" as const,
    requiredResource: options.resource,
    requiredAction: options.readAction
  };
  const write = {
    requiresAuth: true,
    requiredProgram: "PERSONAS" as const,
    requiredResource: options.resource,
    requiredAction: options.writeAction
  };

  app.get(options.prefix, { config: read }, async () => options.service.list());

  app.get(`${options.prefix}/:id`, { config: read }, async (request) => {
    const { id } = parseWithSchema(registrosSchemas.idParamsSchema, request.params);
    return options.service.get(id);
  });

  app.post(options.prefix, { config: write }, async (request, reply) => {
    const payload = parseWithSchema(options.inputSchema, request.body) as TInput;
    const created = await options.service.create(payload);
    return reply.code(201).send(created);
  });

  app.patch(`${options.prefix}/:id`, { config: write }, async (request) => {
    const { id } = parseWithSchema(registrosSchemas.idParamsSchema, request.params);
    const payload = parseWithSchema(options.inputSchema, request.body) as TInput;
    return options.service.update(id, payload);
  });

  app.delete(`${options.prefix}/:id`, { config: write }, async (request, reply) => {
    const { id } = parseWithSchema(registrosSchemas.idParamsSchema, request.params);
    await options.service.remove(id);
    return reply.code(204).send();
  });
};

export const registrosRouter: FastifyPluginAsync = async (app) => {
  registerCrud(app, {
    prefix: "/empresas",
    service: new EmpresaService(app),
    inputSchema: registrosSchemas.empresaInputSchema,
    resource: "CATALOGO",
    readAction: "LEER",
    writeAction: "GESTIONAR"
  });

  registerCrud(app, {
    prefix: "/sucursales",
    service: new SucursalService(app),
    inputSchema: registrosSchemas.sucursalInputSchema,
    resource: "CATALOGO",
    readAction: "LEER",
    writeAction: "GESTIONAR"
  });

  registerCrud(app, {
    prefix: "/paises",
    service: new PaisService(app),
    inputSchema: registrosSchemas.paisInputSchema,
    resource: "CATALOGO",
    readAction: "LEER",
    writeAction: "GESTIONAR"
  });

  registerCrud(app, {
    prefix: "/ciudades",
    service: new CiudadService(app),
    inputSchema: registrosSchemas.ciudadInputSchema,
    resource: "CATALOGO",
    readAction: "LEER",
    writeAction: "GESTIONAR"
  });

  registerCrud(app, {
    prefix: "/sexos",
    service: new SexoService(app),
    inputSchema: registrosSchemas.sexoInputSchema,
    resource: "CATALOGO",
    readAction: "LEER",
    writeAction: "GESTIONAR"
  });

  // Persona: create necesita el autor.
  const personaService = new PersonaService(app);
  const personaRead = {
    requiresAuth: true,
    requiredProgram: "PERSONAS" as const,
    requiredResource: "PERSONA" as const,
    requiredAction: "LEER" as const
  };
  const personaWrite = {
    requiresAuth: true,
    requiredProgram: "PERSONAS" as const,
    requiredResource: "PERSONA" as const,
    requiredAction: "GESTIONAR" as const
  };

  app.get("/personas", { config: personaRead }, async () => personaService.list());

  app.get("/personas/:id", { config: personaRead }, async (request) => {
    const { id } = parseWithSchema(registrosSchemas.idParamsSchema, request.params);
    return personaService.get(id);
  });

  app.post("/personas", { config: personaWrite }, async (request, reply) => {
    const payload = parseWithSchema(registrosSchemas.personaInputSchema, request.body);
    const created = await personaService.create(payload, request.authUser!.id);
    return reply.code(201).send(created);
  });

  app.patch("/personas/:id", { config: personaWrite }, async (request) => {
    const { id } = parseWithSchema(registrosSchemas.idParamsSchema, request.params);
    const payload = parseWithSchema(registrosSchemas.personaInputSchema, request.body);
    return personaService.update(id, payload);
  });

  app.delete("/personas/:id", { config: personaWrite }, async (request, reply) => {
    const { id } = parseWithSchema(registrosSchemas.idParamsSchema, request.params);
    await personaService.remove(id);
    return reply.code(204).send();
  });
};
