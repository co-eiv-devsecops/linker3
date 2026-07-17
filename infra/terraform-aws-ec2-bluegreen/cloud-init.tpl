#cloud-config
# Provisiona una VM Ubuntu 22.04+ para el blue/green de EC2. Variante de
# ../../cloud-init.yaml (usado por la VM de OCI) con BASE_URL parametrizado
# vía templatefile() -- cada instancia blue/green necesita apuntar a la IP
# elástica compartida, no a un dominio fijo.

package_update: true
package_upgrade: false

packages:
  - nginx
  - git
  - curl

write_files:
  - path: /etc/systemd/system/linker.service
    content: |
      [Unit]
      Description=Linker URL Shortener
      After=network.target

      [Service]
      Type=simple
      User=ubuntu
      WorkingDirectory=/opt/linker
      EnvironmentFile=/opt/linker/.env
      ExecStart=/usr/bin/node src/main.ts
      Restart=on-failure
      RestartSec=5

      [Install]
      WantedBy=multi-user.target

  - path: /etc/nginx/sites-available/linker
    content: |
      server {
          listen 80;
          server_name _;

          location / {
              proxy_pass http://localhost:8080;
              proxy_http_version 1.1;
              proxy_set_header Host              $host;
              proxy_set_header X-Real-IP         $remote_addr;
              proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
              proxy_set_header X-Forwarded-Proto $scheme;
          }
      }

  - path: /opt/provision.sh
    permissions: "0755"
    content: |
      #!/bin/bash
      set -euo pipefail

      REPO="${repo_url}"
      APP_DIR="/opt/linker"
      BASE_URL="${base_url}"

      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs

      if [ -d "$APP_DIR/.git" ]; then
        git -C "$APP_DIR" pull
      else
        git clone "$REPO" "$APP_DIR"
      fi
      chown -R ubuntu:ubuntu "$APP_DIR"

      # La app tiene dependencias de runtime reales (OTel, LaunchDarkly, mysql2).
      cd "$APP_DIR"
      sudo -u ubuntu npm ci --omit=dev --ignore-scripts

      printf "PORT=8080\nBASE_URL=%s\nOTEL_SERVICE_NAME=%s\nOTEL_EXPORTER_OTLP_ENDPOINT=%s\nOTEL_EXPORTER_OTLP_HEADERS=%s\n" \
        "$BASE_URL" "${otel_service_name}" "${otel_exporter_otlp_endpoint}" "${otel_exporter_otlp_headers}" > "$APP_DIR/.env"
      chown ubuntu:ubuntu "$APP_DIR/.env"
      chmod 600 "$APP_DIR/.env"

      systemctl daemon-reload
      systemctl enable linker
      systemctl restart linker

      ln -sf /etc/nginx/sites-available/linker /etc/nginx/sites-enabled/linker
      rm -f /etc/nginx/sites-enabled/default
      systemctl enable nginx
      systemctl restart nginx

runcmd:
  - bash /opt/provision.sh
