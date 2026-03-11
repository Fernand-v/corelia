#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const APP_FILE = path.join(ROOT_DIR, "apps/api/src/app.ts");
const API_BASE = process.env.API_BASE ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.AUDIT_ADMIN_EMAIL ?? "admin@corelia.local";
const ADMIN_PASSWORD = process.env.AUDIT_ADMIN_PASSWORD ?? "Admin123!@#";
const OUTPUT_JSON =
  process.env.AUDIT_OUTPUT_JSON ?? path.join(ROOT_DIR, "docs/api-audit-results.json");
const TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS ?? 15000);

const DUMMY_UUID = "11111111-1111-4111-8111-111111111111";
const DUMMY_DOMAIN = "PROJECT_DESCRIPTION";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBaseUrl = (value) => value.replace(/\/+$/, "");

const joinPaths = (prefix, routePath) =>
  `${prefix.replace(/\/$/, "")}/${routePath.replace(/^\//, "")}`.replace(/\/+/g, "/");

const parseRoutes = () => {
  const appSource = fs.readFileSync(APP_FILE, "utf8");
  const importRegex = /import\s*\{\s*(\w+)\s*\}\s*from\s*"(\.\/modules\/[^"]+)";/g;
  const registerRegex =
    /await\s+app\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*"([^"]+)"\s*\}\s*\);/g;
  const routeRegex = /app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;

  const routerToImport = new Map();
  for (const match of appSource.matchAll(importRegex)) {
    routerToImport.set(match[1], match[2]);
  }

  /** @type {Array<{ method: string; path: string; source: string }>} */
  const routes = [];
  for (const match of appSource.matchAll(registerRegex)) {
    const routerName = match[1];
    const prefix = match[2];
    const moduleImport = routerToImport.get(routerName);
    if (!moduleImport) {
      continue;
    }

    const importWithoutJs = moduleImport.replace(/\.js$/, "");
    const routerFile = path.join(ROOT_DIR, "apps/api/src", `${importWithoutJs.replace("./", "")}.ts`);
    const routerSource = fs.readFileSync(routerFile, "utf8");
    for (const route of routerSource.matchAll(routeRegex)) {
      routes.push({
        method: route[1].toUpperCase(),
        path: joinPaths(prefix, route[2]),
        source: path.relative(ROOT_DIR, routerFile)
      });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return routes;
};

const placeholderForParam = (param) => {
  const lower = param.toLowerCase();
  if (lower === "domain") {
    return DUMMY_DOMAIN;
  }
  if (lower.endsWith("id") || lower === "id") {
    return DUMMY_UUID;
  }
  if (lower.includes("slug")) {
    return "audit-slug";
  }
  return "audit";
};

const fillPathParams = (routePath) =>
  routePath.replace(/:([A-Za-z0-9_]+)/g, (_full, param) => placeholderForParam(param));

const needsPublicAuthBypass = (method, routePath) => {
  if (routePath.startsWith("/status")) {
    return true;
  }
  if (!routePath.startsWith("/api/v1/auth/")) {
    return false;
  }
  const publicAuth = new Set([
    "POST /api/v1/auth/login",
    "POST /api/v1/auth/refresh",
    "POST /api/v1/auth/register",
    "POST /api/v1/auth/register-request",
    "POST /api/v1/auth/activate-invite"
  ]);
  return publicAuth.has(`${method} ${routePath}`);
};

const buildBody = (method, routePath, state) => {
  const key = `${method} ${routePath}`;
  if (key === "POST /api/v1/auth/login") {
    return {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    };
  }
  if (key === "POST /api/v1/auth/refresh") {
    return {
      refreshToken:
        state.refreshToken ??
        "R".repeat(40)
    };
  }
  if (key === "POST /api/v1/auth/logout") {
    return {
      refreshToken:
        state.refreshToken ??
        "R".repeat(40)
    };
  }
  if (key === "POST /api/v1/auth/register-request") {
    return {
      email: `audit-${Date.now()}@corelia.local`,
      firstName: "Audit",
      lastName: "Runner",
      message: "Solicitud de auditoria automatizada"
    };
  }
  if (key === "POST /api/v1/auth/register") {
    return {
      email: `deprecated-${Date.now()}@corelia.local`,
      firstName: "Deprecated",
      lastName: "Flow",
      password: "Password123!"
    };
  }
  if (key === "PUT /status/maintenance") {
    return {
      enabled: false,
      message: "Maintenance disabled by API smoke audit"
    };
  }

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return {};
  }
  return null;
};

const classifyStatus = (status) => {
  if (status >= 500) return "error";
  if (status >= 400) return "client_error";
  if (status >= 300) return "redirect";
  return "success";
};

const doRequest = async (method, url, headers, body) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: true,
      status: response.status,
      body: text
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
};

const loginAdmin = async () => {
  const loginUrl = `${normalizeBaseUrl(API_BASE)}/api/v1/auth/login`;
  const response = await doRequest(
    "POST",
    loginUrl,
    {
      "content-type": "application/json"
    },
    JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  );

  if (!response.ok || response.status !== 200) {
    throw new Error(
      `No se pudo autenticar admin (${response.status}): ${response.body || "sin detalle"}`
    );
  }

  const parsed = JSON.parse(response.body || "{}");
  if (!parsed.accessToken) {
    throw new Error("Login no devolvio accessToken");
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken ?? null,
    userId: parsed.userId ?? null
  };
};

const run = async () => {
  const startedAt = new Date().toISOString();
  const routes = parseRoutes();
  const auth = await loginAdmin();
  const state = {
    refreshToken: auth.refreshToken
  };

  /** @type {Array<{
   * method: string;
   * routePath: string;
   * resolvedPath: string;
   * source: string;
   * status: number;
   * class: string;
   * error: boolean;
   * bodyPreview: string;
   * authMode: string;
   * }>} */
  const results = [];

  for (const route of routes) {
    const resolvedPath = fillPathParams(route.path);
    const url = `${normalizeBaseUrl(API_BASE)}${resolvedPath}`;
    const bodyObject = buildBody(route.method, route.path, state);
    const headers = {};
    let body = undefined;

    if (!needsPublicAuthBypass(route.method, route.path)) {
      headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    if (bodyObject !== null) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(bodyObject);
    }

    const response = await doRequest(route.method, url, headers, body);
    const statusClass = classifyStatus(response.status);
    results.push({
      method: route.method,
      routePath: route.path,
      resolvedPath,
      source: route.source,
      status: response.status,
      class: statusClass,
      error: !response.ok || statusClass === "error",
      bodyPreview: response.body.slice(0, 400),
      authMode: needsPublicAuthBypass(route.method, route.path) ? "public" : "bearer"
    });

    if (route.method === "POST" && route.path === "/api/v1/auth/login") {
      try {
        const payload = JSON.parse(response.body || "{}");
        if (payload.refreshToken) {
          state.refreshToken = payload.refreshToken;
        }
      } catch {
        // ignore parse errors in smoke mode
      }
    }

    await sleep(10);
  }

  const byClass = results.reduce(
    (acc, item) => {
      acc[item.class] = (acc[item.class] ?? 0) + 1;
      return acc;
    },
    /** @type {Record<string, number>} */ ({})
  );
  const failures = results.filter((item) => item.error);

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    apiBase: normalizeBaseUrl(API_BASE),
    totalRoutes: routes.length,
    classSummary: byClass,
    failures: failures.length,
    failedRoutes: failures,
    results
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2));

  console.log(`Auditoria completada: ${routes.length} rutas revisadas`);
  console.log(`Resumen: ${JSON.stringify(byClass)}`);
  console.log(`Fallos (5xx/network): ${failures.length}`);
  console.log(`Reporte: ${path.relative(ROOT_DIR, OUTPUT_JSON)}`);

  if (failures.length > 0) {
    process.exitCode = 2;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
