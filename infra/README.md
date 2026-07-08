# infra/ — Paridad de entornos

Tres técnicas de IaC que persiguen el mismo objetivo (un entorno reproducible
para correr Linker) con distinto alcance:

| Técnica | Dónde vive | Target | Propósito |
|---|---|---|---|
| `cloud-init.yaml` (raíz del repo) | Cualquier nube compatible con cloud-init | Provisión in-VM | Instala Node 22, systemd, nginx dentro de una VM ya existente |
| `infra/terraform-oracle/` | Oracle Cloud real | VM real de producción/desarrollo | Crea la VM en OCI e inyecta `cloud-init.yaml` como `user_data` — es la técnica que realmente despliega |
| `infra/terraform/` + `infra/docker/` | Local (Docker) | Demo de desarrollo | Reproduce el mismo entorno de ejecución sin depender de credenciales de nube |

`infra/docker/Dockerfile` construye la misma definición de entorno que
`cloud-init.yaml` instala en la VM (Node 22, sin dependencias externas).

## infra/terraform-oracle/ — VM real en Oracle Cloud

Ver [`infra/terraform-oracle/README.md`](terraform-oracle/README.md) para
instrucciones completas. Resumen:

```bash
cd infra/terraform-oracle
cp terraform.tfvars.example terraform.tfvars   # completar con su compartment_id/subnet_id
terraform init
terraform apply
```

Requiere `oci` CLI ya configurado (`oci setup config`) — Terraform reutiliza
ese mismo perfil de `~/.oci/config`.

## infra/terraform/ — demo local (Docker)

## Requisitos

- Docker Desktop corriendo
- [Terraform](https://3.n-la-c.app/terraform-install) >= 1.5

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

### Variables (`variables.tf`)

| Variable | Default | Descripción |
|---|---|---|
| `app_port` | `3000` | Puerto del host mapeado al contenedor |
| `base_url` | `http://localhost:3000` | `BASE_URL` inyectada a la app |
| `container_name` | `linker-dev` | Nombre del contenedor |

### Limitaciones (demo local, no producción)

- State de Terraform en local (`terraform.tfstate`), sin backend remoto.
- No apunta a Oracle Cloud real: para eso usar `infra/terraform-oracle/`.
