#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-corelia-postgres}"
API_CONTAINER="${API_CONTAINER:-corelia-api}"
API_BASE="${API_BASE:-http://localhost:4000/api/v1}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-corelia}"
POSTGRES_DB="${POSTGRES_DB:-corelia}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: falta comando requerido: $1"
    exit 1
  fi
}

ensure_container_running() {
  local container_name="$1"
  local compose_service="$2"
  if docker ps --format '{{.Names}}' | grep -qx "${container_name}"; then
    return 0
  fi

  echo "Levantando servicio ${compose_service}..."
  docker compose -f "${COMPOSE_FILE}" up -d "${compose_service}"
}

wait_for_postgres() {
  echo "Esperando PostgreSQL..."
  local i
  for i in $(seq 1 40); do
    if docker exec "${POSTGRES_CONTAINER}" sh -lc "psql -U '${POSTGRES_USER}' -d '${POSTGRES_DB}' -c 'select 1' >/dev/null 2>&1"; then
      echo "PostgreSQL OK"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: PostgreSQL no respondió a tiempo."
  return 1
}

wait_for_api() {
  local api_root
  api_root="$(echo "${API_BASE}" | sed -E 's#/api/v1/?$##')"
  local status_url="${api_root}/status"
  echo "Esperando API (${status_url})..."

  local i
  for i in $(seq 1 40); do
    if curl -fsS "${status_url}" >/dev/null 2>&1; then
      echo "API OK"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: API no respondió a tiempo."
  return 1
}

has_user_table() {
  local result
  result="$(
    docker exec "${POSTGRES_CONTAINER}" sh -lc \
      "psql -U '${POSTGRES_USER}' -d '${POSTGRES_DB}' -tA -c \"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User');\""
  )"
  [[ "${result}" == "t" ]]
}

apply_sql_migrations_if_needed() {
  if has_user_table; then
    echo "La tabla public.User ya existe. Se omiten migraciones SQL."
    return 0
  fi

  echo "No existe public.User. Aplicando migraciones SQL..."
  local migration_dir
  for migration_dir in "${ROOT_DIR}"/apps/api/prisma/migrations/*; do
    [[ -d "${migration_dir}" ]] || continue
    [[ -f "${migration_dir}/migration.sql" ]] || continue

    echo " - $(basename "${migration_dir}")"
    docker exec -i "${POSTGRES_CONTAINER}" \
      psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
      < "${migration_dir}/migration.sql"
  done
  echo "Migraciones SQL aplicadas."
}

main() {
  require_cmd docker
  require_cmd curl

  ensure_container_running "${POSTGRES_CONTAINER}" "postgres"
  ensure_container_running "${API_CONTAINER}" "api"

  wait_for_postgres
  apply_sql_migrations_if_needed
  wait_for_api

  echo "Creando solicitudes de registro por defecto..."
  API_BASE="${API_BASE}" "${SCRIPT_DIR}/create-default-users.sh"
  echo "Bootstrap completado."
}

main "$@"
