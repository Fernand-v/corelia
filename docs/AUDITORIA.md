# Auditoría técnica de Corelia

> Fecha: 2026-06-19 · Alcance: monorepo completo (apps/api, apps/web, apps/workers, apps/hocuspocus, packages/*)
> Método: revisión estática de código, configuración, seguridad, rendimiento y pruebas. No se ejecutó pentest dinámico.

## Estado de implementación (2026-06-19)

Corregido en esta tanda (ver historial git):
- **CI desbloqueado**: `prisma generate` en postinstall + build de paquetes compartidos antes de los gates, Node 22, paso `build` en el pipeline, 4 warnings de hooks React.
- **[ALTA] Escalada entre proyectos**: el RBAC ahora resuelve `projectId` desde el body (no solo header/query), con tests.
- **[ALTA] Refresh token** en cookie httpOnly en vez de `localStorage`.
- **[MEDIA] Login**: lockout por cuenta (5 fallos) + rate limit 10→5/min.
- **[MEDIA] Cache RBAC** usuario/membresía en Redis (TTL 30s + invalidación).
- **[BAJA]** Code-splitting de editores Excalidraw/maxGraph; gate extendido a `as any`; `DISTINCT ON` para último mensaje por canal.
- **Docs**: guía de migraciones multi-instancia + rollback.

Hecho después:
- **3.3 Paginación de `listMessages`**: implementada con cursor (`before`/`limit`) en el backend (`DISTINCT`/`take+1`, devuelve `{messages, hasMore, nextCursor}`) y `useInfiniteQuery` + botón "Cargar mensajes anteriores" en el cliente, con auto-scroll que no salta al prepender historial.
- **4.1 (helpers puros)**: extraídos a `*-helpers.ts` en forms/messaging/documents/tasks con tests propios.

Hecho después (4.1 sub-services DB-bound):
Resuelto el acoplamiento con **inyección de dependencias**: cada sub-service recibe `app` y los métodos compartidos del parent que necesita (p. ej. `getDocumentForUser`, `saveVersion`, `getChannelForMember`), y el servicio principal delega o usa el sub-service. Extraídos:
- `DocumentCollabService` (sesiones colab de diagramas) y `DocumentOnlyOfficeService` (integración ONLYOFFICE) → **documents/service 2652 → 1586**.
- `MessageReceiptsService` (recibos entregado/leído) → **messaging/service 1336 → 1253**.
- `TaskOperationsService` (encolado webhooks/automatizaciones, validaciones de alcance/disponibilidad) → **tasks/service 1246 → 1063**.
- `FormRequestsService` (solicitudes legacy VACACIONES/PERMISO) → **forms/service 1215 → 1092**.
Cada uno con su spec de smoke tests. Comportamiento preservado (move verbatim + verificado con typecheck/lint/build/integration specs).

Cobertura ampliada de los sub-services de documents (ya no solo smoke):
- `DocumentOnlyOfficeService`: 2 → **24 tests** (config con/sin JWT secret y `canEdit`, contenido de archivo y validación de token, callback con todos los estados 2/3/6/7 + descarga fallida + sin URL, forcesave con fallback de endpoint, error 0/4/otros y firma de comando).
- `DocumentCollabService`: 2 → **18 tests** (state vacío/poblado/cierre por inactividad, join nuevo/reuso/RECONNECT, heartbeat, snapshot nuevo/dedupe/límites/sin storage, leave con y sin participante online).

**3.2 Harness de integración con DB real** — **[RESUELTO]**. Suite separada `*.dbtest.spec.ts` (vitest.db.config.ts) contra Postgres efímero:
- Local: `pnpm test:db` levanta `docker/docker-compose.test.yml` (Postgres en tmpfs, puerto 5433), aplica migraciones (globalSetup) y corre la suite; teardown automático.
- CI: job `integration-db` con service container Postgres.
- `src/test/db/`: cliente Prisma dedicado (`TEST_DATABASE_URL`) + `resetDatabase()` (TRUNCATE) + `FakeRedis` en memoria.
- Cobertura inicial: rotación/revocación/expiración de refresh tokens (AuthService.refresh) y resolución de rol RBAC por proyecto sin fuga cross-proyecto + caché/invalidación (valida §2.1). 6 tests verdes.

**E2E de collab con Playwright** — **[RESUELTO]**. Suite en `apps/web/e2e/*.e2e.ts` (`pnpm --filter @corelia/web test:e2e`, job `e2e-collab` en CI):
- Self-contained: Playwright levanta el servidor Hocuspocus + un servidor estático del fixture (sin Next, sin API, sin DB). El cliente del harness se bundlea con esbuild (yjs + @hocuspocus/provider) y expone `collabConnect/Insert/Get` en `window`.
- Valida en Chromium real: dos contextos sincronizan ediciones Y.js bidireccionalmente vía Hocuspocus, y un token con scope inválido es rechazado por `onAuthenticate`. 2 tests verdes.

## Resumen ejecutivo

Corelia es una plataforma madura y bien estructurada: patrón plugin+módulo consistente en la API, RBAC granular, validación Zod de entorno y de payloads, 236 índices en 88 modelos Prisma, y pipeline CI con gates de calidad propios (unsafe-casts, PUML, audit). Las debilidades principales no son estructurales sino de **endurecimiento**: un posible vector de escalada de privilegios entre proyectos, almacenamiento de tokens en `localStorage`, cobertura de pruebas desigual, y varios cuellos de botella de rendimiento por consultas por-request y servicios monolíticos.

Prioridades recomendadas (orden):
1. **[ALTA]** Cerrar divergencia `x-project-id` (header) vs `projectId` (body) en RBAC.
2. **[ALTA]** Mover refresh token a cookie `httpOnly`; reducir TTL/lockout en login.
3. **[MEDIA]** Cachear contexto usuario→rol por-request; partir servicios gigantes.
4. **[MEDIA]** Subir cobertura de pruebas en módulos críticos y añadir `build` + tests de integración con DB real en CI.

---

## 1. Seguridad

### 1.1 [ALTA] Escalada de privilegios entre proyectos vía `x-project-id`
El plugin RBAC ([plugins/rbac.ts:182](apps/api/src/plugins/rbac.ts#L182)) deriva el rol activo del proyecto leyendo `x-project-id` de **header o query** ([lib/http.ts](apps/api/src/lib/http.ts)). Pero los servicios operan sobre el `projectId` que viene en el **body**. Ejemplo en [tasks/service.ts:483](apps/api/src/modules/tasks/service.ts#L483) (`createTask`): usa `input.projectId` y solo valida que `stage.projectId === input.projectId`, sin reconfirmar la membresía del actor en `input.projectId`.

**Riesgo:** un usuario que es `LIDER_PROYECTO` en el proyecto Y puede enviar `x-project-id: Y` (pasa el permiso `TAREA_GESTIONAR`) mientras el body apunta a `projectId: X`, creando/mutando recursos en X donde solo debería ser `OBSERVADOR`/no-miembro.

**Mitigación:** en cada handler de recurso de proyecto, exigir que `request.accessContext.projectId === <projectId del recurso>` o re-verificar membresía server-side sobre el `projectId` efectivo del recurso. Centralizarlo (helper `assertProjectScope`).

### 1.2 [ALTA] Tokens en `localStorage` (access + refresh)
[lib/api.ts:23-83](apps/web/lib/api.ts#L23) guarda tanto el access token como el **refresh token (TTL 30 días)** en `localStorage`. Cualquier XSS roba un token de larga vida.

**Mitigación:** refresh token en cookie `httpOnly`+`Secure`+`SameSite`; mantener solo el access token de 15 min en memoria/JS. Endurecer la CSP (hoy `scriptSrc: 'self'`, bien, pero revisar inyección de terceros de editores).

### 1.3 [MEDIA] Fuerza bruta en login
[auth/router.ts](apps/api/src/modules/auth/router.ts) limita login a **10/min por IP**. Detrás de proxy/NAT, o con IP rotada, es generoso. No hay bloqueo por cuenta.

**Mitigación:** bajar a ~5/min, añadir backoff/lockout por cuenta y métricas de intentos fallidos.

### 1.4 Aspectos correctos (confirmados)
- Contraseñas con `bcryptjs`, 12 rounds ([lib/password.ts](apps/api/src/lib/password.ts)).
- Refresh tokens opacos `randomBytes(48)` y hash SHA-256 en Postgres ([lib/tokens.ts](apps/api/src/lib/tokens.ts)).
- Revocación de access tokens vía blacklist Redis tras logout ([plugins/auth.ts](apps/api/src/plugins/auth.ts)).
- CORS con matcher por patrón + validación anti-spoofing de `x-forwarded-for`, helmet con HSTS/CSP/`X-Frame-Options: deny` ([plugins/security.ts](apps/api/src/plugins/security.ts)).
- Validación Zod de **todas** las env vars al arranque ([config/env.ts](apps/api/src/config/env.ts)); secretos con longitud mínima.
- Manejo de errores que no filtra detalles en 5xx ([app.ts:51](apps/api/src/app.ts#L51)).
- `pnpm security:audit` (high+critical) en CI.

---

## 2. Rendimiento y cuellos de botella

### 2.1 [MEDIA] Consultas por-request en RBAC
[plugins/rbac.ts:184-219](apps/api/src/plugins/rbac.ts#L184): cada request autenticado hace `user.findUnique` y, si hay proyecto, `projectMember.findFirst` contra Postgres. El **rol** sí se cachea en Redis, pero el lookup usuario→rol y membresía no. En endpoints calientes esto es 1-2 viajes a DB por request.

**Mitigación:** cachear `userId → {baseRoleId, baseRoleKey}` y membresías por proyecto en Redis con invalidación por evento.

### 2.2 [MEDIA] Servicios monolíticos
Archivos enormes que concentran lógica y dificultan mantenimiento/test:
- [documents/service.ts](apps/api/src/modules/documents/service.ts) — **2788 líneas**
- [forms/service.ts](apps/api/src/modules/forms/service.ts) — 1517
- [messaging/service.ts](apps/api/src/modules/messaging/service.ts) — 1423
- [admin/router.ts](apps/api/src/modules/admin/router.ts) — 1279
- [tasks/service.ts](apps/api/src/modules/tasks/service.ts) — 1227

**Mitigación:** dividir por subdominio (como ya se hizo en `admin/services/*`). Reduce superficie de bugs y mejora foco de pruebas.

### 2.3 [BAJA] Paginación
209 usos de `findMany` en la API. Revisar que los listados de cara a usuario (mensajes, tareas, auditoría, documentos) tengan `take`/cursor obligatorio para evitar respuestas no acotadas.

### 2.4 [BAJA] Peso del frontend
Editores pesados (`@excalidraw/excalidraw`, `@maxgraph/core`, Tiptap, AG Grid) y 44 componentes `"use client"`. Verificar que todos se cargan con `dynamic(import, { ssr:false })` y code-splitting para no inflar el bundle inicial del dashboard.

---

## 3. Calidad de código y deuda técnica

- **0** marcadores `TODO/FIXME/HACK` en código (buena higiene).
- **18** `as any` en api+web (fuera de tests). Concentrar/eliminar; ya existe gate `security:check-unsafe-casts` para `as unknown as`/`as never` con allowlist — extender criterio a `as any`.
- Recién saneado: 192 `no-useless-catch` eliminados y unused vars; config ESLint ahora ignora prefijo `^_`. Mantener lint en verde como gate duro.
- `apps/web` usa config ESLint propia (Next) sin el plugin `@typescript-eslint`; por eso convivían directivas `eslint-disable` muertas. Considerar unificar reglas TS también en web.
- 1 solo `console.*` en api (resto usa logger Fastify). Correcto.

---

## 4. Pruebas

| Paquete | Specs | Fuentes (no test) | Ratio aprox. |
|---|---|---|---|
| api | 24 | 136 | ~18% archivos |
| web | 16 | 56 componentes | ~29% componentes |
| workers | 4 | — | bajo |

- Umbral de cobertura api: 70% líneas/funcs, 60% ramas (definido en config). Actual ≈ **77% líneas** global, pero módulos críticos por debajo: `tasks/service` 66%, `auth/service` 75%.
- Pruebas unitarias con Prisma/app mockeados. **[RESUELTO]** Ya hay suite de integración con DB real (`*.dbtest.spec.ts`, `pnpm test:db`, job `integration-db` en CI) — ver §4.1/3.2. Queda pendiente e2e de navegador (Playwright).

**Mitigación:** subir cobertura en `tasks`, `auth`, `documents`; suite de integración con Postgres efímero (servicio en CI) para los flujos RBAC y de proyecto **[hecho, 3.2]** (cubre además el hallazgo 1.1).

---

## 5. CI/CD e infraestructura

- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre lint+typecheck+test+audit+gates propios. **Falta un paso `pnpm build`**: typecheck no garantiza que el bundle de Next/build de la API compile.
- Tests en CI corren por-filtro secuencialmente; podrían paralelizarse o delegarse a `turbo run test` (cache).
- `AUTO_MIGRATE_ON_START=true` aplica `migrate deploy` en boot de la API: cómodo, pero arriesgado en despliegues multi-instancia (carreras de migración). Considerar job de migración dedicado. **[RESUELTO 4.2]**
- No se observa healthcheck/readiness diferenciado ni estrategia de rollback documentada para migraciones. **[Rollback documentado en docker/README.md]**

**Mitigación:** añadir `build` al pipeline; separar migraciones del arranque en producción; documentar rollback.

**Estado:** `build` en pipeline ✅ (Fase 1). Migraciones separadas del arranque ✅ (Fase 4.2): servicio one-shot `migrate` en docker-compose corre `prisma migrate deploy` antes de la API; `AUTO_MIGRATE_ON_START` por defecto `false` en compose/prod (`true` sólo en dev local de una instancia). Rollback documentado en [docker/README.md](../docker/README.md).

---

## 6. Acciones priorizadas

| # | Severidad | Acción | Esfuerzo |
|---|---|---|---|
| 1 | ALTA | Validar `accessContext.projectId` == projectId del recurso (helper central) | M |
| 2 | ALTA | Refresh token a cookie `httpOnly`; access token solo en memoria | M |
| 3 | MEDIA | Lockout/backoff + bajar rate limit en login | S |
| 4 | MEDIA | Cachear usuario→rol y membresías en RBAC | M |
| 5 | MEDIA | Añadir `pnpm build` y tests de integración con DB real en CI | M |
| 6 | MEDIA | Partir servicios >1000 líneas por subdominio | L |
| 7 | BAJA | Auditar paginación en `findMany` de cara a usuario | M |
| 8 | BAJA | Code-splitting de editores pesados en web | S |
| 9 | BAJA | Extender gate de casts a `as any` | S |

> Esfuerzo: S (<1d), M (1-3d), L (>3d).

---

# Re-auditoría de seguridad (2026-06-24)

> Revisión estática del estado actual tras cerrar Fases 2.x/3.x/4.x. `pnpm audit --prod --audit-level=moderate` = **sin vulnerabilidades conocidas**.

## Resuelto desde la auditoría original
- **2.1** Escalada cross-proyecto → precedencia de `projectId` del body en RBAC ✅
- **2.2** Refresh token → cookie `httpOnly` + `sameSite:strict` ✅
- **2.3** Endurecer login → rate limit 5/min + lockout por intentos ✅
- **3.1** Caché RBAC usuario/rol en Redis (TTL + invalidación) ✅
- **3.2** Tests de integración con DB real (`*.dbtest.spec.ts`, CI) ✅
- **4.2** Migraciones en paso dedicado (no en boot) ✅
- **§5** `pnpm build` + Node 22 en CI ✅

## Base sólida (verificado)
- `@fastify/helmet`: CSP (`default/script/style-src 'self'`, `img 'self' data:`), HSTS preload, `X-Frame-Options: deny`, `nosniff`.
- CORS con allowlist + matcher de comodines; `credentials:true`; private-network gateado por env.
- Rate limit global 300/min, key por `x-forwarded-for` validado con fallback a `request.ip`.
- Contraseñas con `bcryptjs`; secretos validados con longitud mínima en `config/env.ts`.
- Prisma parametrizado — **sin `$queryRawUnsafe`/`$executeRawUnsafe` en runtime**.
- Subida de archivos: allowlist de MIME + extensiones peligrosas bloqueadas + `Content-Disposition: attachment` por defecto + `nosniff`.
- Endpoints públicos acotados (status, auth, y descargas con token firmado en documents/announcements).

## Hallazgos pendientes (nuevos / no abordados)

| # | Severidad | Hallazgo | Detalle / fix |
|---|-----------|----------|---------------|
| R1 | MEDIA | **`/metrics` sin secreto** ([plugins/metrics.ts:55](../apps/api/src/plugins/metrics.ts#L55)) | Si `METRICS_SECRET` no está definido, sólo se restringe por IP local. Detrás de nginx en el mismo host, `request.ip` puede resolver a local y exponer métricas. **Fix:** exigir `METRICS_SECRET` en producción (default-deny) o validar por XFF. |
| R2 | MEDIA-BAJA | **SSRF en callback OnlyOffice** ([document-onlyoffice-service.ts:321](../apps/api/src/modules/documents/document-onlyoffice-service.ts#L321)) | `fetch(input.body.url)` descarga una URL del body. Mitigado por token de callback firmado, pero la URL no se valida contra el host de OnlyOffice. **Fix:** allowlist de host (`ONLYOFFICE_*_URL`). |
| R3 | BAJA | **SVG inline servible** ([files/router.ts:190](../apps/api/src/modules/files/router.ts#L190)) | `mode=inline` + `image/` en allowlist permite servir SVG inline (XSS potencial). Mitigado por CSP `script-src 'self'` + `nosniff`. **Fix:** forzar `attachment` para `image/svg+xml` o sanitizar. |
| R4 | BAJA | **Hash de contraseña** | `bcryptjs` (JS puro) es funcional; `argon2id` o `bcrypt` nativo dan mayor coste/calidad. Opcional. |
| R5 | INFO | **`JWT_REFRESH_SECRET` sin uso real** | Los refresh tokens son opacos en DB (no JWT), así que el secreto es legacy/inofensivo. Limpiar para evitar confusión. |
| R6 | INFO | **Trust proxy** | El rate limit confía en el primer IP de `x-forwarded-for`; correcto detrás de nginx. Si la API se expone directa, es spoofeable — documentar/forzar despliegue tras proxy. |
| R7 | BAJA | **Gate `as any`** (§3.5 original) | Aún no se extendió el gate de casts inseguros a `as any`. |

## Recomendación de prioridad
1. **R1** (exigir `METRICS_SECRET` en prod) — rápido, cierra exposición de métricas.
2. **R2** (allowlist de host en callback OnlyOffice) — defensa en profundidad SSRF.
3. **R3** (attachment forzado para SVG) — cierra XSS residual.

## Estado de remediación (2026-06-24)

Todos los hallazgos atendidos:

- **R1 ✅** `/metrics` con default-deny en producción si falta `METRICS_SECRET`; comparación del bearer en tiempo constante ([plugins/metrics.ts](../apps/api/src/plugins/metrics.ts)).
- **R2 ✅** Allowlist de host en el callback de OnlyOffice antes del `fetch` (deriva los hosts de `ONLYOFFICE_INTERNAL_URL`/`ONLYOFFICE_DOCUMENT_SERVER_URL`); + tests SSRF.
- **R3 ✅** Se fuerza `Content-Disposition: attachment` para `svg/html/xml` aunque se pida inline ([files/router.ts](../apps/api/src/modules/files/router.ts)).
- **R4 ✅** Hash con **argon2id** (`@node-rs/argon2`, prebuilt) con verificación dual para hashes bcrypt heredados ([lib/password.ts](../apps/api/src/lib/password.ts)).
- **R5 ✅** Eliminado `JWT_REFRESH_SECRET` legacy (refresh es opaco en DB) de env, `.env.example`, compose y docs.
- **R6 ✅** `trustProxy` configurable vía `TRUST_PROXY` (default `true`) y documentado que la API va tras proxy de confianza ([app.ts](../apps/api/src/app.ts)).
- **R7 ✅** El gate `security:check-unsafe-casts` ya cubre `as any` (además de `as never`/`as unknown as`) con baseline; bloquea nuevos casts inseguros.

