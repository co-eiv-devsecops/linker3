#!/usr/bin/env bash
# Empaqueta Linker como artefacto serverless (AWS Lambda).
#
# Genera linker-serverless.zip con el MISMO artefacto que corre en la VM de
# OCI (dist/ compilado con tsc + public/ + dependencias de producción), de
# modo que ambos objetivos de despliegue de PROD comparten build. El handler
# de Lambda es dist/serverless/aws.handler (ver src/serverless/aws.ts).
#
# Uso:
#   bash infra/scripts/package-serverless.sh [salida.zip]
#
# Requiere: node >= 22, npm, zip.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_ZIP="${1:-${REPO_ROOT}/linker-serverless.zip}"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "${STAGE_DIR}"' EXIT

cd "${REPO_ROOT}"

echo "==> Compilando artefacto (tsc -p tsconfig.build.json)"
npm run build

echo "==> Preparando contenido del paquete"
cp -r dist public package.json package-lock.json "${STAGE_DIR}/"

echo "==> Instalando dependencias de producción"
(cd "${STAGE_DIR}" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
rm -f "${STAGE_DIR}/package-lock.json"

echo "==> Generando ${OUT_ZIP}"
rm -f "${OUT_ZIP}"
(cd "${STAGE_DIR}" && zip -qr "${OUT_ZIP}" .)

echo "==> Paquete listo: ${OUT_ZIP} ($(du -h "${OUT_ZIP}" | cut -f1))"
