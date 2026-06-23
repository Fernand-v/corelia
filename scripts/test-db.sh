#!/usr/bin/env bash
# Ejecuta la suite de integración con DB real:
#   1. Levanta un Postgres efímero (docker compose test).
#   2. Aplica migraciones y corre los *.dbtest.spec.ts contra esa DB.
#   3. Derriba el contenedor pase lo que pase.
#
# Uso: pnpm test:db
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.test.yml"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://corelia_test:corelia_test@localhost:5433/corelia_test?schema=public}"

cleanup() {
  docker compose -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[test:db] Levantando Postgres de pruebas..."
docker compose -f "${COMPOSE_FILE}" up -d --wait

echo "[test:db] Ejecutando suite de integración con DB real..."
corepack pnpm --filter @corelia/api test:db
