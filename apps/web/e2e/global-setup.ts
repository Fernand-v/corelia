import { build } from "esbuild";
import { resolve } from "node:path";

// Compila el cliente del harness (collab-client.ts + yjs + @hocuspocus/provider)
// a un bundle IIFE servible al navegador, antes de que corran los tests.
// cwd es apps/web (se ejecuta vía `pnpm --filter @corelia/web test:e2e`).
export default async function globalSetup() {
  await build({
    entryPoints: [resolve(process.cwd(), "e2e/fixtures/collab-client.ts")],
    outfile: resolve(process.cwd(), "e2e/fixtures/collab.bundle.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    logLevel: "silent"
  });
}
