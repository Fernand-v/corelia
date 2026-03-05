#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api/v1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_KEY="${API_KEY:-}"

if [[ -z "${API_KEY}" && -f "${ROOT_DIR}/.env" ]]; then
  API_KEY="$(grep -E '^API_KEY=' "${ROOT_DIR}/.env" | tail -n1 | cut -d'=' -f2- | tr -d '\r' || true)"
fi

if [[ -z "${API_KEY}" ]]; then
  echo "ERROR: API_KEY no está definida. Exporta API_KEY o configúrala en .env"
  exit 1
fi

create_user() {
  local email="$1"
  local first_name="$2"
  local last_name="$3"
  local password="$4"
  local base_role="$5"

  local payload
  payload=$(cat <<JSON
{"email":"${email}","firstName":"${first_name}","lastName":"${last_name}","password":"${password}","baseRole":"${base_role}"}
JSON
)

  local response_file
  response_file="$(mktemp)"

  local status
  status=$(
    curl -sS -o "${response_file}" -w "%{http_code}" \
      -X POST "${API_BASE}/auth/register" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${API_KEY}" \
      --data "${payload}" || true
  )

  local body
  body="$(cat "${response_file}")"
  rm -f "${response_file}"

  if [[ "${status}" == "201" ]]; then
    echo "OK: usuario creado -> ${email}"
    return 0
  fi

  if [[ "${status}" == "400" ]] && grep -qi "El email ya existe" <<<"${body}"; then
    echo "SKIP: usuario ya existe -> ${email}"
    return 0
  fi

  echo "ERROR: no se pudo crear ${email} (HTTP ${status})"
  echo "Detalle: ${body}"
  return 1
}

echo "API_BASE=${API_BASE}"
echo "API_KEY=***"
echo "Creando usuarios por defecto..."

create_user "admin2@corelia.local" "Admin2" "Corelia" "Corelia2026Secure" "ADMINISTRADOR"
create_user "admin@corelia.local" "Admin" "Corelia" "Admin12345!" "ADMINISTRADOR"

echo "Proceso finalizado."
