#!/usr/bin/env bash
# Identifica qué instancia está recibiendo el tráfico de producción AHORA:
# resuelve la cadena IP pública reservada -> private IP -> VNIC -> instancia.
# El pipeline lo usa antes del switchover (para saber cuál es la "blue") y
# en la limpieza (para no destruir jamás la instancia activa).
#
# Variables de entorno:
#   RESERVED_PUBLIC_IP_OCID (requerida) OCID de la IP pública reservada de prod
#   COMPARTMENT_OCID        (requerida) compartment donde viven las instancias
#
# Emite KEY=value por stdout y, si existe $GITHUB_OUTPUT, también ahí:
#   active_private_ip_ocid, active_private_ip, active_vnic_id,
#   active_instance_id, active_display_name
set -euo pipefail

: "${RESERVED_PUBLIC_IP_OCID:?Falta RESERVED_PUBLIC_IP_OCID}"
: "${COMPARTMENT_OCID:?Falta COMPARTMENT_OCID}"

PUBLIC_IP_JSON="$(oci network public-ip get --public-ip-id "$RESERVED_PUBLIC_IP_OCID")"
ENTITY_TYPE="$(echo "$PUBLIC_IP_JSON" | jq -r '.data."assigned-entity-type" // empty')"
PRIVATE_IP_OCID="$(echo "$PUBLIC_IP_JSON" | jq -r '.data."assigned-entity-id" // empty')"

if [ "$ENTITY_TYPE" != "PRIVATE_IP" ] || [ -z "$PRIVATE_IP_OCID" ]; then
  echo "::error::La IP pública reservada no está asignada a una PRIVATE_IP (tipo: '${ENTITY_TYPE:-ninguno}')" >&2
  exit 1
fi

PRIVATE_IP_JSON="$(oci network private-ip get --private-ip-id "$PRIVATE_IP_OCID")"
VNIC_ID="$(echo "$PRIVATE_IP_JSON" | jq -r '.data."vnic-id"')"
PRIVATE_IP_ADDR="$(echo "$PRIVATE_IP_JSON" | jq -r '.data."ip-address"')"

INSTANCE_ID="$(oci compute vnic-attachment list --compartment-id "$COMPARTMENT_OCID" --all \
  | jq -r --arg vnic "$VNIC_ID" \
    '.data[] | select(."vnic-id" == $vnic and ."lifecycle-state" == "ATTACHED") | ."instance-id"' \
  | head -1)"

if [ -z "$INSTANCE_ID" ]; then
  echo "::error::No se encontró instancia con la VNIC $VNIC_ID en el compartment" >&2
  exit 1
fi

DISPLAY_NAME="$(oci compute instance get --instance-id "$INSTANCE_ID" \
  --query 'data."display-name"' --raw-output)"

emit() {
  echo "$1=$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

emit active_private_ip_ocid "$PRIVATE_IP_OCID"
emit active_private_ip "$PRIVATE_IP_ADDR"
emit active_vnic_id "$VNIC_ID"
emit active_instance_id "$INSTANCE_ID"
emit active_display_name "$DISPLAY_NAME"
