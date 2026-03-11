import { Server } from "@hocuspocus/server";
import jwt from "jsonwebtoken";

const host = process.env.HOCUSPOCUS_HOST?.trim() || "0.0.0.0";
const port = Number(process.env.HOCUSPOCUS_PORT || "1234");
const quiet = process.env.HOCUSPOCUS_QUIET === "true";
const collabAuthSecret = process.env.COLLAB_AUTH_SECRET?.trim() || "";

if (!collabAuthSecret) {
  throw new Error("COLLAB_AUTH_SECRET is required for Hocuspocus authentication");
}

const server = Server.configure({
  address: host,
  port,
  quiet,
  timeout: 5 * 60_000,
  debounce: 2_000,
  maxDebounce: 10_000,
  async onAuthenticate(data) {
    const decoded = jwt.verify(data.token, collabAuthSecret);

    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid collaboration token payload");
    }

    const scope = typeof decoded.scope === "string" ? decoded.scope : "";
    const yDocName = typeof decoded.yDocName === "string" ? decoded.yDocName : "";
    const docId = typeof decoded.docId === "string" ? decoded.docId : "";
    const userId = typeof decoded.sub === "string" ? decoded.sub : "";

    if (!userId || !docId || scope !== "collab:document") {
      throw new Error("Invalid collaboration token scope");
    }

    if (yDocName !== data.documentName) {
      throw new Error("Collaboration token is not valid for this document");
    }

    return {
      userId,
      docId,
      yDocName,
      scope
    };
  }
});

server.listen();

if (!quiet) {
  console.log(`[hocuspocus] listening on ws://${host}:${port}`);
}
