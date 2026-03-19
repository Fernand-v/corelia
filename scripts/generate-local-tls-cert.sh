#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/docker/nginx/certs-local"
CERT_PATH="$CERT_DIR/corelia.crt"
KEY_PATH="$CERT_DIR/corelia.key"

mkdir -p "$CERT_DIR"

# Collect all non-loopback IPv4 addresses on this machine
mapfile -t LAN_IPS < <(hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.' | grep -v '^127\.' | sort -u)

# Build SAN entries dynamically
ALT_NAMES="DNS.1 = localhost\n"
ALT_NAMES+="DNS.2 = *.local\n"
ALT_NAMES+="IP.1 = 127.0.0.1\n"
ALT_NAMES+="IP.2 = ::1\n"

IP_INDEX=3
for ip in "${LAN_IPS[@]}"; do
  ALT_NAMES+="IP.${IP_INDEX} = ${ip}\n"
  ((IP_INDEX++))
done

# Generate ephemeral OpenSSL config with detected IPs
OPENSSL_CONFIG=$(mktemp)
trap 'rm -f "$OPENSSL_CONFIG"' EXIT

cat > "$OPENSSL_CONFIG" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
$(printf '%b' "$ALT_NAMES")
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_PATH" \
  -out "$CERT_PATH" \
  -days 365 \
  -config "$OPENSSL_CONFIG" \
  -extensions v3_req

chmod 600 "$KEY_PATH"

printf 'Generated:\n  %s\n  %s\n\nSAN entries:\n' "$CERT_PATH" "$KEY_PATH"
openssl x509 -in "$CERT_PATH" -noout -ext subjectAltName 2>/dev/null | sed 's/^/  /'
