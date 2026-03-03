import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const cwd = process.cwd();

const resolvePeersCallerEntrypoint = () => {
  const candidateBasePaths = [path.join(cwd, "apps", "web"), cwd];

  for (const basePath of candidateBasePaths) {
    const packageJsonPath = path.join(basePath, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const req = createRequire(packageJsonPath);
      return req.resolve("@sawport/peers-caller");
    } catch {
      // Intentamos el siguiente candidate.
    }
  }

  return null;
};

const peersCallerEntrypoint = resolvePeersCallerEntrypoint();
if (!peersCallerEntrypoint) {
  console.log("[verify:peers-caller-patch] @sawport/peers-caller no está instalado, se omite validación.");
  process.exit(0);
}

const distDir = path.dirname(peersCallerEntrypoint);

const checks = [
  {
    file: "peers-caller.es.js",
    processVar: "wt",
    processAssignPattern: /globalThis\.process\s*=\s*wt/,
    requiredPatterns: [
      /peer not initialized or destroyed/,
      /this\.peerConnections\.delete\(e\), this\.remoteStreams\.delete\(e\)/,
      /l \|\| this\.peer\.addStream\(e\)/
    ]
  },
  {
    file: "peers-caller.umd.js",
    processVar: "gt",
    processAssignPattern: /globalThis\.process\s*=\s*gt/
  }
];

const failures = [];

for (const check of checks) {
  const filePath = path.join(distDir, check.file);
  if (!existsSync(filePath)) {
    failures.push(`${check.file}: archivo no encontrado`);
    continue;
  }

  const content = readFileSync(filePath, "utf8");

  if (/var n\s*=\s*\{\s*env\s*:\s*\{\s*\}\s*\}/.test(content)) {
    failures.push(`${check.file}: contiene "var n = { env: {} }"`);
  }

  if (/\be\.nextTick\(/.test(content)) {
    failures.push(`${check.file}: contiene "e.nextTick("`);
  }

  if (!new RegExp(`${check.processVar}\\.nextTick\\(`).test(content)) {
    failures.push(`${check.file}: no contiene "${check.processVar}.nextTick("`);
  }

  if (!check.processAssignPattern.test(content)) {
    failures.push(`${check.file}: no asigna globalThis.process al shim`);
  }

  for (const pattern of check.requiredPatterns ?? []) {
    if (!pattern.test(content)) {
      failures.push(`${check.file}: falta patrón requerido ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("[verify:peers-caller-patch] Falló la validación del patch:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("[verify:peers-caller-patch] Patch validado correctamente.");
