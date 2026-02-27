# ADR 0001 - Arquitectura base Fase 1

## Estado
Aceptado - 2026-02-26

## Contexto
Corelia requiere un núcleo operativo on-premise con stack único TypeScript, control de acceso en contexto de proyecto, trazabilidad de acciones críticas y módulos operativos base para coordinación diaria.

## Decisión
1. Monorepo con Turborepo + pnpm, separado en apps (`web`, `api`, `workers`) y paquetes (`types`, `ui`, `config`).
2. Contratos de dominio centralizados en `@corelia/types` con Zod + inferencia TypeScript compartida en backend y frontend.
3. Backend Fastify con Prisma/PostgreSQL para persistencia principal, Redis para colas/caché y BullMQ para jobs asíncronos.
4. Middleware global de resolución RBAC en contexto de proyecto y middleware centralizado de auditoría en `onResponse`.
5. Seguridad base obligatoria en API: JWT access 15 min, refresh token rotatorio persistido/invalidado, Helmet con CSP/HSTS/X-Frame-Options y rate limit en login.
6. Infraestructura local por Docker Compose con Nginx como proxy SSL y servicios persistentes (Postgres, Redis, MinIO).

## Consecuencias
1. Se reduce desalineación de contratos entre frontend/backend al compartir schemas.
2. El crecimiento funcional por módulos conserva fronteras de dominio claras (`router/service/schema`).
3. El costo operativo queda controlado para entorno on-premise de un único nodo en Fase 1.
4. La auditoría queda normalizada para eventos críticos, facilitando cumplimiento y trazabilidad.

## Riesgos de seguridad aceptados temporalmente (2026-02-27)
1. `next@14.2.35` reporta `GHSA-h25m-26qc-wcjf` (DoS en escenarios de React Server Components inseguros), corregido aguas arriba recién en `next>=15.0.8`.
2. Se mantiene `Next.js 14` por restricción de stack de Fase 1 y compatibilidad del proyecto; migrar a `Next.js 15` se agenda para Fase 2 con plan de regresión UI/API.
3. `GHSA-5j98-mcp5-4vw2` aparece vía `eslint-config-next` (dependencia de lint), sin impacto en runtime de negocio.
4. Mitigaciones aplicadas: rate limiting en API auth, proxy Nginx con hardening, endpoint público limitado a `/status`, y actualización inmediata de dependencias runtime críticas (`next` parcheada dentro de rama 14 y `nodemailer` 7.0.11).
