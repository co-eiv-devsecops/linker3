#!/usr/bin/env bash
# Switchover real de tráfico del blue/green: mueve la IP pública reservada
# de producción (la que resuelve el DNS de 3.n-la-c.app) hacia la private IP
# de la instancia destino. Es atómico a nivel de OCI y no toca DNS.
#
# Variables de entorno:
#   RESERVED_PUBLIC_IP_OCID (requerida) OCID de la IP pública reservada
#   TARGET_PRIVATE_IP_OCID  (requerida) OCID de la private IP destino (green,
#                           o blue si esto se invoca como rollback)
#   ATTEMPTS                (default 30) reintentos de confirmación
#   SLEEP_SECONDS           (default 3)  espera entre reintentos
set -euo pipefail

: "${RESERVED_PUBLIC_IP_OCID:?Falta RESERVED_PUBLIC_IP_OCID}"
: "${TARGET_PRIVATE_IP_OCID:?Falta TARGET_PRIVATE_IP_OCID}"
ATTEMPTS="${ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"

CURRENT="$(oci network public-ip get --public-ip-id "$RESERVED_PUBLIC_IP_OCID" \
  --query 'data."assigned-entity-id"' --raw-output || true)"
if [ "$CURRENT" = "$TARGET_PRIVATE_IP_OCID" ]; then
  echo "La IP pública reservada ya apunta al destino; nada que hacer."
  exit 0
fi

echo "Moviendo IP pública reservada -> $TARGET_PRIVATE_IP_OCID ..."
oci network public-ip update \
  --public-ip-id "$RESERVED_PUBLIC_IP_OCID" \
  --private-ip-id "$TARGET_PRIVATE_IP_OCID" > /dev/null

for i in $(seq 1 "$ATTEMPTS"); do
  ASSIGNED="$(oci network public-ip get --public-ip-id "$RESERVED_PUBLIC_IP_OCID" \
    --query 'data."assigned-entity-id"' --raw-output || true)"
  if [ "$ASSIGNED" = "$TARGET_PRIVATE_IP_OCID" ]; then
    echo "Switchover confirmado en el intento $i."
    exit 0
  fi
  echo "  intento $i/$ATTEMPTS: aún asignada a ${ASSIGNED:-nada}, reintentando en ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done

echo "::error::OCI nunca confirmó la reasignación de la IP pública reservada" >&2
exit 1
