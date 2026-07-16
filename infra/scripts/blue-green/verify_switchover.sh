#!/usr/bin/env bash
# Verificación post-switchover: confirma en el plano de control de OCI que la
# IP pública reservada apunta a la private IP esperada, y en el plano de datos
# que la URL pública de producción responde 200.
#
# Variables de entorno:
#   RESERVED_PUBLIC_IP_OCID  (requerida) OCID de la IP pública reservada
#   EXPECTED_PRIVATE_IP_OCID (requerida) private IP que DEBE tener el tráfico
#   VERIFY_URL               (requerida) p. ej. https://3.n-la-c.app/health
#   ATTEMPTS                 (default 30) reintentos del check HTTP
#   SLEEP_SECONDS            (default 5)  espera entre reintentos
set -euo pipefail

: "${RESERVED_PUBLIC_IP_OCID:?Falta RESERVED_PUBLIC_IP_OCID}"
: "${EXPECTED_PRIVATE_IP_OCID:?Falta EXPECTED_PRIVATE_IP_OCID}"
: "${VERIFY_URL:?Falta VERIFY_URL}"
ATTEMPTS="${ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"

ASSIGNED="$(oci network public-ip get --public-ip-id "$RESERVED_PUBLIC_IP_OCID" \
  --query 'data."assigned-entity-id"' --raw-output)"
if [ "$ASSIGNED" != "$EXPECTED_PRIVATE_IP_OCID" ]; then
  echo "::error::La IP pública reservada apunta a '$ASSIGNED', se esperaba '$EXPECTED_PRIVATE_IP_OCID'" >&2
  exit 1
fi
echo "Plano de control OK: la IP pública reservada apunta a la instancia esperada."

echo "Verificando ${VERIFY_URL}..."
for i in $(seq 1 "$ATTEMPTS"); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$VERIFY_URL" || true)"
  if [ "$CODE" = "200" ]; then
    echo "Plano de datos OK: HTTP 200 en el intento $i. El tráfico llega a la instancia esperada."
    exit 0
  fi
  echo "  intento $i/$ATTEMPTS: HTTP ${CODE:-000}, reintentando en ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done

echo "::error::${VERIFY_URL} nunca respondió 200 tras el switchover" >&2
exit 1
