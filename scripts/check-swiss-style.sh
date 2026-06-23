#!/usr/bin/env bash
# Guardarraíl del sistema "Swiss editorial": impide reintroducir la estética
# glass/macOS o paletas de color fuera de los tokens Swiss en el frontend.
#
# Prohíbe en apps/web (components, app) y packages/ui/src:
#   - bg-white/NN (superficies translúcidas glass)
#   - backdrop-blur* (desenfoque)
#   - glass-border (token heredado)
#   - utilidades de color de la paleta Tailwind (text/bg/border-…-<n>)
#   - utilidades de color con hex arbitrario (text/bg/border-[#…])
#   - el acento azul legacy (#0a84ff)
#
# Usa tokens Swiss: ink, mid, faint, line, paper, urgent (+ accent remapeado).
# Allowlist: superficies oscuras de videollamada (overlay sobre vídeo).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SCAN_DIRS=(
  "${ROOT_DIR}/apps/web/components"
  "${ROOT_DIR}/apps/web/app"
  "${ROOT_DIR}/packages/ui/src"
)

PALETTE="slate|gray|zinc|neutral|stone|red|rose|emerald|green|teal|lime|amber|yellow|orange|indigo|violet|blue|sky|cyan|purple|fuchsia|pink"
PATTERN="bg-white/[0-9]|backdrop-blur|glass-border|(text|bg|border|divide|ring)-(${PALETTE})-[0-9]+|(text|bg|border|ring|from|to|via)-\[#[0-9a-fA-F]{3,8}\]|0a84ff"

# Superficies oscuras especiales (videollamada): translucidez sobre vídeo es UX legítima.
ALLOWLIST='/(meeting-call-room|incoming-call-overlay)\.tsx'

hits="$(grep -rnE "${PATTERN}" "${SCAN_DIRS[@]}" \
  --include='*.tsx' --include='*.ts' 2>/dev/null \
  | grep -vE '\.spec\.' \
  | grep -vE "${ALLOWLIST}" || true)"

if [ -n "${hits}" ]; then
  echo "[FAIL] Estética no-Swiss detectada (usa tokens ink/mid/faint/line/paper/urgent):"
  echo "${hits}"
  echo ""
  echo "Si es una superficie oscura especial nueva, añádela a la allowlist del script."
  exit 1
fi

echo "[OK] Frontend conforme al sistema Swiss (sin glass/blur ni paletas de color)."
