#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/docker/nginx/certs-local"
OPENSSL_CONFIG="$ROOT_DIR/docker/nginx/openssl-local.cnf"
CERT_PATH="$CERT_DIR/corelia.crt"
KEY_PATH="$CERT_DIR/corelia.key"

mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_PATH" \
  -out "$CERT_PATH" \
  -days 365 \
  -config "$OPENSSL_CONFIG" \
  -extensions v3_req

chmod 600 "$KEY_PATH"

printf 'Generated:\n- %s\n- %s\n' "$CERT_PATH" "$KEY_PATH"
