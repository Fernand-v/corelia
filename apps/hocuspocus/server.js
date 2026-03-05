import { Server } from "@hocuspocus/server";

const host = process.env.HOCUSPOCUS_HOST?.trim() || "0.0.0.0";
const port = Number(process.env.HOCUSPOCUS_PORT || "1234");
const quiet = process.env.HOCUSPOCUS_QUIET === "true";

const server = Server.configure({
  address: host,
  port,
  quiet,
  timeout: 30_000,
  debounce: 2_000,
  maxDebounce: 10_000
});

server.listen();

if (!quiet) {
  console.log(`[hocuspocus] listening on ws://${host}:${port}`);
}
