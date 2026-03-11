# Corelia

Plataforma intranet y de gestión de proyectos. Monorepo con pnpm workspaces + Turborepo.

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js     | 20.0.0        |
| pnpm        | 9.12.3 (se instala automáticamente con `corepack enable`) |
| Docker      | 24+ (solo para infraestructura o despliegue) |

## Inicio rápido (desarrollo local)

```bash
# 1. Instalar dependencias
corepack enable        # activa pnpm con la versión exacta del repo
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con valores reales (ver sección "Variables de entorno")

# 3. Levantar infraestructura (PostgreSQL, Redis, MinIO, Tempo)
cd docker && docker compose up -d postgres redis minio minio-init tempo && cd ..

# 4. Aplicar migraciones de base de datos
pnpm prisma:migrate:dev

# 5. Arrancar todos los servicios en modo desarrollo
pnpm dev
```

Servicios disponibles tras `pnpm dev`:

| Servicio    | URL                              |
|-------------|----------------------------------|
| Web         | http://localhost:3000             |
| API         | http://localhost:4000/api/v1      |
| Hocuspocus  | ws://localhost:1234               |
| MinIO Console | http://localhost:9001           |
| Tempo (traces) | http://localhost:3200          |

> En desarrollo sin nginx, el frontend auto-resuelve API a `:4000`, Socket.IO a `:4000` y Hocuspocus a `:1234`.

## Stack completo con Docker

```bash
# Construir y levantar todo (incluye nginx en :80/:443)
cd docker && docker compose up -d --build

# Solo reconstruir un servicio
docker compose -f docker/docker-compose.yml build api
docker compose -f docker/docker-compose.yml up -d api

# Staging (con límites de recursos)
cd docker && docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Enrutamiento nginx

| Ruta       | Destino            | Protocolo    |
|------------|--------------------|--------------|
| `/`        | web:3000           | HTTP         |
| `/api/`    | api:4000           | HTTP         |
| `/ws/`     | api:4000           | WebSocket    |
| `/collab`  | hocuspocus:1234    | WebSocket    |
| `/status`  | api:4000/status    | HTTP         |

## Estructura del monorepo

```
apps/
  api/          Fastify 5 REST API (ESM, TypeScript)
  web/          Next.js 14 frontend (App Router)
  hocuspocus/   Servidor colaborativo Y.js
  workers/      Workers BullMQ (notificaciones, webhooks, automaciones)
packages/
  types/        Schemas Zod y tipos compartidos
  ui/           Componentes UI compartidos
  config/       Configuración ESLint/Prettier/TypeScript base
docker/
  docker-compose.yml           Stack local
  docker-compose.staging.yml   Overrides de staging (límites CPU/memoria)
  nginx/                       Configuración reverse proxy
  tempo/                       Configuración Grafana Tempo
```

## Comandos principales

```bash
# Desarrollo
pnpm dev                         # Todos los servicios en watch mode
pnpm --filter @corelia/api dev   # Solo API
pnpm --filter @corelia/web dev   # Solo Web

# Calidad
pnpm build                       # Build completo (orden de dependencias)
pnpm test                        # Tests (Vitest)
pnpm lint                        # Linting
pnpm typecheck                   # Type-check
pnpm format                      # Verificar formato

# Test individual
pnpm --filter @corelia/api exec vitest run src/test/auth.integration.spec.ts

# Base de datos
pnpm prisma:migrate:dev          # Crear y aplicar migración
pnpm prisma:migrate:status       # Estado de migraciones
pnpm prisma:generate             # Regenerar Prisma client
```

## Variables de entorno

Copiar `.env.example` a `.env` y configurar. Las variables están organizadas por servicio:

| Grupo | Variables clave | Notas |
|-------|----------------|-------|
| PostgreSQL | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` | Prisma requiere `DATABASE_URL` |
| Redis | `REDIS_URL`, `REDIS_PASSWORD` | Usado por API y workers |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Secrets mínimo 16 chars |
| Seguridad | `COLLAB_AUTH_SECRET`, `CORS_ALLOWED_ORIGINS` | `COLLAB_AUTH_SECRET` se comparte entre API y Hocuspocus; `CORS_ALLOWED_ORIGINS` es lista separada por comas |
| MinIO | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | Bucket se auto-crea con `minio-init` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Workers envían emails |
| Frontend | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_HOCUSPOCUS_URL` | Variantes `_DOCKER` para builds Docker |
| MediaSoup | `MEDIA_LISTEN_IP`, `MEDIA_ANNOUNCED_IP`, `MEDIA_MIN_PORT`-`MEDIA_MAX_PORT` | Puertos UDP 40000-40100 por defecto |
| Calendar | `GOOGLE_CALENDAR_CLIENT_ID/SECRET`, `MICROSOFT_CALENDAR_CLIENT_ID/SECRET` | Opcional |
| Webhooks | `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL` | Opcional |
| Tracing | `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT` | Grafana Tempo |

> `AUTO_MIGRATE_ON_START=true` ejecuta `prisma migrate deploy` al iniciar la API.

## Operaciones

### Backup de base de datos

```bash
# Backup completo (desde host con Docker)
docker exec corelia-postgres pg_dump -U corelia -Fc corelia > backup_$(date +%Y%m%d_%H%M%S).dump

# Backup solo esquema
docker exec corelia-postgres pg_dump -U corelia --schema-only corelia > schema_$(date +%Y%m%d).sql

# Backup con compresión
docker exec corelia-postgres pg_dump -U corelia -Fc corelia | gzip > backup_$(date +%Y%m%d_%H%M%S).dump.gz
```

### Restore de base de datos

```bash
# Restore completo (reemplaza la base de datos)
docker exec -i corelia-postgres pg_restore -U corelia -d corelia --clean --if-exists < backup.dump

# Si la DB no existe, crearla primero
docker exec corelia-postgres createdb -U corelia corelia
docker exec -i corelia-postgres pg_restore -U corelia -d corelia < backup.dump

# Tras restore, re-aplicar migraciones pendientes si las hay
pnpm prisma:migrate:dev
```

### Backup de MinIO (archivos)

```bash
# Instalar mc (MinIO Client) si no está disponible
# https://min.io/docs/minio/linux/reference/minio-mc.html

# Configurar alias
mc alias set corelia http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Backup completo del bucket
mc mirror corelia/corelia-files ./backup_files_$(date +%Y%m%d)

# Restore
mc mirror ./backup_files_20260309 corelia/corelia-files
```

### Backup de Redis

```bash
# Forzar snapshot y copiar
docker exec corelia-redis redis-cli -a "$REDIS_PASSWORD" BGSAVE
docker cp corelia-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb

# Restore: copiar dump.rdb y reiniciar
docker cp ./redis_backup.rdb corelia-redis:/data/dump.rdb
docker restart corelia-redis
```

### Verificación de salud

```bash
# Estado de todos los contenedores
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# Health check de la API
curl -sS http://localhost:4000/status

# Estado de migraciones
pnpm prisma:migrate:status

# Logs de un servicio
docker logs corelia-api --tail 100 -f
docker logs corelia-workers --tail 100 -f
```

### Limpieza

```bash
# Purgar volúmenes (DESTRUCTIVO - elimina todos los datos)
cd docker && docker compose down -v

# Limpiar solo imágenes de build
docker image prune -f --filter "label=com.docker.compose.project=docker"
```

## Recursos de staging

El archivo `docker-compose.staging.yml` añade límites de recursos:

| Servicio    | CPU | Memoria |
|-------------|-----|---------|
| API         | 2   | 2 GB    |
| Web         | 2   | 2 GB    |
| Workers     | 2   | 2 GB    |
| PostgreSQL  | 2   | 4 GB    |
| Redis       | 1   | 1 GB    |
| Hocuspocus  | 1   | 1 GB    |
| Tempo       | 1   | 1 GB    |
