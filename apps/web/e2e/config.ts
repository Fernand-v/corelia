// Constantes compartidas entre la config de Playwright (servidores) y los specs
// (firma de tokens). El secreto es de uso exclusivo del entorno de pruebas E2E.
export const TEST_COLLAB_SECRET = "e2e-collab-secret-do-not-use-in-prod";
export const HOCUSPOCUS_PORT = 7878;
export const STATIC_PORT = 4173;

export const wsUrl = () => `ws://127.0.0.1:${HOCUSPOCUS_PORT}`;
export const fixtureUrl = () => `http://127.0.0.1:${STATIC_PORT}/collab.html`;
