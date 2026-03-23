# Corelia

Guía operativa para instalar, levantar y entregar Corelia desde cero.

## 1) Requisitos

- Node.js 20+
- `corepack` habilitado (para usar `pnpm@9.12.3`)
- Docker + Docker Compose

Verificación rápida:

```bash
node -v
docker --version
docker compose version
```

## 2) Preparar entorno

```bash
# Desde la raíz del proyecto
corepack enable
corepack pnpm install

cp .env.example .env
```

Editar `.env` con valores reales, al menos:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `COLLAB_AUTH_SECRET`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `SMTP_USER`
- `SMTP_PASS`
- `WEB_PUSH_VAPID_PUBLIC_KEY` y `WEB_PUSH_VAPID_PRIVATE_KEY` si activarás push del navegador

Si quieres habilitar push del navegador, genera claves VAPID:

```bash
corepack pnpm push:generate-keys
```

Luego copia `publicKey` y `privateKey` al `.env`, define `WEB_PUSH_VAPID_SUBJECT` y activa `WEB_PUSH_ENABLED=true`.
Las notificaciones push del navegador requieren `https://` o `http://localhost`.

## 3) Levantar todo el stack

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build --force-recreate
```

Si algún puerto local está ocupado, puedes sobrescribir puertos al levantar:

```bash
POSTGRES_PORT=5433 REDIS_PORT=6380 MINIO_API_PORT=9002 MINIO_CONSOLE_PORT=9003 \
docker compose --env-file .env -f docker/docker-compose.yml up -d --build --force-recreate
```

Cuando uses puertos alternos, ajusta también en `.env` las URLs correspondientes (`DATABASE_URL`, `REDIS_URL`, `MINIO_PORT`).

Servicios principales:

- Web: `http://localhost` (recomendado vía nginx)
- API estado: `http://localhost/status`
- API directa: `http://localhost:4000/api/v1`
- MinIO consola: `http://localhost:9001`
- Búsqueda: Meilisearch interno en `http://meilisearch:7700` dentro de Docker

Servicios opcionales por perfil:

- Grafana + Prometheus + Tempo: `docker compose --profile monitoring --env-file .env -f docker/docker-compose.yml up -d`

## 4) Inicializar base de datos y roles

```bash
corepack pnpm prisma:seed
```

## 5) Crear administrador inicial

Script incluido: `scripts/bootstrap-admin.ts`

```bash
# Admin principal
BOOTSTRAP_ADMIN_EMAIL='admin@corelia.local' \
BOOTSTRAP_ADMIN_PASSWORD='Admin123!@#' \
BOOTSTRAP_ADMIN_FIRST_NAME='Admin' \
BOOTSTRAP_ADMIN_LAST_NAME='Corelia' \
corepack pnpm bootstrap:admin
```

Ejemplo para crear un segundo admin:

```bash
BOOTSTRAP_ADMIN_EMAIL='demo.admin@corelia.local' \
BOOTSTRAP_ADMIN_PASSWORD='Demo123!@#' \
BOOTSTRAP_ADMIN_FIRST_NAME='Demo' \
BOOTSTRAP_ADMIN_LAST_NAME='Admin' \
corepack pnpm bootstrap:admin
```

## 6) Verificación mínima

```bash
# Estado de contenedores
docker compose --env-file .env -f docker/docker-compose.yml ps

# Health API
curl -sS http://localhost/status

# Login admin (ejemplo)
curl -X POST http://localhost/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@corelia.local","password":"Admin123!@#"}'
```

## 7) Reinicio total (DESTRUCTIVO)

El siguiente comando elimina completamente datos de PostgreSQL, Redis, MinIO, Grafana, Prometheus y volúmenes asociados:

```bash
docker compose --env-file .env -f docker/docker-compose.yml down -v --remove-orphans
```

Luego, para reconstruir desde cero, repetir secciones **3**, **4** y **5**.

## 8) Operación diaria

```bash
# Ver logs en vivo de API
docker compose --env-file .env -f docker/docker-compose.yml logs -f api

# Reiniciar solo un servicio
docker compose --env-file .env -f docker/docker-compose.yml restart web

# Detener entorno sin borrar datos
docker compose --env-file .env -f docker/docker-compose.yml down
```

Reconstrucción manual del índice de búsqueda:

```bash
corepack pnpm search:reindex
```

## Nota de despliegue

Para acceso LAN/producción, ajustar en `.env`:

- `CORS_ALLOWED_ORIGINS`
- `NEXT_PUBLIC_API_URL_DOCKER`
- `NEXT_PUBLIC_WS_URL_DOCKER`
- `MEDIA_ANNOUNCED_IP`
- certificados nginx (`NGINX_SSL_CERT_PATH`, `NGINX_SSL_KEY_PATH`)
