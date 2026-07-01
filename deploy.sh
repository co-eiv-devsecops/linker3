#!/bin/bash
# Uso: bash deploy.sh
# Despliega o actualiza Linker en la VM de Oracle Cloud.

KEY=".ssh/linkervm-3.key"
USER="ubuntu"
HOST="10.0.69.233"
REMOTE_DIR="/home/ubuntu/dummy"

echo "=== Copiando archivos a la VM ==="
scp -i "$KEY" server.js "$USER@$HOST:$REMOTE_DIR/server.js"
scp -i "$KEY" public/index.html "$USER@$HOST:$REMOTE_DIR/public/index.html"
scp -i "$KEY" package.json "$USER@$HOST:$REMOTE_DIR/package.json"

echo "=== Reiniciando servicio ==="
ssh -i "$KEY" "$USER@$HOST" "sudo systemctl restart linker"

echo "=== Listo! Accede en https://3.n-la-c.app ==="
