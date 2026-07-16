#!/usr/bin/env bash
# Ejecuta un comando en una instancia privada de OCI vía bastion: abre un
# túnel al puerto 22 con open_tunnel.sh, corre el comando por SSH como el
# usuario ubuntu, y cierra el túnel. Se usa, por ejemplo, para emitir el
# certificado TLS (certbot) en la instancia green tras el switchover.
#
# Variables de entorno (las mismas de open_tunnel.sh, más):
#   BASTION_OCID, TARGET_IP, SSH_PRIVATE_KEY_FILE, SSH_PUBLIC_KEY_FILE (requeridas)
#   REMOTE_USER   (default ubuntu)
#   LOCAL_PORT    (default 2222) puerto local del túnel SSH
#
# Uso: run_remote.sh "<comando remoto>"
set -euo pipefail

: "${1:?Uso: run_remote.sh \"<comando remoto>\"}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
LOCAL_PORT="${LOCAL_PORT:-2222}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PID_FILE="$(mktemp)"
cleanup() {
  if [ -s "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}
trap cleanup EXIT

TARGET_PORT=22 LOCAL_PORT="$LOCAL_PORT" TUNNEL_PID_FILE="$PID_FILE" \
  bash "$SCRIPT_DIR/open_tunnel.sh"

echo "Ejecutando comando remoto en ${TARGET_IP} como ${REMOTE_USER}..."
ssh -i "$SSH_PRIVATE_KEY_FILE" \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=15 \
  -p "$LOCAL_PORT" "${REMOTE_USER}@127.0.0.1" "$1"
