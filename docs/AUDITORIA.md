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

Pendiente (follow-up recomendado):
- **3.2 Harness de integración con DB real en CI**: requiere contenedor Postgres/Redis; no verificable en este entorno (sin daemon Docker). Hacer en sesión con CI ejecutable.
- **3.3 Paginación de `listMessages`** (historial de chat): requiere scroll infinito en el cliente (es feature, no parche) para no truncar historial silenciosamente.
- **4.1 Partir servicios monolíticos** (documents 2788, forms 1517, messaging 1423, tasks 1227 líneas): refactor grande que debe preservar comportamiento; hacerlo por servicio, incremental, subiendo antes la cobertura de `documents/service`.

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
- Pruebas unitarias con Prisma/app mockeados: **no hay pruebas de integración con DB real** ni e2e. Riesgo de regresiones en queries/migraciones no detectadas por unit tests.

**Mitigación:** subir cobertura en `tasks`, `auth`, `documents`; añadir suite de integración con Postgres efímero (testcontainers/servicio en CI) para los flujos RBAC y de proyecto (cubre además el hallazgo 1.1).

---

## 5. CI/CD e infraestructura

- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre lint+typecheck+test+audit+gates propios. **Falta un paso `pnpm build`**: typecheck no garantiza que el bundle de Next/build de la API compile.
- Tests en CI corren por-filtro secuencialmente; podrían paralelizarse o delegarse a `turbo run test` (cache).
- `AUTO_MIGRATE_ON_START=true` aplica `migrate deploy` en boot de la API: cómodo, pero arriesgado en despliegues multi-instancia (carreras de migración). Considerar job de migración dedicado.
- No se observa healthcheck/readiness diferenciado ni estrategia de rollback documentada para migraciones.

**Mitigación:** añadir `build` al pipeline; separar migraciones del arranque en producción; documentar rollback.

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
