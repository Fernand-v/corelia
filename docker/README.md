# Docker build and runtime guide

This repository uses a single `docker/docker-compose.yml` for local runtime.

## Required secret and TLS variables

Docker now requires sensitive values to be defined in `.env` (no insecure defaults).
At minimum define:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `COLLAB_AUTH_SECRET`
- `CORS_ALLOWED_ORIGINS` (lista de orígenes permitidos en producción)
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `NGINX_SSL_CERT_PATH`, `NGINX_SSL_KEY_PATH`

## Local TLS certificate generation

Generate local self-signed certs outside tracked runtime secrets:

```bash
mkdir -p docker/nginx/certs-local
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout docker/nginx/certs-local/corelia.key \
  -out docker/nginx/certs-local/corelia.crt \
  -days 365 \
  -subj "/CN=localhost"
```

Then set in `.env`:

```bash
NGINX_SSL_CERT_PATH=./nginx/certs-local/corelia.crt
NGINX_SSL_KEY_PATH=./nginx/certs-local/corelia.key
```

## Recommended commands

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

Start full stack:

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Quick validation metrics

Check image sizes:

```bash
docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | rg '^docker-(api|web)\s'
```

Check running service status:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Check API status endpoint:

```bash
curl -sS http://localhost:4000/status
```
