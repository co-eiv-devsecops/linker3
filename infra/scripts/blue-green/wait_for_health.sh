#!/usr/bin/env bash
# Espera a que una instancia de Linker responda 200 en su healthcheck.
# Los primeros minutos tras crear la VM el cloud-init todavía está
# instalando Node/nginx, así que los reintentos son largos por diseño.
#
# Variables de entorno:
#   HEALTH_URL      (requerida) p. ej. http://127.0.0.1:8080/health
#   ATTEMPTS        (default 60) reintentos
#   SLEEP_SECONDS   (default 10) espera entre reintentos
set -euo pipefail

: "${HEALTH_URL:?Falta HEALTH_URL}"
ATTEMPTS="${ATTEMPTS:-60}"
SLEEP_SECONDS="${SLEEP_SECONDS:-10}"

echo "Esperando 200 de ${HEALTH_URL} (hasta $((ATTEMPTS * SLEEP_SECONDS))s)..."
for i in $(seq 1 "$ATTEMPTS"); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)"
  if [ "$CODE" = "200" ]; then
    echo "Healthcheck OK en el intento $i (HTTP $CODE)"
    exit 0
  fi
  echo "  intento $i/$ATTEMPTS: HTTP ${CODE:-000}, reintentando en ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done

echo "::error::La instancia nunca respondió 200 en ${HEALTH_URL}" >&2
exit 1
