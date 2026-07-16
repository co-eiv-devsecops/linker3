#!/usr/bin/env bash
# Termina una instancia OCI del blue/green con salvaguardas:
#   - se niega a terminar la instancia que está recibiendo tráfico
#     (ACTIVE_INSTANCE_OCID, obtenido con lookup_active_instance.sh)
#   - se niega si el display-name no empieza por el prefijo esperado
#     (evita apuntar por error a una VM ajena del compartment)
#   - es idempotente: si ya está TERMINATED/TERMINATING, sale 0
#
# Variables de entorno:
#   INSTANCE_OCID        (requerida) instancia a terminar
#   ACTIVE_INSTANCE_OCID (opcional, MUY recomendada) instancia con tráfico
#   EXPECTED_NAME_PREFIX (default "linker") prefijo exigido del display-name
#   MAX_WAIT_SECONDS     (default 900) espera máxima a TERMINATED
set -euo pipefail

: "${INSTANCE_OCID:?Falta INSTANCE_OCID}"
EXPECTED_NAME_PREFIX="${EXPECTED_NAME_PREFIX:-linker}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-900}"

if [ -n "${ACTIVE_INSTANCE_OCID:-}" ] && [ "$INSTANCE_OCID" = "$ACTIVE_INSTANCE_OCID" ]; then
  echo "::error::BLOQUEADO: $INSTANCE_OCID es la instancia que está sirviendo el tráfico de producción. No se termina." >&2
  exit 1
fi

INSTANCE_JSON="$(oci compute instance get --instance-id "$INSTANCE_OCID")"
DISPLAY_NAME="$(echo "$INSTANCE_JSON" | jq -r '.data."display-name"')"
STATE="$(echo "$INSTANCE_JSON" | jq -r '.data."lifecycle-state"')"

case "$STATE" in
  TERMINATED|TERMINATING)
    echo "La instancia $DISPLAY_NAME ya está en estado $STATE; nada que hacer."
    exit 0
    ;;
esac

case "$DISPLAY_NAME" in
  "$EXPECTED_NAME_PREFIX"*) ;;
  *)
    echo "::error::BLOQUEADO: display-name '$DISPLAY_NAME' no empieza por '$EXPECTED_NAME_PREFIX'. No se termina por seguridad." >&2
    exit 1
    ;;
esac

echo "Terminando instancia $DISPLAY_NAME ($INSTANCE_OCID)..."
oci compute instance terminate \
  --instance-id "$INSTANCE_OCID" \
  --preserve-boot-volume false \
  --force \
  --wait-for-state TERMINATED \
  --max-wait-seconds "$MAX_WAIT_SECONDS"
echo "Instancia $DISPLAY_NAME terminada."
