# Rotación de secretos comprometidos

Fecha de referencia: 2026-03-09.

## Alcance mínimo a rotar

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `COLLAB_AUTH_SECRET`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `SMTP_USER`
- `SMTP_PASS`
- Certificado y clave TLS (`NGINX_SSL_CERT_PATH`, `NGINX_SSL_KEY_PATH`)

## Procedimiento

1. Generar nuevos valores con entropía fuerte.

```bash
openssl rand -hex 32   # COLLAB_AUTH_SECRET
openssl rand -base64 48 # JWT secrets / passwords
```

2. Actualizar `.env` con los nuevos secretos.
3. Regenerar certificados TLS locales:

```bash
mkdir -p docker/nginx/certs-local
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout docker/nginx/certs-local/corelia.key \
  -out docker/nginx/certs-local/corelia.crt \
  -days 365 \
  -subj "/CN=localhost"
```

4. Verificar rutas TLS en `.env`:

```bash
NGINX_SSL_CERT_PATH=./docker/nginx/certs-local/corelia.crt
NGINX_SSL_KEY_PATH=./docker/nginx/certs-local/corelia.key
```

5. Reiniciar stack para aplicar rotación:

```bash
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml up -d --build
```

6. Validar:

```bash
bash scripts/preflight-docker.sh
```
