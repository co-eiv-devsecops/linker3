#!/usr/bin/env bash
# Abre un túnel SSH hacia una IP privada de OCI a través de OCI Bastion
# (sesión port-forwarding). Es lo que permite que el runner de GitHub Actions
# llegue a la instancia green (sin IP pública) para healthchecks y pruebas.
#
# Variables de entorno:
#   BASTION_OCID          (requerida) OCID del bastion del curso
#   TARGET_IP             (requerida) IP privada de la instancia destino
#   SSH_PRIVATE_KEY_FILE  (requerida) llave privada para la sesión
#   SSH_PUBLIC_KEY_FILE   (requerida) llave pública para la sesión
#   TARGET_PORT           (default 80)   puerto remoto a exponer
#   LOCAL_PORT            (default 8080) puerto local del túnel
#   SESSION_TTL           (default 1800) vida de la sesión bastion (s)
#   TUNNEL_PID_FILE       (default tunnel.pid) dónde guardar el PID del ssh
#
# El PID del proceso ssh queda en TUNNEL_PID_FILE para que el workflow lo
# mate en un paso `if: always()`. La sesión bastion expira sola por TTL.
set -euo pipefail

: "${BASTION_OCID:?Falta BASTION_OCID}"
: "${TARGET_IP:?Falta TARGET_IP}"
: "${SSH_PRIVATE_KEY_FILE:?Falta SSH_PRIVATE_KEY_FILE}"
: "${SSH_PUBLIC_KEY_FILE:?Falta SSH_PUBLIC_KEY_FILE}"
TARGET_PORT="${TARGET_PORT:-80}"
LOCAL_PORT="${LOCAL_PORT:-8080}"
SESSION_TTL="${SESSION_TTL:-1800}"
TUNNEL_PID_FILE="${TUNNEL_PID_FILE:-tunnel.pid}"

echo "Creando sesión port-forwarding en bastion hacia ${TARGET_IP}:${TARGET_PORT}..."
SESSION_ID="$(oci bastion session create-port-forwarding \
  --bastion-id "$BASTION_OCID" \
  --target-private-ip "$TARGET_IP" \
  --target-port "$TARGET_PORT" \
  --ssh-public-key-file "$SSH_PUBLIC_KEY_FILE" \
  --session-ttl "$SESSION_TTL" \
  --display-name "bg-${TARGET_PORT}-$(date +%s)" \
  --query 'data.id' --raw-output)"
echo "Sesión creada: $SESSION_ID"

for i in $(seq 1 30); do
  STATE="$(oci bastion session get --session-id "$SESSION_ID" \
    --query 'data."lifecycle-state"' --raw-output)"
  [ "$STATE" = "ACTIVE" ] && break
  if [ "$STATE" = "FAILED" ] || [ "$STATE" = "DELETED" ]; then
    echo "::error::La sesión bastion terminó en estado $STATE" >&2
    exit 1
  fi
  echo "  sesión en estado $STATE (intento $i/30)..."
  sleep 5
done
if [ "$STATE" != "ACTIVE" ]; then
  echo "::error::La sesión bastion no llegó a ACTIVE a tiempo" >&2
  exit 1
fi

# El host del bastion viene en el comando ssh sugerido por OCI
# (ocid...@host.bastion.<region>.oci.oraclecloud.com); lo extraemos de ahí
# para no armar el hostname a mano por región.
SSH_COMMAND="$(oci bastion session get --session-id "$SESSION_ID" \
  --query 'data."ssh-metadata".command' --raw-output)"
BASTION_HOST="$(echo "$SSH_COMMAND" | grep -oE '@[a-zA-Z0-9.-]+' | head -1 | tr -d '@')"
if [ -z "$BASTION_HOST" ]; then
  echo "::error::No se pudo extraer el host del bastion desde ssh-metadata" >&2
  exit 1
fi

echo "Levantando túnel 127.0.0.1:${LOCAL_PORT} -> ${TARGET_IP}:${TARGET_PORT} vía ${BASTION_HOST}..."
ssh -i "$SSH_PRIVATE_KEY_FILE" \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ServerAliveInterval=30 \
  -o ExitOnForwardFailure=yes \
  -N -L "${LOCAL_PORT}:${TARGET_IP}:${TARGET_PORT}" \
  -p 22 "${SESSION_ID}@${BASTION_HOST}" &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > "$TUNNEL_PID_FILE"

sleep 3
if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
  echo "::error::El proceso ssh del túnel murió al arrancar" >&2
  exit 1
fi
echo "Túnel activo (pid $TUNNEL_PID, pidfile $TUNNEL_PID_FILE)"
