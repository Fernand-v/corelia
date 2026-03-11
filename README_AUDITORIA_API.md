# Auditoría API - Modularización + 3FN

Fecha de ejecución: 2026-03-10  
Repositorio: `Corelia`

## Alcance

- Verificación de arranque real en Docker (`postgres`, `redis`, `minio`, `api`, `web`, `workers`, `hocuspocus`, `nginx`).
- Revalidación de compilación y calidad por paquete (`typecheck`, `lint`, `test`).
- Auditoría de endpoints API con barrido automatizado de rutas registradas.
- Corrección de fallos detectados y re-ejecución hasta quedar sin errores de servidor.

## Resumen Ejecutivo

- Rutas auditadas: `193`
- Fallos `5xx` iniciales: `24`
- Fallos `5xx` finales: `0`
- Estado final: `OK` (sin errores de servidor en barrido de rutas)

Evidencia técnica:
- Reporte de auditoría de rutas: [docs/api-audit-results.json](/home/informatica3/Escritorio/Github/Corelia/docs/api-audit-results.json)

## Hallazgos Principales y Correcciones

1. Manejo global de errores no aplicado a todos los routers por orden de registro (Fastify encapsulation).
- Síntoma: validaciones fallando como `500` en vez de `400`.
- Impacto: múltiples endpoints devolvían `Internal Server Error` ante input inválido.
- Corrección:
  - Se movió el `app.setErrorHandler(...)` al inicio del bootstrap de app.
  - Se mejoró mapeo de errores:
    - validación (`ValidationError`, `ZodError`, `validation`) -> `400`
    - Prisma `P2025` -> `404`
    - Prisma `P2002` y `Conflict` -> `409`
- Archivo:
  - [apps/api/src/app.ts](/home/informatica3/Escritorio/Github/Corelia/apps/api/src/app.ts)

2. Script de preflight desalineado con cambios 3FN.
- Síntoma: preflight fallaba validando columnas antiguas.
- Corrección:
  - `Project.descriptionCode` -> `Project.descriptionCatalogId`
  - `TaskScheduleHistory.reasonCode` -> `TaskScheduleHistory.reasonCatalogId`
- Archivo:
  - [scripts/preflight-docker.sh](/home/informatica3/Escritorio/Github/Corelia/scripts/preflight-docker.sh)

3. Necesidad de auditoría repetible por rutas.
- Implementación:
  - Nuevo script de smoke audit que:
    - descubre rutas desde `app.ts` + routers,
    - autentica con admin,
    - recorre endpoints y marca fallos reales (`5xx`/network),
    - genera reporte JSON estructurado.
- Archivo:
  - [scripts/audit-api-smoke.mjs](/home/informatica3/Escritorio/Github/Corelia/scripts/audit-api-smoke.mjs)

## Resultado de la Auditoría por Rutas

Primera ejecución:
- `success`: 48
- `client_error`: 121
- `error`: 24

Segunda ejecución (tras fix):
- `success`: 48
- `client_error`: 145
- `error`: 0

Nota: la clase `client_error` es esperable en un smoke genérico para endpoints con payload/query obligatorios cuando se prueba input mínimo.

## Validación de Build y Calidad

Ejecutado y en verde:

- API:
  - `corepack pnpm --filter @corelia/api typecheck`
  - `corepack pnpm --filter @corelia/api lint`
  - `corepack pnpm --filter @corelia/api test`
- Web:
  - `corepack pnpm --filter @corelia/web typecheck`
  - `corepack pnpm --filter @corelia/web lint`
  - `corepack pnpm --filter @corelia/web test`
- Workers:
  - `corepack pnpm --filter @corelia/workers typecheck`
  - `corepack pnpm --filter @corelia/workers lint`
  - `corepack pnpm --filter @corelia/workers test`
- Types:
  - `corepack pnpm --filter @corelia/types typecheck`
  - `corepack pnpm --filter @corelia/types lint`
  - `corepack pnpm --filter @corelia/types test`
- UI:
  - `corepack pnpm --filter @corelia/ui typecheck`
  - `corepack pnpm --filter @corelia/ui lint`
  - `corepack pnpm --filter @corelia/ui test`
- Hocuspocus:
  - `corepack pnpm --filter @corelia/hocuspocus typecheck`
  - `corepack pnpm --filter @corelia/hocuspocus lint`
  - `corepack pnpm --filter @corelia/hocuspocus test`

## Ejecución Repetible

1. Levantar stack:
```bash
docker compose --env-file .env.audit -f docker/docker-compose.yml up -d --build
```

2. Correr preflight:
```bash
bash scripts/preflight-docker.sh
```

3. Correr auditoría de endpoints:
```bash
API_BASE=http://localhost:4000 \
AUDIT_ADMIN_EMAIL=admin@corelia.local \
AUDIT_ADMIN_PASSWORD='Admin123!@#' \
node scripts/audit-api-smoke.mjs
```

4. Revisar salida:
- [docs/api-audit-results.json](/home/informatica3/Escritorio/Github/Corelia/docs/api-audit-results.json)

## Estado Final

- La API quedó auditada por rutas registradas.
- No se detectan errores de servidor (`5xx`) en la corrida final.
- Compilación, lint y tests se mantienen verdes después de las correcciones.
