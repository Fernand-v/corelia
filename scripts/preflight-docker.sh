#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker/docker-compose.yml}"
COMPOSE_DIR="$(cd "$(dirname "${COMPOSE_FILE}")" && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
API_BASE="${API_BASE:-http://localhost:4000/api/v1}"
COLLAB_URL="${COLLAB_URL:-http://localhost/collab}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-corelia-postgres}"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

ok() {
  echo "[OK]   $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

warn() {
  echo "[WARN] $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[FAIL] Falta comando requerido: $1"
    exit 1
  fi
}

run_sql() {
  local sql="$1"
  docker exec -i "${POSTGRES_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tA -c "${sql}"
}

check_container() {
  local name="$1"
  local require_health="${2:-false}"

  if ! docker ps --format '{{.Names}}' | grep -qx "${name}"; then
    fail "Contenedor no está en ejecución: ${name}"
    return
  fi

  if [[ "${require_health}" == "true" ]]; then
    local health
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${name}" 2>/dev/null || echo "unknown")"
    if [[ "${health}" != "healthy" && "${health}" != "none" ]]; then
      fail "Contenedor sin health ok: ${name} (health=${health})"
      return
    fi
  fi

  ok "Contenedor activo: ${name}"
}

load_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  fi

  POSTGRES_USER="${POSTGRES_USER:-}"
  POSTGRES_DB="${POSTGRES_DB:-}"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-}"
  JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-}"
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}"
  COLLAB_AUTH_SECRET="${COLLAB_AUTH_SECRET:-}"
  CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-}"
  MINIO_ROOT_USER="${MINIO_ROOT_USER:-}"
  MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}"
  SMTP_USER="${SMTP_USER:-}"
  SMTP_PASS="${SMTP_PASS:-}"
  SMTP_FROM="${SMTP_FROM:-}"
  NGINX_SSL_CERT_PATH="${NGINX_SSL_CERT_PATH:-}"
  NGINX_SSL_KEY_PATH="${NGINX_SSL_KEY_PATH:-}"
  AUTO_MIGRATE_ON_START="${AUTO_MIGRATE_ON_START:-}"
}

check_required_env() {
  local key="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    fail "${key} no está definida en ${ENV_FILE}"
  else
    ok "${key} definida"
  fi
}

resolve_path() {
  local raw="$1"
  if [[ "${raw}" == /* ]]; then
    echo "${raw}"
  else
    local compose_relative="${COMPOSE_DIR}/${raw#./}"
    if [[ -e "${compose_relative}" ]]; then
      echo "${compose_relative}"
      return
    fi

    echo "${ROOT_DIR}/${raw#./}"
  fi
}

check_tls_files() {
  local cert_path
  local key_path
  cert_path="$(resolve_path "${NGINX_SSL_CERT_PATH}")"
  key_path="$(resolve_path "${NGINX_SSL_KEY_PATH}")"

  if [[ ! -f "${cert_path}" ]]; then
    fail "No existe archivo TLS de certificado: ${cert_path}"
  else
    ok "Certificado TLS disponible (${cert_path})"
  fi

  if [[ ! -f "${key_path}" ]]; then
    fail "No existe archivo TLS de clave privada: ${key_path}"
  else
    ok "Clave TLS disponible (${key_path})"
  fi
}

check_env_consistency() {
  check_required_env "POSTGRES_DB" "${POSTGRES_DB}"
  check_required_env "POSTGRES_USER" "${POSTGRES_USER}"
  check_required_env "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
  check_required_env "REDIS_PASSWORD" "${REDIS_PASSWORD}"
  check_required_env "JWT_ACCESS_SECRET" "${JWT_ACCESS_SECRET}"
  check_required_env "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET}"
  check_required_env "COLLAB_AUTH_SECRET" "${COLLAB_AUTH_SECRET}"
  check_required_env "MINIO_ROOT_USER" "${MINIO_ROOT_USER}"
  check_required_env "MINIO_ROOT_PASSWORD" "${MINIO_ROOT_PASSWORD}"
  check_required_env "SMTP_USER" "${SMTP_USER}"
  check_required_env "SMTP_PASS" "${SMTP_PASS}"
  check_required_env "SMTP_FROM" "${SMTP_FROM}"
  check_required_env "NGINX_SSL_CERT_PATH" "${NGINX_SSL_CERT_PATH}"
  check_required_env "NGINX_SSL_KEY_PATH" "${NGINX_SSL_KEY_PATH}"
  check_tls_files

  if [[ "${CORS_ALLOWED_ORIGINS}" == *"*"* ]]; then
    warn "CORS_ALLOWED_ORIGINS contiene '*' y no es recomendable en producción."
  fi

  if [[ "${AUTO_MIGRATE_ON_START,,}" != "true" ]]; then
    warn "AUTO_MIGRATE_ON_START no está en true. Se recomienda true para evitar drift de esquema."
  else
    ok "AUTO_MIGRATE_ON_START=true"
  fi
}

check_api_status() {
  local api_root
  api_root="$(echo "${API_BASE}" | sed -E 's#/api/v1/?$##')"
  local status_url="${api_root}/status"

  local body_file
  body_file="$(mktemp)"
  local code
  code="$(curl -sS -o "${body_file}" -w "%{http_code}" "${status_url}" || true)"
  local body
  body="$(cat "${body_file}")"
  rm -f "${body_file}"

  if [[ "${code}" != "200" ]]; then
    fail "Health endpoint no responde 200 (${status_url}, HTTP ${code})"
    return
  fi

  if grep -Eq '"status":"(down|degraded)"' <<<"${body}"; then
    fail "Health endpoint reporta servicios degradados/down: ${body}"
    return
  fi

  ok "Health endpoint estable (${status_url})"
}

check_collab_websocket() {
  local collab_url="$1"
  local body_file
  body_file="$(mktemp)"
  local code
  code="$(curl -sS -o "${body_file}" -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    "${collab_url}" || true)"
  rm -f "${body_file}"

  if [[ "${code}" != "101" ]]; then
    return 1
  fi

  return 0
}

check_collab_websocket_variants() {
  local base_url="${COLLAB_URL}"
  local alt_url

  if [[ "${base_url}" == */ ]]; then
    alt_url="${base_url%/}"
  else
    alt_url="${base_url}/"
  fi

  if check_collab_websocket "${base_url}"; then
    ok "Handshake WebSocket OK (${base_url})"
  else
    fail "Handshake WebSocket falló en ${base_url}"
  fi

  if [[ "${alt_url}" == "${base_url}" ]]; then
    return
  fi

  if check_collab_websocket "${alt_url}"; then
    ok "Handshake WebSocket OK (${alt_url})"
  else
    fail "Handshake WebSocket falló en ${alt_url}"
  fi
}

check_auth_enforcement() {
  local projects_url="${API_BASE}/projects"

  local no_key_file
  no_key_file="$(mktemp)"
  local no_key_code
  no_key_code="$(curl -sS -o "${no_key_file}" -w "%{http_code}" "${projects_url}" || true)"
  local no_key_body
  no_key_body="$(cat "${no_key_file}")"
  rm -f "${no_key_file}"

  if [[ "${no_key_code}" != "401" ]] || ! grep -q "Unauthorized" <<<"${no_key_body}"; then
    fail "Protección JWT/RBAC falló en /projects sin token (HTTP ${no_key_code})"
    return
  fi

  ok "Protección JWT/RBAC validada en endpoints protegidos"
}

check_schema_columns() {
  local checks=(
    "Project.descriptionCatalogId"
    "ProjectStage.code"
    "Task.stageId"
    "Task.startDate"
    "TaskScheduleHistory.reasonCatalogId"
    "Message.kind"
    "Message.meetingId"
    "MessageAttachment.minioPath"
  )

  local missing=()
  local entry table column exists
  for entry in "${checks[@]}"; do
    table="${entry%%.*}"
    column="${entry#*.}"
    exists="$(run_sql "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}');" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ "${exists}" != "t" ]]; then
      missing+=("${entry}")
    fi
  done

  if [[ "${#missing[@]}" -gt 0 ]]; then
    fail "Columnas faltantes en DB: ${missing[*]}"
    return
  fi

  ok "Columnas críticas del esquema presentes"
}

check_migrations() {
  local latest_local_migration
  latest_local_migration="$(find "${ROOT_DIR}/apps/api/prisma/migrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -n1)"

  if [[ -z "${latest_local_migration}" ]]; then
    fail "No se encontraron migraciones locales en apps/api/prisma/migrations"
    return
  fi

  local latest_applied
  latest_applied="$(run_sql "SELECT EXISTS (SELECT 1 FROM \"_prisma_migrations\" WHERE migration_name='${latest_local_migration}' AND finished_at IS NOT NULL);" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "${latest_applied}" != "t" ]]; then
    fail "Última migración local no está aplicada: ${latest_local_migration}"
    return
  fi

  local pending_count
  pending_count="$(run_sql "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE finished_at IS NULL AND rolled_back_at IS NULL;" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -z "${pending_count}" || "${pending_count}" != "0" ]]; then
    fail "Hay migraciones pendientes/incompletas en _prisma_migrations (count=${pending_count:-unknown})"
    return
  fi

  ok "Migraciones Prisma al día (${latest_local_migration})"
}

main() {
  require_cmd docker
  require_cmd curl

  load_env

  echo "Preflight Corelia"
  echo "COMPOSE_FILE=${COMPOSE_FILE}"
  echo "API_BASE=${API_BASE}"
  echo "COLLAB_URL=${COLLAB_URL}"
  echo "POSTGRES_CONTAINER=${POSTGRES_CONTAINER}"
  echo

  check_env_consistency
  check_container "corelia-postgres" "true"
  check_container "corelia-redis" "true"
  check_container "corelia-minio" "true"
  check_container "corelia-api" "false"
  check_container "corelia-web" "false"
  check_container "corelia-hocuspocus" "false"
  check_container "corelia-nginx" "false"

  check_api_status
  check_collab_websocket_variants
  check_auth_enforcement

  check_migrations
  check_schema_columns

  echo
  echo "Resumen: OK=${PASS_COUNT} WARN=${WARN_COUNT} FAIL=${FAIL_COUNT}"

  if [[ "${FAIL_COUNT}" -gt 0 ]]; then
    echo "Resultado: PRECHECK FALLÓ"
    exit 1
  fi

  echo "Resultado: PRECHECK OK"
}

main "$@"
