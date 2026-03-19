#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/pkcs11"
MODULES_DIR="$CONFIG_DIR/modules"
SOURCE_MODULE="/usr/share/p11-kit/modules/p11-kit-trust.module"
CONFIG_FILE="$CONFIG_DIR/pkcs11.conf"
TARGET_MODULE="$MODULES_DIR/p11-kit-trust.module"

mkdir -p "$MODULES_DIR"

cat >"$CONFIG_FILE" <<'EOF'
user-config: merge
EOF

cp "$SOURCE_MODULE" "$TARGET_MODULE"

printf 'Configured user PKCS#11 trust store:\n- %s\n- %s\n' "$CONFIG_FILE" "$TARGET_MODULE"
