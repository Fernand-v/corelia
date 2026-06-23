// Servidor estático mínimo para los fixtures del harness de colaboración.
// Sirve e2e/fixtures (HTML + bundle). Lo arranca Playwright como webServer.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "fixtures");
const port = Number(process.env.STATIC_PORT || "4173");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = (req.url || "/").split("?")[0];
    const rel = normalize(urlPath === "/" ? "/collab.html" : urlPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(root, rel);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

server.listen(port, () => {
  console.log(`[e2e-static] serving ${root} on http://127.0.0.1:${port}`);
});
