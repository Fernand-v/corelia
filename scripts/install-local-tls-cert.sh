#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_PATH="$ROOT_DIR/docker/nginx/certs-local/corelia.crt"
TARGET_PATH="/usr/local/share/ca-certificates/corelia-localhost.crt"

if [[ ! -f "$CERT_PATH" ]]; then
  echo "Certificate not found: $CERT_PATH" >&2
  echo "Run 'bash scripts/generate-local-tls-cert.sh' first." >&2
  exit 1
fi

sudo cp "$CERT_PATH" "$TARGET_PATH"
sudo update-ca-certificates

echo "Installed trusted local certificate at $TARGET_PATH"
