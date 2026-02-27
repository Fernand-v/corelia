# ADR 0002 - Fase 2A servidor de medios y realtime

## Estado
Aceptado - 2026-02-27

## Contexto
Fase 2A requiere notificaciones en tiempo real, señalización para videollamadas y trazabilidad distribuida sin romper API v1 ni despliegue on-premise existente.

## Decisión
1. Integrar Socket.io en `apps/api` como plugin Fastify, exponiendo `/ws/socket.io` detrás de Nginx.
2. Implementar servidor de medios como plugin interno de API (`mediaPlugin`) con driver `mediasoup` y modo degradado automático si falla inicialización/worker.
3. Mantener persistencia del ciclo de reunión en PostgreSQL (`Meeting`, `MeetingParticipant`, `MeetingAgendaItem`, `MeetingNote`, `MeetingAgreement`).
4. Extender notificaciones persistidas con `deliveredAt` y `readAt`, entregando por Socket.io y fallback a polling (30s) en cliente.
5. Instrumentar API y workers con OpenTelemetry OTLP HTTP, exportando a Grafana Tempo en `docker-compose`.
6. Propagar contexto de traza desde API a BullMQ mediante carrier `_trace` en payload de jobs.

## Consecuencias
1. Se evita introducir un nuevo proceso crítico para señalización en esta fase; menor complejidad operativa inicial.
2. El modo degradado preserva continuidad de negocio (chat, calendario, acuerdos) cuando media falla.
3. La correlación HTTP -> job asíncrono queda disponible en observabilidad para diagnóstico de latencia/errores.
4. Queda abierto separar mediasoup en `apps/media` dedicado si el uso concurrente supera capacidad de API.

## Riesgos aceptados
1. La integración mediasoup en proceso API aumenta presión de CPU/RAM durante llamadas grupales.
2. En entorno sin daemon Docker activo no se puede validar stack completo (`docker compose up`) durante esta ejecución local.
