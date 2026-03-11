#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api/v1}"

create_user() {
  local email="$1"
  local first_name="$2"
  local last_name="$3"

  local payload
  payload=$(cat <<JSON
{"email":"${email}","firstName":"${first_name}","lastName":"${last_name}","message":"Solicitud inicial de bootstrap"}
JSON
)

  local response_file
  response_file="$(mktemp)"

  local status
  status=$(
    curl -sS -o "${response_file}" -w "%{http_code}" \
      -X POST "${API_BASE}/auth/register-request" \
      -H "Content-Type: application/json" \
      --data "${payload}" || true
  )

  local body
  body="$(cat "${response_file}")"
  rm -f "${response_file}"

  if [[ "${status}" == "201" ]]; then
    echo "OK: solicitud de registro creada -> ${email}"
    return 0
  fi

  if [[ "${status}" == "400" ]] && (grep -qi "ya existe" <<<"${body}" || grep -qi "pendiente" <<<"${body}"); then
    echo "SKIP: solicitud existente o email en uso -> ${email}"
    return 0
  fi

  echo "ERROR: no se pudo crear solicitud para ${email} (HTTP ${status})"
  echo "Detalle: ${body}"
  return 1
}

echo "API_BASE=${API_BASE}"
echo "Generando solicitudes de registro por defecto..."

create_user "admin2@corelia.local" "Admin2" "Corelia"
create_user "admin@corelia.local" "Admin" "Corelia"

echo "Proceso finalizado. Un administrador debe aprobar las solicitudes."
