# infra/ — Paridad de entornos

Dos técnicas de IaC que persiguen el mismo objetivo (un entorno reproducible
para correr Linker) con distinto alcance:

| Técnica | Dónde vive | Target | Propósito |
|---|---|---|---|
| `cloud-init.yaml` (raíz del repo) | Oracle Cloud (o cualquier nube compatible con cloud-init) | VM real de producción | Aprovisiona una VM desde cero: Node 22, systemd, nginx |
| `infra/terraform/` + `infra/docker/` | Local (Docker) | Demo de desarrollo | Reproduce el mismo entorno de ejecución (Node 22 + la app) sin depender de credenciales de nube |

`infra/docker/Dockerfile` construye la misma definición de entorno que
`cloud-init.yaml` instala en la VM (Node 22, sin dependencias externas). Sirve
como demo local de "paridad de entornos": el mismo artefacto de entorno se
puede levantar en un contenedor o adaptarse para crear una imagen de VM real
(p. ej. con Packer) sin cambiar la lógica de la app.

## Requisitos

- Docker Desktop corriendo
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5

## Uso

```bash
cd infra/terraform
terraform init
terraform apply
```

La app queda disponible en `http://localhost:3000` (ver output `url`).

Para destruir el contenedor:

```bash
terraform destroy
```

## Variables (`variables.tf`)

| Variable | Default | Descripción |
|---|---|---|
| `app_port` | `3000` | Puerto del host mapeado al contenedor |
| `base_url` | `http://localhost:3000` | `BASE_URL` inyectada a la app |
| `container_name` | `linker-dev` | Nombre del contenedor |

## Limitaciones (demo local, no producción)

- State de Terraform en local (`terraform.tfstate`), sin backend remoto.
- No apunta a Oracle Cloud real: para eso usar `cloud-init.yaml` en la raíz
  del repo, que es la técnica de paridad que efectivamente provisiona la VM
  de producción.
