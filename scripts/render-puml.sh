#!/usr/bin/env bash
set -euo pipefail

if ! command -v plantuml >/dev/null 2>&1; then
  echo "plantuml no está instalado en PATH."
  echo "Instala PlantUML para generar SVG/PNG desde docs/db/puml/*.puml."
  exit 1
fi

plantuml -tsvg docs/db/puml/*.puml
plantuml -tpng docs/db/puml/*.puml

echo "Diagramas renderizados en docs/db/puml"
