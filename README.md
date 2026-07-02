# Linker

Acortador de URLs en Node.js con SQLite integrado.

**Producción:** <https://3.n-la-c.app>

**Repositorio:** <https://github.com/co-eiv-devsecops/linker3>

## Integrantes

- Diego Cardenas
- Samuel Albarracin
- Carlos Barrero
- Isaac Palomo

## Requisitos

- Node.js 22 o superior

## Instalación local

```bash
git clone https://github.com/co-eiv-devsecops/linker3.git
cd linker3
cp .env.example .env   # ajuste BASE_URL si es necesario
node server.js
```

Abrir en el navegador: <http://localhost:3000>

## Variables de entorno

| Variable   | Default                   | Descripción                            |
|------------|---------------------------|----------------------------------------|
| `PORT`     | `3000`                    | Puerto del servidor                    |
| `BASE_URL` | `http://localhost:{PORT}` | URL base para los links cortos         |
| `DB_PATH`  | `linker.db`               | Ruta del archivo de base de datos      |

## Endpoints

| Método | Ruta           | Descripción                                       |
|--------|----------------|---------------------------------------------------|
| GET    | `/`            | Interfaz web                                      |
| POST   | `/api/shorten` | Acortar una URL (acepta alias opcional)           |
| GET    | `/:code`       | Redirigir al link original e incrementar visitas  |

### Acortar con alias personalizado

```bash
# Sin alias (genera código aleatorio)
curl -X POST https://3.n-la-c.app/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ejemplo.com/pagina-muy-larga"}'

# Con alias personalizado
curl -X POST https://3.n-la-c.app/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ejemplo.com/pagina-muy-larga", "alias": "mi-link"}'
```

Reglas del alias: solo letras, números, `-` y `_`, entre 3 y 30 caracteres. Retorna `409` si el alias ya existe.

## Estructura

```text
linker3/
├── src/
│   ├── db.js          # Capa de acceso a datos (SQLite)
│   └── links.js       # Lógica de negocio (acortar, resolver, alias)
├── public/
│   └── index.html     # Interfaz web
├── .devcontainer/
│   └── devcontainer.json  # Entorno de desarrollo en contenedor
├── server.js          # Servidor HTTP y ruteo
├── cloud-init.yaml    # Provisionamiento de VM (paridad de entornos)
├── provision.sh       # Script de provisión (copia de la sección write_files de cloud-init.yaml, para probar sin VM)
├── deploy.sh          # Script de despliegue via git pull
├── infra/             # Demo local de paridad de entornos (Terraform + Docker)
├── .env.example       # Plantilla de variables de entorno
└── package.json
```

---

## Paridad de entornos — cloud-init.yaml

El archivo [`cloud-init.yaml`](cloud-init.yaml) permite crear una VM lista para correr Linker en **cualquier proveedor de nube** (Oracle Cloud, AWS, GCP, Azure) de forma reproducible. Requiere Node.js >= 22.13 (versión desde la que `node:sqlite` deja de necesitar el flag `--experimental-sqlite`); el instalador de NodeSource usado (`setup_22.x`) ya resuelve a esa serie.

### Qué instala y configura

- Node.js 22 (via NodeSource)
- Clona el repositorio en `/opt/linker` (vía [`provision.sh`](provision.sh), embebido también en `cloud-init.yaml`)
- Crea el servicio `linker` con systemd (reinicio automático)
- Configura Nginx como proxy inverso en el puerto 80

### Cómo usar (VM nueva en Oracle Cloud)

1. En la consola de Oracle Cloud, al crear la instancia, expanda **"Show advanced options"**
2. En la pestaña **"Initialization script"**, pegue el contenido de `cloud-init.yaml`
3. Lance la instancia — el aprovisionamiento es automático (~3-5 min)

> **Personalización:** antes de usar, edite `REPO` y `BASE_URL` dentro del script en `cloud-init.yaml` (sección `write_files` → `/opt/provision.sh`) con el repositorio y el dominio/IP de su VM.

### HTTPS (paso manual)

`cloud-init.yaml` instala `certbot` pero no emite el certificado automáticamente, porque requiere que el dominio ya resuelva a la IP de la VM. Tras el primer arranque:

```bash
ssh -i .ssh/linkervm-3.key ubuntu@<IP_VM> "sudo certbot --nginx -d <su-dominio>"
```

### Verificar el estado tras el aprovisionamiento

```bash
ssh -i .ssh/linkervm-3.key ubuntu@<IP_VM> "sudo systemctl status linker"
ssh -i .ssh/linkervm-3.key ubuntu@<IP_VM> "sudo systemctl status nginx"
```

## Demo local de paridad — Terraform + Docker

[`infra/`](infra/) contiene una segunda técnica de IaC: Terraform + Docker para levantar localmente la misma definición de entorno (Node 22 + la app) sin depender de credenciales de nube. Ver [`infra/README.md`](infra/README.md) para instrucciones completas.

```bash
cd infra/terraform
terraform init
terraform apply
```

---

## Despliegue de actualizaciones

Una vez la VM está provisionada con `cloud-init.yaml`, los deploys son un `git pull`:

```bash
bash deploy.sh
```

El script hace `git pull` en `/opt/linker`, reinicia el servicio y muestra el estado.

---

## DevContainers — entorno de desarrollo codificado

La carpeta [`.devcontainer/`](.devcontainer/) define un entorno de desarrollo reproducible usando [Dev Containers](https://containers.dev/).

### Requisitos

- VS Code con la extensión [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Docker Desktop

### Cómo usar

1. Abra el repositorio en VS Code
2. Cuando aparezca el aviso _"Reopen in Container"_, haga clic en él
   (o use el comando `Dev Containers: Reopen in Container`)
3. VS Code reconstruye el entorno con Node.js 22 y reenvía el puerto 3000
4. Ejecute `node server.js` — la app corre en <http://localhost:3000>

El contenedor usa la imagen oficial `mcr.microsoft.com/devcontainers/javascript-node:22-bookworm`. Las variables de entorno `PORT=3000` y `BASE_URL=http://localhost:3000` se inyectan automáticamente.

### Validar sin VS Code

Con la [CLI de Dev Containers](https://github.com/devcontainers/cli) (`npm install -g @devcontainers/cli`) se puede levantar y probar el entorno sin abrir VS Code:

```bash
devcontainer up --workspace-folder .
```
