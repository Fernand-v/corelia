# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Corelia is a monorepo for an intranet/project management platform. It uses **pnpm workspaces** (pnpm 9.12.3) and **Turborepo** to orchestrate four apps and three shared packages. Requires **Node ≥ 20**.

**Apps:**
- `apps/api` — Fastify 5 REST API (TypeScript, ESM)
- `apps/web` — Next.js 14 frontend (TypeScript, App Router)
- `apps/hocuspocus` — Collaborative document server (Hocuspocus/Y.js)
- `apps/workers` — BullMQ background job workers

**Packages:**
- `packages/types` — Shared Zod schemas and TypeScript types
- `packages/ui` — Shared UI component library
- `packages/config` — Shared ESLint/Prettier/TypeScript config

**Infrastructure (via Docker Compose):**
- PostgreSQL 16 (via Prisma ORM in `apps/api`)
- Redis 7 (caching + BullMQ queues)
- MinIO (S3-compatible file storage)
- Nginx (reverse proxy routing `/api/v1` → API, `/collab` → Hocuspocus, `/ws` → Socket.IO)
- Grafana Tempo + OpenTelemetry tracing

## Commands

All commands run from the repo root unless noted.

### Root-level (Turborepo)
```bash
pnpm dev          # Start all apps in parallel (watch mode)
pnpm build        # Build all apps (respects dependency order)
pnpm test         # Run all tests
pnpm lint         # Lint all apps
pnpm typecheck    # Type-check all apps
pnpm format       # Check formatting across all apps
```

### Per-app (use `--filter`)
```bash
pnpm --filter @corelia/api dev
pnpm --filter @corelia/web dev
pnpm --filter @corelia/hocuspocus dev
pnpm --filter @corelia/workers dev
```

### Running a single test file
```bash
# In apps/api
pnpm --filter @corelia/api exec vitest run src/test/auth.integration.spec.ts

# In apps/web
pnpm --filter @corelia/web exec vitest run components/announcement-content-state.spec.ts
```

### Database (Prisma — always run from root)
```bash
pnpm prisma:migrate:dev         # Create and apply a new migration
pnpm prisma:migrate:status      # Check migration status
pnpm prisma:generate            # Regenerate Prisma client after schema changes
```

### Docker
```bash
cd docker && docker compose up -d          # Start full stack
cd docker && docker compose -f docker-compose.staging.yml up -d
```

## Architecture

### API (`apps/api/src`)

The API follows a **plugin + module** pattern (ESM-only, `"type": "module"`):

- **`app.ts`** — Assembles the Fastify app: registers plugins, then mounts routers
- **`plugins/`** — Fastify plugins registered in dependency order: security → prisma → redis → storage → queues → auth → socket → media → rbac → maintenance → audit
- **`modules/<name>/`** — Each module has `router.ts` (Fastify route handlers), `service.ts` (business logic), `schema.ts` (Zod validation). Current modules: `status`, `auth`, `identity`, `projects`, `tasks`, `availability`, `time`, `messaging`, `notifications`, `announcements`, `forms`, `files`, `documents`, `search`, `decisions`, `automations`, `objectives`, `integrations`, `imports`, `audit`, `meetings`, `calendar`, `home`, `admin`, `reports`
- **`lib/`** — Stateless utilities: `rbac.ts` (role/permission definitions), `http.ts`, `tokens.ts`, `password.ts`, etc.
- **`config/env.ts`** — All env vars are validated with Zod at startup; the app exits if any required var is missing

**RBAC:** Six roles (`INVITADO_EXTERNO` → `OBSERVADOR` → `COLABORADOR` → `COORDINADOR_EQUIPO` → `LIDER_PROYECTO` → `ADMINISTRADOR`) with Spanish-named permissions defined in `lib/rbac.ts`. Routes declare `requiredPermission` in their route config; the `rbacPlugin` enforces it per-request. Within a project context, the user's project membership role is used; outside a project, their base role applies.

**Auth:** JWT access tokens (default 15 min) + opaque refresh tokens stored in Postgres. Protected endpoints require `Authorization: Bearer` plus RBAC permission checks.

**Realtime:** Socket.IO mounted at `/ws/socket.io`. mediasoup handles WebRTC video calls.

**Queues:** BullMQ with Redis. Workers are in `apps/workers`, not in the API process. The API enqueues jobs via `plugins/queues.ts`.

### Web (`apps/web`)

Next.js 14 App Router with route groups:
- `(auth)` — Login, invite activation (no auth required)
- `(dashboard)` — All authenticated views, wrapped in `app/(dashboard)/layout.tsx`
- `call/` — Video call room (standalone, outside dashboard layout)

**State and data fetching:**
- `lib/api.ts` — Central `apiRequest()` fetch wrapper; uses Zustand (`useAuthStore`) for access token stored in `localStorage`
- `lib/realtime.ts` — Singleton Socket.IO client
- `lib/hocuspocus.ts` — URL resolution for collaborative document WebSocket
- TanStack Query is used for server state; React Hook Form + Zod for forms

**Dev URL resolution:** When running `next dev` on port 3000 without nginx, `lib/api.ts` auto-routes API calls to `:4000` and `lib/realtime.ts` auto-routes Socket.IO to `:4000`. Hocuspocus falls back to `:1234`. This means the full stack can be developed locally without Docker.

### Collaborative Documents (`apps/hocuspocus`)

Simple Hocuspocus server (`server.js`) that broadcasts Y.js CRDT updates. The web app connects via `@hocuspocus/provider`. Documents support multiple editor types: rich text (Tiptap), spreadsheet (AG Grid + HyperFormula), diagram (maxGraph/ReactFlow), whiteboard (tldraw/Excalidraw).

### Workers (`apps/workers/src/jobs`)

- `notification.worker.ts` — Sends email notifications via nodemailer
- `webhook.worker.ts` — Sends outbound webhooks (Slack, Teams)
- `automation.worker.ts` — Processes project automations + task lifecycle scheduler
- `documents-purge.worker.ts` — Periodically purges orphaned collaborative document data

## Key Conventions

- All API modules follow the same file structure: `router.ts` / `service.ts` / `schema.ts`
- Routes that don't require authentication set `config: { requiresAuth: false }` in route options
- API errors use `ValidationError` name for 400 responses; all others return 500
- The `@corelia/types` package is the single source of truth for shared types — both API and web import from it
- Prisma schema lives at `apps/api/prisma/schema.prisma`; `AUTO_MIGRATE_ON_START=true` runs `prisma migrate deploy` on API boot
- Tests use Vitest with mocked Prisma/app instances (no real DB required for unit tests)
- API test files live in `apps/api/src/test/**/*.spec.ts`; web tests match `**/*.spec.ts`
- API coverage thresholds: 70% lines/statements/functions, 60% branches
- The Prisma schema uses Spanish enum values throughout (e.g., `PENDIENTE`, `COMPLETADA`, `VACACIONES`)
- Turbo caches `build`, `test`, `typecheck`; `dev` and `format` are not cached
