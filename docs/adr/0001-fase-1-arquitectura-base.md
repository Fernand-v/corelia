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

## Estado de seguridad runtime (actualizado 2026-03-09)
1. Se cerró el riesgo temporal de `next@14.2.35` (`GHSA-h25m-26qc-wcjf`) al migrar a `next@15.5.10` y actualizar el stack de lint web a plugin de Next 15.
2. Se retiró `xlsx` del runtime de API por advisories abiertos sin parche efectivo en la rama usada, migrando exportación ejecutiva a `exceljs`.
3. Se actualizaron dependencias runtime críticas (`jspdf`, `fastify`) y se aplicaron `pnpm.overrides` transitorios con trazabilidad explícita:
   - `tar@7.5.11`
   - `dompurify@3.3.2`
   - `nanoid@5.1.6`
   - `mermaid@11.13.0`
4. No quedan excepciones críticas/altas abiertas en runtime al cierre de esta actualización (2026-03-09). Revisión periódica acordada: ejecutar `pnpm security:audit` por PR y seguimiento mensual de seguridad el día 9 de cada mes.
