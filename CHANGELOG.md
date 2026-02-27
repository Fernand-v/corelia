# Changelog

## 0.2.0 - 2026-02-27

### Added
- Fase 2A backend: módulo `meetings` con ciclo completo de reunión (agenda, notas, acuerdos y seguimiento pendiente).
- Fase 2A backend: módulo `calendar` con calendario colaborativo v2, reprogramación de tareas con validaciones y vista de capacidad.
- Realtime engine con Socket.io en API (`/ws/socket.io`) para notificaciones in-app y sincronización tras reconexión.
- Modo degradado para videollamadas: plugin de medios en API con healthcheck en `/status` y fallback explícito cuando media no está disponible.
- Persistencia de reuniones/acuerdos y calendario externo en Prisma (`Meeting*`, `ExternalCalendar*`) + migración `20260227143000_phase2a_realtime`.
- Notificaciones extendidas con eventos en tiempo real (`MENSAJE_NUEVO_CANAL`, `REUNION_PROGRAMADA`, `ACUERDO_ASIGNADO_TAREA`) y campos `deliveredAt/readAt`.
- Endpoints de notificaciones para `unread-count`, `mark-read` y `sync`.
- OpenTelemetry en API y workers con export OTLP a Tempo.
- Docker Compose actualizado con servicio `tempo` y configuración de trazas.
- Frontend Next.js: páginas `/meetings` y `/calendar`, badge de notificaciones realtime con fallback a polling cada 30s.
- Pruebas nuevas de Fase 2A para reuniones, notificaciones realtime y bloqueo de reprogramación por vacaciones.
- Señalización de llamadas extendida en Socket.io: `meeting:call:join/leave`, actualización de estado de participante y forwarding `meeting:webrtc:signal`.
- UI de reuniones extendida con controles de llamada (mute/cámara/pantalla/hablando), listado de participantes y alerta de modo degradado.
- Sincronización externa v2: conexión OAuth con `authorizationCode` y sync de lectura directo desde Google Calendar / Microsoft Calendar.
- Instrumentación OpenTelemetry adicional para spans de señalización realtime y bootstrap/capacidades del servidor de medios.
- Tests de integración adicionales: cliente Socket.io (recepción realtime + sync) y degradación validando continuidad de chat/calendario con media caído.

## 0.1.0 - 2026-02-26

### Added
- Monorepo base con Turborepo y pnpm.
- Paquete `@corelia/types` con schemas Zod y tipos compartidos de Fase 1.
- Paquete `@corelia/ui` con componentes base reutilizables.
- API Fastify (`@corelia/api`) con Prisma schema de Fase 1 y módulos por dominio.
- Middleware global RBAC en contexto de proyecto.
- Middleware centralizado de auditoría para eventos críticos.
- Autenticación JWT (15 min) + refresh token con rotación e invalidación.
- Módulos API para identidad, proyectos, tareas, disponibilidad, tiempo, mensajería, notificaciones, anuncios, formularios, archivos, búsqueda, decisiones, automatizaciones, objetivos, integraciones, importaciones y auditoría.
- Endpoint público `/status` y control de modo mantenimiento.
- Workers BullMQ (`@corelia/workers`) para notificaciones, webhooks y automatizaciones.
- Frontend Next.js 14 (`@corelia/web`) con TanStack Query y formularios RHF+Zod.
- Infraestructura Docker Compose (local y staging) con PostgreSQL 16, Redis 7, MinIO, API, Web, Workers y Nginx.
- ADR inicial de decisiones técnicas de Fase 1 en `docs/adr`.
