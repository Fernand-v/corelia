#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILES=(
  "${ROOT_DIR}/docker/docker-compose.yml"
  "${ROOT_DIR}/docker/docker-compose.staging.yml"
)

SENSITIVE_VARS=(
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  COLLAB_AUTH_SECRET
  MINIO_ROOT_PASSWORD
  MINIO_ROOT_USER
  SMTP_PASS
  NGINX_SSL_CERT_PATH
  NGINX_SSL_KEY_PATH
)

found_issues=0

for file in "${COMPOSE_FILES[@]}"; do
  for key in "${SENSITIVE_VARS[@]}"; do
    if rg -n "\$\{${key}:-" "${file}" >/dev/null; then
      echo "[FAIL] Default inseguro detectado para ${key} en ${file}"
      found_issues=1
    fi
  done
done

if find "${ROOT_DIR}/docker/nginx/certs" -maxdepth 1 -type f \( -name "*.key" -o -name "*.crt" -o -name "*.pem" \) | grep -q .; then
  echo "[FAIL] Se detectó material TLS versionado en docker/nginx/certs"
  found_issues=1
fi

if [[ "${found_issues}" -ne 0 ]]; then
  echo "[FAIL] Validación de secretos/compose falló"
  exit 1
fi

echo "[OK] Compose sin defaults sensibles y sin material TLS versionado"
