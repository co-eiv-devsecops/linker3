# Linker

Acortador de URLs monolítico en Node.js con SQLite integrado.

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
node server.js
```

Abrir en el navegador: <http://localhost:3000>

## Variables de entorno

| Variable   | Default                 | Descripción                     |
|------------|-------------------------|---------------------------------|
| `PORT`     | `3000`                  | Puerto del servidor             |
| `BASE_URL` | `http://localhost:3000` | URL base para los links cortos  |

## Endpoints

| Método | Ruta           | Descripción                |
|--------|----------------|----------------------------|
| GET    | `/`            | Interfaz web               |
| POST   | `/api/shorten` | Acortar una URL            |
| GET    | `/:code`       | Redirigir al link original |

## Despliegue rápido (script)

Copia los archivos a la VM y reinicia el servicio en un solo comando:

```bash
bash deploy.sh
```

Requiere tener la llave `.ssh/linkervm-3.key` en tu computador. El script hace:
1. Copia `server.js`, `public/index.html` y `package.json` a la VM via SCP
2. Reinicia el servicio con `sudo systemctl restart linker`

## Estructura

```text
linker3/
├── server.js
├── public/
│   └── index.html
├── package.json
```
