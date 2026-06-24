# Docker build and runtime guide

This repository uses a single `docker/docker-compose.yml` for local runtime.

## Required secret and TLS variables

Docker now requires sensitive values to be defined in `.env` (no insecure defaults).
At minimum define:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `COLLAB_AUTH_SECRET`
- `CORELIA_APP_URL`
- `ONLYOFFICE_JWT_SECRET`
- `CORS_ALLOWED_ORIGINS` (lista de orígenes permitidos en producción)
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `WEB_PUSH_VAPID_SUBJECT`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` si habilitas push del navegador
- `NGINX_SSL_CERT_PATH`, `NGINX_SSL_KEY_PATH`

Solo si habilitas perfiles opcionales:

- `monitoring`: `OTEL_ENABLED_DOCKER=true` si quieres exportar trazas desde `api` y `workers`

## Local TLS certificate generation

Generate a local self-signed cert with SANs for `localhost`:

```bash
bash scripts/generate-local-tls-cert.sh
```

Then set in `.env`:

```bash
NGINX_SSL_CERT_PATH=./nginx/certs-local/corelia.crt
NGINX_SSL_KEY_PATH=./nginx/certs-local/corelia.key
```

This certificate is still self-signed. Browsers may require you to trust it manually, but it now includes SAN entries for `localhost`, `127.0.0.1`, and `::1`, which avoids modern hostname validation errors.

On Ubuntu/Debian, you can trust it system-wide with:

```bash
bash scripts/install-local-tls-cert.sh
```

This script copies the local cert into `/usr/local/share/ca-certificates/` and runs `update-ca-certificates`, so it will ask for `sudo`.

## Recommended commands

## ONLYOFFICE local setup

The local Docker stack now includes `onlyoffice/documentserver` behind nginx at `/onlyoffice`.

Recommended local values:

```bash
CORELIA_APP_URL=https://localhost
ONLYOFFICE_CALLBACK_BASE_URL=http://nginx
ONLYOFFICE_DOCUMENT_SERVER_URL=https://localhost/onlyoffice
ONLYOFFICE_JWT_SECRET=change_this_onlyoffice_secret
```

- `CORELIA_APP_URL` is the public URL used by Corelia for links.
- `ONLYOFFICE_CALLBACK_BASE_URL` is the URL reachable from inside Docker by the Document Server.
- `ONLYOFFICE_DOCUMENT_SERVER_URL` is the public URL used by the browser to load the editor.
- `ONLYOFFICE_JWT_SECRET` must match the Document Server JWT secret.

Build only API and Web:

```bash
docker compose -f docker/docker-compose.yml build api web
```

Build and start only API and Web:

```bash
docker compose -f docker/docker-compose.yml up -d --build api web
```

Incremental rebuild of one service:

```bash
docker compose -f docker/docker-compose.yml build api
docker compose -f docker/docker-compose.yml up -d api
```

```bash
docker compose -f docker/docker-compose.yml build web
docker compose -f docker/docker-compose.yml up -d web
```

Start default stack:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Manual rebuild of the Meilisearch index:

```bash
corepack pnpm search:reindex
```

Start Corelia plus monitoring:

```bash
docker compose --profile monitoring -f docker/docker-compose.yml up -d
```

## Migraciones de base de datos en producción

Las migraciones se aplican como **paso dedicado**, no en el arranque de la API,
para evitar carreras cuando hay **varias instancias** de la API arrancando a la
vez.

**En Docker Compose** ya está resuelto: el servicio one-shot `migrate` ejecuta
`prisma migrate deploy` una sola vez (espera a que Postgres esté sano) y la `api`
sólo arranca cuando ese servicio termina con éxito (`service_completed_successfully`).
Por eso en compose `AUTO_MIGRATE_ON_START` por defecto es `false`. El servicio
`migrate` reutiliza la imagen `corelia-api:local`, así que no añade build extra.

```bash
# Aplica migraciones y levanta el stack (la API espera a `migrate`)
cd docker && docker compose up -d
```

**Fuera de Compose (orquestador propio, k8s, etc.):**

1. Mantén `AUTO_MIGRATE_ON_START=false` en el entorno de la API.
2. Ejecuta las migraciones como **paso dedicado del despliegue** (init container,
   job, o paso del pipeline), antes de levantar las instancias de la API:

   ```bash
   pnpm --filter @corelia/api prisma:migrate:deploy
   ```

3. Sólo deja `AUTO_MIGRATE_ON_START=true` en desarrollo local de una sola
   instancia, donde la comodidad pesa más que el riesgo de carrera.

4. Rollback: Prisma no revierte automáticamente. Para deshacer una migración
   aplicada, crea una migración correctiva (`prisma migrate dev` en un entorno
   de desarrollo) y despliégala, o restaura desde backup de la base de datos
   antes de re-aplicar. Mantén siempre un backup previo al despliegue.

## Quick validation metrics

Check image sizes:

```bash
docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | rg '^docker-(api|web)\s'
```

Check active compose services:

```bash
docker compose -f docker/docker-compose.yml ps
```

Check running service status:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Check API status endpoint:

```bash
curl -sS http://localhost:4000/status
```
