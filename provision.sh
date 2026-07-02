#!/bin/bash
# Provisiona una VM Ubuntu 22.04+ para Linker.
# Copia exacta del script embebido en cloud-init.yaml (bajo write_files) — se
# mantiene también aquí, suelto, para poder probarlo con `bash provision.sh`
# sin tener que levantar una VM real. Si edita uno, sincronice el otro.
set -euo pipefail

REPO="https://github.com/co-eiv-devsecops/linker3.git"
APP_DIR="/opt/linker"
BASE_URL="https://3.n-la-c.app"

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO" "$APP_DIR"
fi
chown -R ubuntu:ubuntu "$APP_DIR"

printf "PORT=3000\nBASE_URL=%s\n" "$BASE_URL" > "$APP_DIR/.env"
chown ubuntu:ubuntu "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

systemctl daemon-reload
systemctl enable linker
systemctl restart linker

ln -sf /etc/nginx/sites-available/linker /etc/nginx/sites-enabled/linker
rm -f /etc/nginx/sites-enabled/default
systemctl enable nginx
systemctl restart nginx

# TLS no se automatiza aquí: certbot requiere que el dominio ya resuelva a esta IP.
# Ejecutar manualmente tras el primer arranque: certbot --nginx -d 3.n-la-c.app
