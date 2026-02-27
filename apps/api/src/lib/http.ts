import type { FastifyRequest } from "fastify";

export const getProjectIdFromRequest = (request: FastifyRequest): string | undefined => {
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
