#!/bin/bash
# Uso: bash infra/scripts/deploy.sh (ejecutar desde la raíz del repo)
# Prerequisito: VM provisionada con cloud-init.yaml

set -e

KEY=".ssh/linkervm-3.key"
USER="ubuntu"
HOST="10.0.69.233"
APP_DIR="/opt/linker"

echo "=== Actualizando código en la VM ==="
ssh -i "$KEY" "$USER@$HOST" "cd $APP_DIR && git pull"

echo "=== Instalando dependencias ==="
ssh -i "$KEY" "$USER@$HOST" "cd $APP_DIR && npm ci --omit=dev --ignore-scripts"

echo "=== Reiniciando servicio ==="
ssh -i "$KEY" "$USER@$HOST" "sudo systemctl restart linker"

echo "=== Estado del servicio ==="
ssh -i "$KEY" "$USER@$HOST" "sudo systemctl status linker --no-pager -l"

echo "=== Listo! Accede en https://3.n-la-c.app ==="
