import type { FastifyRequest } from "fastify";

export const getProjectIdFromRequest = (request: FastifyRequest): string | undefined => {
  // El projectId del body identifica el recurso que se está mutando, así que
  // tiene precedencia: el permiso debe evaluarse contra el proyecto real del
  // recurso y no contra uno inyectado vía header/query (escalada de privilegios
  // entre proyectos). Un no-miembro del proyecto del body cae a rol invitado.
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const fromBody = body.projectId;
    if (typeof fromBody === "string" && fromBody.length > 0) {
      return fromBody;
    }
  }

  const fromHeader = request.headers["x-project-id"];
  if (typeof fromHeader === "string" && fromHeader.length > 0) {
    return fromHeader;
  }

  const maybeQuery = (request.query as Record<string, unknown> | undefined)?.projectId;
  if (typeof maybeQuery === "string" && maybeQuery.length > 0) {
    return maybeQuery;
  }

  return undefined;
};
