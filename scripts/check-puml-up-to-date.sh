#!/usr/bin/env bash
set -euo pipefail

corepack pnpm run db:diagram:puml

if ! git diff --quiet -- docs/db/puml; then
  echo "PUML desactualizado respecto al esquema Prisma."
  echo "Ejecuta: corepack pnpm run db:diagram:puml"
  git --no-pager diff -- docs/db/puml
  exit 1
fi

echo "PUML sincronizado con schema.prisma"
