#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ALLOWLIST_FILE="${ROOT_DIR}/scripts/unsafe-casts-allowlist.txt"

if [[ ! -f "${ALLOWLIST_FILE}" ]]; then
  echo "[FAIL] Missing allowlist: ${ALLOWLIST_FILE}"
  echo "Run: bash scripts/check-unsafe-casts.sh --update"
  exit 1
fi

tmp_file="$(mktemp)"
cleanup() {
  rm -f "${tmp_file}"
}
trap cleanup EXIT

collect_matches() {
  {
    rg -n --no-heading "as never|as unknown as" \
      "${ROOT_DIR}/apps/api/src" \
      "${ROOT_DIR}/apps/workers/src" \
      "${ROOT_DIR}/apps/web/app" \
      "${ROOT_DIR}/apps/web/components" \
      "${ROOT_DIR}/apps/web/lib" \
      -g'!**/*.spec.ts' \
      -g'!**/*.spec.tsx' \
      -g'!**/node_modules/**' \
      -g'!**/.next/**' \
      || true
  } | sed "s#${ROOT_DIR}/##" | sort
}

if [[ "${1:-}" == "--update" ]]; then
  collect_matches > "${ALLOWLIST_FILE}"
  echo "[OK] Updated ${ALLOWLIST_FILE}"
  exit 0
fi

collect_matches > "${tmp_file}"

if ! diff -u "${ALLOWLIST_FILE}" "${tmp_file}"; then
  echo "[FAIL] Found new unsafe casts in runtime code."
  echo "Review changes above or run: bash scripts/check-unsafe-casts.sh --update"
  exit 1
fi

echo "[OK] Unsafe cast baseline unchanged"
